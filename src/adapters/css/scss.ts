import * as path from 'node:path';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { ProjectInspection, AddCssOptions, AddCssResult } from './types';
import { Runner } from '../../core/runner';

export async function addScss(
  inspection: ProjectInspection,
  options: AddCssOptions,
  runner: Runner
): Promise<AddCssResult> {
  const { targetDir, mainScriptPath, styleSheetPath, packageManager } = inspection;

  // Idempotency: check if sass is already installed and scss file is present
  if (inspection.existingCssTools.sass && styleSheetPath && styleSheetPath.endsWith('.scss')) {
    process.stderr.write(pc.cyan(`ℹ SCSS is already configured in ${targetDir}.\n`));
    return {
      success: true,
      tool: 'scss',
      targetDir,
      installed: true,
      built: true,
      alreadyConfigured: true,
      exitCode: 0,
    };
  }

  process.stderr.write(pc.cyan(`Configuring SCSS (sass-embedded) in ${targetDir}...\n`));

  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = inspection.packageJson || JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.devDependencies = pkg.devDependencies || {};

  // 1. Dependencies
  pkg.devDependencies['sass-embedded'] = '^1.83.0';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 2. Stylesheet migration from .css to .scss
  let scssPath = path.join(targetDir, 'src/style.scss');

  if (styleSheetPath && fs.existsSync(styleSheetPath)) {
    if (styleSheetPath.endsWith('.css')) {
      const existingContent = fs.readFileSync(styleSheetPath, 'utf8');
      scssPath = styleSheetPath.replace(/\.css$/, '.scss');

      // Preserve existing styles, append a sample SCSS nesting block
      const scssContent =
        existingContent +
        `\n/* SCSS Test Syntax */\n$frappe-primary: #0f172a;\n.frappe-app {\n  .header {\n    color: $frappe-primary;\n  }\n}\n`;
      fs.writeFileSync(scssPath, scssContent, 'utf8');

      // Remove the old .css file
      fs.unlinkSync(styleSheetPath);

      // Update import in main script
      if (mainScriptPath && fs.existsSync(mainScriptPath)) {
        let scriptContent = fs.readFileSync(mainScriptPath, 'utf8');
        const oldImport = path.basename(styleSheetPath);
        const newImport = path.basename(scssPath);
        scriptContent = scriptContent.replace(oldImport, newImport);
        fs.writeFileSync(mainScriptPath, scriptContent, 'utf8');
      }
    }
  } else {
    // If no existing stylesheet, create one
    fs.mkdirSync(path.dirname(scssPath), { recursive: true });
    const sampleScss = `$primary-color: #0369a1;\n\nbody {\n  color: $primary-color;\n}\n`;
    fs.writeFileSync(scssPath, sampleScss, 'utf8');

    if (mainScriptPath && fs.existsSync(mainScriptPath)) {
      let scriptContent = fs.readFileSync(mainScriptPath, 'utf8');
      scriptContent = `import './style.scss';\n` + scriptContent;
      fs.writeFileSync(mainScriptPath, scriptContent, 'utf8');
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
        pc.red(`\nx Failed to install SCSS dependencies:\n`) +
          installRes.stderr +
          installRes.stdout +
          '\n' +
          pc.yellow(`  Recovery: cd "${targetDir}" && ${packageManager} install\n`)
      );
      return {
        success: false,
        tool: 'scss',
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
          pc.red(`\nx Project build verification failed with SCSS:\n`) +
            buildRes.stderr +
            buildRes.stdout +
            '\n'
        );
        return {
          success: false,
          tool: 'scss',
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

  process.stderr.write(pc.green(`✔ Successfully configured SCSS in ${targetDir}!\n`));
  return {
    success: true,
    tool: 'scss',
    targetDir,
    installed,
    built: !options.skipBuild && installed,
    alreadyConfigured: false,
    exitCode: 0,
  };
}
