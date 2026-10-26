import * as path from 'node:path';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { ProjectInspection, AddCssOptions, AddCssResult } from './types';
import { Runner } from '../../core/runner';

export async function addBootstrap(
  inspection: ProjectInspection,
  options: AddCssOptions,
  runner: Runner
): Promise<AddCssResult> {
  const { targetDir, mainScriptPath, styleSheetPath, packageManager } = inspection;

  // Idempotency: check if already installed or imported
  if (inspection.existingCssTools.bootstrap) {
    process.stderr.write(pc.cyan(`ℹ Bootstrap is already configured in ${targetDir}.\n`));
    return {
      success: true,
      tool: 'bootstrap',
      targetDir,
      installed: true,
      built: true,
      alreadyConfigured: true,
      exitCode: 0,
    };
  }

  process.stderr.write(pc.cyan(`Configuring Bootstrap 5 in ${targetDir}...\n`));

  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = inspection.packageJson || JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = pkg.dependencies || {};

  // 1. Dependencies
  pkg.dependencies['bootstrap'] = '^5.3.3';
  pkg.dependencies['@popperjs/core'] = '^2.11.8';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 2. Configure CSS Import in main entry script
  const bootstrapImport = `import 'bootstrap/dist/css/bootstrap.min.css';\n`;
  if (mainScriptPath && fs.existsSync(mainScriptPath)) {
    let scriptContent = fs.readFileSync(mainScriptPath, 'utf8');
    if (!scriptContent.includes('bootstrap')) {
      scriptContent = bootstrapImport + scriptContent;
      fs.writeFileSync(mainScriptPath, scriptContent, 'utf8');
    }
  } else {
    // Fallback: import in stylesheet
    const cssFile = styleSheetPath || path.join(targetDir, 'src/style.css');
    if (!fs.existsSync(cssFile)) {
      fs.mkdirSync(path.dirname(cssFile), { recursive: true });
      fs.writeFileSync(cssFile, `@import "bootstrap/dist/css/bootstrap.min.css";\n`, 'utf8');
    } else {
      let cssContent = fs.readFileSync(cssFile, 'utf8');
      if (!cssContent.includes('bootstrap')) {
        cssContent = `@import "bootstrap/dist/css/bootstrap.min.css";\n` + cssContent;
        fs.writeFileSync(cssFile, cssContent, 'utf8');
      }
    }
  }

  // 3. Install Dependencies
  let installed = false;
  if (!options.skipInstall) {
    process.stderr.write(pc.cyan(`Installing dependencies with ${packageManager}...\n`));
    const installArgs = packageManager === 'yarn' ? [] : ['install'];
    const installRes = await runner.run(packageManager, installArgs, {
      cwd: targetDir,
      timeoutMs: 180_000,
    });

    if (installRes.exitCode !== 0) {
      process.stderr.write(
        pc.red(`\nx Failed to install Bootstrap dependencies:\n`) +
          installRes.stderr +
          installRes.stdout +
          '\n' +
          pc.yellow(`  Recovery: cd "${targetDir}" && ${packageManager} install\n`)
      );
      return {
        success: false,
        tool: 'bootstrap',
        targetDir,
        installed: false,
        built: false,
        alreadyConfigured: false,
        error: `Installation failed with exit code ${installRes.exitCode}`,
        exitCode: installRes.exitCode,
      };
    }
    installed = true;

    // 4. Verification Build
    if (!options.skipBuild) {
      process.stderr.write(pc.cyan(`Verifying project build (${packageManager} run build)...\n`));
      const buildArgs = packageManager === 'yarn' ? ['build'] : ['run', 'build'];
      const buildRes = await runner.run(packageManager, buildArgs, {
        cwd: targetDir,
        timeoutMs: 120_000,
      });

      if (buildRes.exitCode !== 0) {
        process.stderr.write(
          pc.red(`\nx Project build verification failed with Bootstrap:\n`) +
            buildRes.stderr +
            buildRes.stdout +
            '\n'
        );
        return {
          success: false,
          tool: 'bootstrap',
          targetDir,
          installed: true,
          built: false,
          alreadyConfigured: false,
          error: `Build verification failed with exit code ${buildRes.exitCode}`,
          exitCode: buildRes.exitCode,
        };
      }
    }
  }

  process.stderr.write(pc.green(`✔ Successfully configured Bootstrap 5 in ${targetDir}!\n`));
  return {
    success: true,
    tool: 'bootstrap',
    targetDir,
    installed,
    built: !options.skipBuild && installed,
    alreadyConfigured: false,
    exitCode: 0,
  };
}
