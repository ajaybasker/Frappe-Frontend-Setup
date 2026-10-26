import * as path from 'node:path';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { Runner, defaultRunner } from '../core/runner';
import { validateProjectName, validateTargetDirectory } from '../core/validation';
import {
  getFrameworkAdapter,
  SupportedLanguage,
  SupportedPackageManager,
  ScaffoldResult,
} from '../adapters/frameworks';
import { detectPackageManager, detectPackageManagers } from '../core/facts';

export interface CreateCommandOptions {
  ts?: boolean;
  js?: boolean;
  packageManager?: string;
  skipInstall?: boolean;
  skipBuild?: boolean;
  cwd?: string;
}

export async function runCreate(
  template: string,
  projectNameInput: string | undefined,
  options: CreateCommandOptions = {},
  runner: Runner = defaultRunner
): Promise<ScaffoldResult & { exitCode: number }> {
  const cwd = options.cwd || process.cwd();

  // 1. Template validation
  const normalizedTemplate = (template || '').toLowerCase().trim();

  if (normalizedTemplate === 'frappe-ui') {
    process.stderr.write(
      pc.yellow(
        `! 'frappe-ui' scaffolding is scheduled for Phase 4.\n` +
          `  Frappe UI requires Vue 3 and pins Tailwind CSS to v3.x.\n` +
          `  To create a standard Vue 3 project now, run: npx frappe-frontend-cli create vue <name>\n`
      )
    );
    return {
      success: false,
      targetDir: '',
      projectName: projectNameInput || '',
      framework: 'vue',
      language: 'ts',
      packageManager: 'npm',
      installed: false,
      built: false,
      error: 'frappe-ui is scheduled for Phase 4',
      filesGenerated: 0,
      exitCode: 1,
    };
  }

  const adapter = getFrameworkAdapter(normalizedTemplate);
  if (!adapter) {
    process.stderr.write(
      pc.red(
        `x Unsupported template '${template}'. Supported templates in Phase 2: 'vue', 'react'.\n` +
          `  Example: npx frappe-frontend-cli create vue my-app\n`
      )
    );
    return {
      success: false,
      targetDir: '',
      projectName: projectNameInput || '',
      framework: 'vue',
      language: 'ts',
      packageManager: 'npm',
      installed: false,
      built: false,
      error: `Unsupported template: ${template}`,
      filesGenerated: 0,
      exitCode: 1,
    };
  }

  // 2. Project name & target path validation
  if (!projectNameInput || !projectNameInput.trim()) {
    process.stderr.write(
      pc.red(
        `x Please specify a project name.\n` +
          `  Usage: npx frappe-frontend-cli create ${normalizedTemplate} <project-name>\n`
      )
    );
    return {
      success: false,
      targetDir: '',
      projectName: '',
      framework: adapter.id,
      language: 'ts',
      packageManager: 'npm',
      installed: false,
      built: false,
      error: 'Missing project name',
      filesGenerated: 0,
      exitCode: 1,
    };
  }

  const rawInput = projectNameInput.trim();
  const targetDirValidation = validateTargetDirectory(rawInput, cwd);
  if (!targetDirValidation.valid) {
    process.stderr.write(pc.red(`x ${targetDirValidation.error}\n`));
    return {
      success: false,
      targetDir: targetDirValidation.resolvedPath,
      projectName: path.basename(targetDirValidation.resolvedPath),
      framework: adapter.id,
      language: 'ts',
      packageManager: 'npm',
      installed: false,
      built: false,
      error: targetDirValidation.error,
      filesGenerated: 0,
      exitCode: 1,
    };
  }

  const targetDir = targetDirValidation.resolvedPath;
  const projectName = path.basename(targetDir);

  const nameValidation = validateProjectName(projectName);
  if (!nameValidation.valid) {
    process.stderr.write(pc.red(`x Invalid project name '${projectName}': ${nameValidation.error}\n`));
    return {
      success: false,
      targetDir,
      projectName,
      framework: adapter.id,
      language: 'ts',
      packageManager: 'npm',
      installed: false,
      built: false,
      error: nameValidation.error,
      filesGenerated: 0,
      exitCode: 1,
    };
  }

  // 3. Language selection: default to TypeScript
  let language: SupportedLanguage = 'ts';
  if (options.js && !options.ts) {
    language = 'js';
  } else if (options.ts) {
    language = 'ts';
  }

  // 4. Package manager selection & verification
  let packageManager: SupportedPackageManager;
  if (options.packageManager) {
    const requestedPm = options.packageManager.toLowerCase().trim() as SupportedPackageManager;
    if (!['npm', 'pnpm', 'yarn', 'bun'].includes(requestedPm)) {
      process.stderr.write(
        pc.red(`x Unsupported package manager '${options.packageManager}'. Use npm, pnpm, yarn, or bun.\n`)
      );
      return {
        success: false,
        targetDir,
        projectName,
        framework: adapter.id,
        language,
        packageManager: 'npm',
        installed: false,
        built: false,
        error: `Unsupported package manager: ${options.packageManager}`,
        filesGenerated: 0,
        exitCode: 1,
      };
    }

    const pmInfo = await detectPackageManager(requestedPm, runner);
    if (!pmInfo) {
      process.stderr.write(
        pc.red(
          `x Package manager '${requestedPm}' is not installed or not available on PATH.\n` +
            `  Please install ${requestedPm} or use an available package manager (e.g. --package-manager npm).\n`
        )
      );
      return {
        success: false,
        targetDir,
        projectName,
        framework: adapter.id,
        language,
        packageManager: requestedPm,
        installed: false,
        built: false,
        error: `Package manager '${requestedPm}' not found on PATH`,
        filesGenerated: 0,
        exitCode: 1,
      };
    }
    packageManager = requestedPm;
  } else {
    const pmFacts = await detectPackageManagers(runner);
    packageManager = pmFacts.preferred;
  }

  // 5. Scaffolding files
  process.stderr.write(
    pc.cyan(`Scaffolding ${adapter.name} (${language === 'ts' ? 'TypeScript' : 'JavaScript'}) in ${targetDir}...\n`)
  );

  const files = adapter.getFiles({ projectName, language });

  try {
    fs.mkdirSync(targetDir, { recursive: true });

    for (const file of files) {
      const fullPath = path.join(targetDir, file.relativePath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, file.content, 'utf8');
    }
  } catch (err) {
    process.stderr.write(pc.red(`x File generation failed: ${(err as Error).message}\n`));
    return {
      success: false,
      targetDir,
      projectName,
      framework: adapter.id,
      language,
      packageManager,
      installed: false,
      built: false,
      error: (err as Error).message,
      filesGenerated: 0,
      exitCode: 1,
    };
  }

  let installed = false;
  let built = false;

  // 6. Dependency Installation
  if (!options.skipInstall) {
    process.stderr.write(pc.cyan(`Installing dependencies with ${packageManager}...\n`));

    const installArgs = packageManager === 'yarn' ? [] : ['install'];
    const installRes = await runner.run(packageManager, installArgs, {
      cwd: targetDir,
      timeoutMs: 180_000,
    });

    if (installRes.exitCode !== 0) {
      process.stderr.write(
        pc.red(`\nx Dependency installation failed (exit code ${installRes.exitCode}):\n`) +
          installRes.stderr +
          installRes.stdout +
          '\n' +
          pc.yellow(
            `\n! Project files remain intact in '${targetDir}'.\n` +
              `  Recovery: cd "${targetDir}" && ${packageManager} install\n`
          )
      );
      return {
        success: false,
        targetDir,
        projectName,
        framework: adapter.id,
        language,
        packageManager,
        installed: false,
        built: false,
        error: `Installation failed with code ${installRes.exitCode}`,
        filesGenerated: files.length,
        exitCode: installRes.exitCode || 1,
      };
    }
    installed = true;

    // 7. Verification Build
    if (!options.skipBuild) {
      process.stderr.write(pc.cyan(`Verifying project build (${packageManager} run build)...\n`));

      const buildArgs = packageManager === 'yarn' ? ['build'] : ['run', 'build'];
      const buildRes = await runner.run(packageManager, buildArgs, {
        cwd: targetDir,
        timeoutMs: 120_000,
      });

      if (buildRes.exitCode !== 0) {
        process.stderr.write(
          pc.red(`\nx Project build verification failed (exit code ${buildRes.exitCode}):\n`) +
            buildRes.stderr +
            buildRes.stdout +
            '\n' +
            pc.yellow(
              `\n! Project files remain intact in '${targetDir}'.\n` +
                `  Review the build errors above, or run: cd "${targetDir}" && ${packageManager} run build\n`
            )
        );
        return {
          success: false,
          targetDir,
          projectName,
          framework: adapter.id,
          language,
          packageManager,
          installed: true,
          built: false,
          error: `Build verification failed with code ${buildRes.exitCode}`,
          filesGenerated: files.length,
          exitCode: buildRes.exitCode || 1,
        };
      }
      built = true;
    }
  }

  // 8. Success Report
  const devCommand = packageManager === 'yarn' ? 'yarn dev' : `${packageManager} run dev`;

  process.stderr.write('\n');
  process.stderr.write(
    pc.green(
      pc.bold(
        `✔ Successfully created ${projectName} (${adapter.name}, ${language === 'ts' ? 'TypeScript' : 'JavaScript'})!\n`
      )
    )
  );
  if (built) {
    process.stderr.write(pc.green(`✔ Production build verified successfully.\n`));
  }
  process.stderr.write('\n' + pc.bold('Next steps:\n'));
  process.stderr.write(`  cd ${projectName}\n`);
  if (!installed) {
    process.stderr.write(`  ${packageManager} install\n`);
  }
  process.stderr.write(`  ${devCommand}\n\n`);

  return {
    success: true,
    targetDir,
    projectName,
    framework: adapter.id,
    language,
    packageManager,
    installed,
    built,
    filesGenerated: files.length,
    exitCode: 0,
  };
}
