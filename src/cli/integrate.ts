import * as path from 'node:path';
import * as fs from 'node:fs';
import * as readlinePromises from 'node:readline/promises';
import pc from 'picocolors';
import { Runner, defaultRunner } from '../core/runner';
import {
  FrappeIntegrationOptions,
  FrappeIntegrationResult,
  FileChangeRecord,
} from '../adapters/frappe/types';
import { inspectFrappeIntegration } from '../adapters/frappe/inspector';
import { updateHooksFile } from '../adapters/frappe/hooks-updater';
import { updateViteConfig } from '../adapters/frappe/vite-updater';
import { generatePortalRoute } from '../adapters/frappe/route-generator';
import { generateDeskPage } from '../adapters/frappe/desk-page-generator';

export async function runIntegrate(
  target: string,
  options: FrappeIntegrationOptions = {},
  runner: Runner = defaultRunner
): Promise<FrappeIntegrationResult> {
  const normalizedTarget = (target || '').toLowerCase().trim();

  // Validate target
  if (normalizedTarget === 'desk') {
    options.mode = 'desk';
  } else if (normalizedTarget !== 'frappe') {
    const errorMsg =
      `Unsupported integration target '${target}'.\n` +
      `Currently supported integration targets: 'frappe', 'desk'.\n` +
      `Usage: npx frappe-frontend-cli integrate frappe --app <app_name>`;
    process.stderr.write(pc.red(`x ${errorMsg}\n`));
    return {
      success: false,
      app: options.app || '',
      route: options.route || 'frontend',
      frontendDir: options.frontendDir || '',
      publicDir: '',
      installed: false,
      built: false,
      checkMode: Boolean(options.check),
      dryRun: Boolean(options.dryRun),
      filesChanged: [],
      isFullyIntegrated: false,
      error: errorMsg,
      exitCode: 1,
    };
  }

  // 1. Inspect Frappe custom app and frontend
  const inspectRes = inspectFrappeIntegration(options);
  if (!inspectRes.success || !inspectRes.inspection) {
    process.stderr.write(pc.red(`x ${inspectRes.error}\n`));
    return {
      success: false,
      app: options.app || '',
      route: options.route || 'frontend',
      frontendDir: options.frontendDir || '',
      publicDir: '',
      installed: false,
      built: false,
      checkMode: Boolean(options.check),
      dryRun: Boolean(options.dryRun),
      filesChanged: [],
      isFullyIntegrated: false,
      error: inspectRes.error,
      exitCode: 1,
    };
  }

  const insp = inspectRes.inspection;
  const isCheckMode = Boolean(options.check);
  const isDryRun = Boolean(options.dryRun);
  const isDeskMode = insp.mode === 'desk';

  // 2. CHECK MODE
  if (isCheckMode) {
    process.stderr.write(
      '\n' +
        pc.bold(`Frappe Frontend Integration Diagnostic Check (${insp.mode.toUpperCase()} Mode)\n`) +
        pc.dim('────────────────────────────────────────────────────────────\n') +
        `  ${pc.bold('Target App:')}         ${insp.app.appName} (${insp.app.appDir})\n` +
        `  ${pc.bold('Bench Directory:')}    ${insp.benchDir || 'Not detected (independent workspace)'}\n` +
        `  ${pc.bold('Frappe Version:')}     ${insp.frappeVersion || 'v14 / v15 / v16 compatible'}\n` +
        `  ${pc.bold('Frontend Directory:')} ${insp.frontendDir} (${insp.framework})\n` +
        (isDeskMode
          ? `  ${pc.bold('Desk Page:')}          /app/${insp.outputDir}\n`
          : `  ${pc.bold('Portal Route:')}       /${insp.route}\n`) +
        `  ${pc.bold('Asset Output:')}       ${insp.publicFrontendDir}\n` +
        pc.dim('────────────────────────────────────────────────────────────\n') +
        pc.bold('Integration Status:\n')
    );

    const checkLine = (ok: boolean, label: string, detail?: string) => {
      const icon = ok ? pc.green('✔') : pc.red('✖');
      process.stderr.write(`  ${icon} ${label}${detail ? pc.dim(` (${detail})`) : ''}\n`);
    };

    checkLine(
      insp.hasFrontend,
      'Frontend project & package.json present',
      insp.hasFrontend ? insp.frontendDir : 'missing'
    );
    checkLine(
      insp.viteConfiguredForProduction,
      `Vite production asset output and base URL (/assets/${insp.app.appName}/${insp.outputDir}/)`,
      insp.viteConfigPath ? path.basename(insp.viteConfigPath) : 'missing'
    );

    if (isDeskMode) {
      checkLine(
        Boolean(insp.deskPageJsonExists && insp.deskPageJsExists),
        `Frappe Desk Page files (${insp.outputDir}.json & ${insp.outputDir}.js)`,
        insp.deskPageJsonExists && insp.deskPageJsExists ? 'present' : 'missing'
      );
    } else {
      checkLine(
        insp.hooksConfigured,
        `Frappe hooks.py routing rule (/${insp.route})`,
        path.basename(insp.hooksPath)
      );
      checkLine(
        insp.wwwPyExists && insp.wwwHtmlExists,
        `Portal route files (www/${insp.route}.py & www/${insp.route}.html)`,
        insp.wwwPyExists && insp.wwwHtmlExists ? 'present' : 'missing'
      );
    }

    checkLine(
      insp.publicFrontendHasAssets,
      `Production build assets in public/${insp.outputDir}`,
      insp.publicFrontendHasAssets ? insp.publicFrontendDir : 'build needed'
    );
    checkLine(
      insp.manifestExists,
      'Vite build manifest (manifest.json for cache-busting asset loading)',
      insp.manifestExists ? 'present' : 'missing or unbuilt'
    );

    if (insp.bundleDiagnostics && insp.bundleDiagnostics.totalSizeKb > 0) {
      process.stderr.write(
        `  ${pc.blue('ℹ')} Total production bundle size: ${insp.bundleDiagnostics.totalSizeKb} KB\n`
      );
      if (insp.bundleDiagnostics.largeChunks.length > 0) {
        insp.bundleDiagnostics.largeChunks.forEach((c) => {
          process.stderr.write(
            `    ${pc.yellow(`! Chunk '${c.name}' is ${c.sizeKb} KB (> 500 KB). Consider dynamic import() code-splitting.`)}\n`
          );
        });
      }
    }

    process.stderr.write(pc.dim('────────────────────────────────────────────────────────────\n'));

    if (insp.isFullyIntegrated) {
      process.stderr.write(
        pc.green(
          pc.bold(`✔ Frontend is fully production-integrated with Frappe custom app '${insp.app.appName}'.\n\n`)
        )
      );
      return {
        success: true,
        app: insp.app.appName,
        route: insp.route,
        benchDir: insp.benchDir,
        frontendDir: insp.frontendDir,
        publicDir: insp.publicFrontendDir,
        installed: true,
        built: true,
        checkMode: true,
        dryRun: false,
        filesChanged: [],
        isFullyIntegrated: true,
        exitCode: 0,
      };
    } else {
      process.stderr.write(
        pc.yellow(
          pc.bold(`! Integration is incomplete (${insp.missingRequirements.length} requirements missing):\n`)
        )
      );
      insp.missingRequirements.forEach((req) => {
        process.stderr.write(`  - ${req}\n`);
      });
      process.stderr.write(
        pc.cyan(
          `\nTo automatically configure production integration, run:\n` +
            `  npx frappe-frontend-cli integrate ${isDeskMode ? 'desk' : 'frappe'} --app ${insp.app.appName}${isDeskMode ? ` --page ${insp.outputDir}` : ` --route ${insp.route}`}\n\n`
        )
      );
      return {
        success: false,
        app: insp.app.appName,
        route: insp.route,
        benchDir: insp.benchDir,
        frontendDir: insp.frontendDir,
        publicDir: insp.publicFrontendDir,
        installed: false,
        built: false,
        checkMode: true,
        dryRun: false,
        filesChanged: [],
        isFullyIntegrated: false,
        error: `Incomplete integration (${insp.missingRequirements.length} requirements missing)`,
        exitCode: 1,
      };
    }
  }

  // 3. DRY-RUN MODE OR EXECUTION SUMMARY
  const proposedChanges: string[] = [];

  if (!insp.viteConfiguredForProduction && insp.viteConfigPath) {
    proposedChanges.push(
      `Update ${path.relative(insp.app.appDir, insp.viteConfigPath)}: set base='/assets/${insp.app.appName}/${insp.outputDir}/', outDir='../${insp.app.appName}/public/${insp.outputDir}', and manifest=true`
    );
  }

  if (isDeskMode) {
    if (!insp.deskPageJsonExists) {
      proposedChanges.push(`Create Desk Page DocType JSON: ${insp.outputDir}.json`);
    }
    if (!insp.deskPageJsExists) {
      proposedChanges.push(`Create Desk Page controller JS: ${insp.outputDir}.js (mounts container & loads bundle)`);
    }
  } else {
    if (!insp.hooksConfigured) {
      proposedChanges.push(
        `Update ${path.relative(insp.app.appDir, insp.hooksPath)}: append website_route_rules for '/${insp.route}/<path:app_path>'`
      );
    }
    if (!insp.wwwPyExists) {
      proposedChanges.push(`Create ${path.relative(insp.app.appDir, insp.wwwPyPath)} (session CSRF token & boot context)`);
    }
    if (!insp.wwwHtmlExists) {
      proposedChanges.push(`Create ${path.relative(insp.app.appDir, insp.wwwHtmlPath)} (Jinja SPA loader template)`);
    }
  }

  if (!options.skipBuild) {
    proposedChanges.push(
      `Run production build (${insp.packageManager} run build) in ${path.relative(insp.app.appDir, insp.frontendDir)}`
    );
  }

  if (isDryRun) {
    process.stderr.write(
      '\n' +
        pc.bold(`Frappe Frontend Integration Plan (Dry-Run, ${insp.mode.toUpperCase()} Mode)\n`) +
        pc.dim('────────────────────────────────────────────────────────────\n') +
        `  ${pc.bold('Target App:')}         ${insp.app.appName} (${insp.app.appDir})\n` +
        `  ${pc.bold('Frontend Directory:')} ${insp.frontendDir}\n` +
        (isDeskMode
          ? `  ${pc.bold('Desk Page:')}          /app/${insp.outputDir}\n`
          : `  ${pc.bold('Portal Route:')}       /${insp.route}\n`) +
        `  ${pc.bold('Asset Output:')}       ${insp.publicFrontendDir}\n` +
        pc.dim('────────────────────────────────────────────────────────────\n') +
        pc.bold('Proposed Actions (no files will be written):\n')
    );

    if (proposedChanges.length === 0) {
      process.stderr.write(pc.green('  ✔ All integration components are already in place. No changes needed.\n\n'));
    } else {
      proposedChanges.forEach((p, idx) => {
        process.stderr.write(`  ${pc.cyan(`[${idx + 1}]`)} ${p}\n`);
      });
      process.stderr.write('\n');
    }

    return {
      success: true,
      app: insp.app.appName,
      route: insp.route,
      benchDir: insp.benchDir,
      frontendDir: insp.frontendDir,
      publicDir: insp.publicFrontendDir,
      installed: false,
      built: false,
      checkMode: false,
      dryRun: true,
      filesChanged: [],
      isFullyIntegrated: insp.isFullyIntegrated,
      exitCode: 0,
    };
  }

  // 4. CONFIRMATION (Interactive)
  const isInteractive = !options.yes && process.stdin.isTTY;
  if (isInteractive && proposedChanges.length > 0) {
    process.stderr.write(
      '\n' +
        pc.bold(`Frappe Frontend Integration Plan (${insp.mode.toUpperCase()} Mode):\n`) +
        pc.dim('────────────────────────────────────────────────────────────\n')
    );
    proposedChanges.forEach((p, idx) => {
      process.stderr.write(`  ${pc.cyan(`[${idx + 1}]`)} ${p}\n`);
    });
    process.stderr.write(pc.dim('────────────────────────────────────────────────────────────\n'));

    const rl = readlinePromises.createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = await rl.question(pc.cyan(`\nProceed with integration and file updates? [Y/n] `));
      const trimmed = answer.trim().toLowerCase();
      if (trimmed && trimmed !== 'y' && trimmed !== 'yes') {
        process.stderr.write(pc.yellow('\nIntegration cancelled by user. No files were modified.\n'));
        return {
          success: false,
          app: insp.app.appName,
          route: insp.route,
          benchDir: insp.benchDir,
          frontendDir: insp.frontendDir,
          publicDir: insp.publicFrontendDir,
          installed: false,
          built: false,
          checkMode: false,
          dryRun: false,
          filesChanged: [],
          isFullyIntegrated: false,
          error: 'Integration cancelled by user',
          exitCode: 0,
        };
      }
    } finally {
      rl.close();
    }
  }

  // 5. EXECUTE INTEGRATION CHANGES
  const filesChanged: FileChangeRecord[] = [];

  // A. Update Vite configuration
  if (insp.viteConfigPath) {
    const viteRes = updateViteConfig(insp.viteConfigPath, insp.app.appName, false, insp.outputDir);
    if (viteRes.modified) {
      filesChanged.push({
        filePath: insp.viteConfigPath,
        action: 'modified',
        backupPath: viteRes.backupPath,
        description: viteRes.description,
      });
      process.stderr.write(pc.green(`✔ ${viteRes.description}\n`));
    }
  } else {
    process.stderr.write(pc.yellow(`! No vite.config file found in ${insp.frontendDir}. Skipping Vite config update.\n`));
  }

  if (isDeskMode) {
    // B. Desk Page Generation
    const deskRes = generateDeskPage({
      appDir: insp.app.appDir,
      appName: insp.app.appName,
      pageName: insp.outputDir,
      title: options.pageTitle,
      moduleName: options.module,
      outputDir: insp.outputDir,
      dryRun: false,
    });

    if (deskRes.jsonCreated) {
      filesChanged.push({
        filePath: deskRes.jsonPath,
        action: 'created',
        backupPath: deskRes.jsonBackupPath,
        description: `Created Desk Page DocType definition in ${path.relative(insp.app.appDir, deskRes.jsonPath)}`,
      });
      process.stderr.write(pc.green(`✔ Created Desk Page DocType JSON: ${path.basename(deskRes.jsonPath)}\n`));
    }

    if (deskRes.jsCreated) {
      filesChanged.push({
        filePath: deskRes.jsPath,
        action: 'created',
        backupPath: deskRes.jsBackupPath,
        description: `Created Desk Page controller in ${path.relative(insp.app.appDir, deskRes.jsPath)}`,
      });
      process.stderr.write(pc.green(`✔ Created Desk Page controller: ${path.basename(deskRes.jsPath)}\n`));
    }
  } else {
    // B. Portal Mode: Update hooks.py
    const hooksRes = updateHooksFile(insp.hooksPath, insp.route, false);
    if (hooksRes.modified) {
      filesChanged.push({
        filePath: insp.hooksPath,
        action: 'modified',
        backupPath: hooksRes.backupPath,
        description: hooksRes.description,
      });
      process.stderr.write(pc.green(`✔ ${hooksRes.description}\n`));
    } else {
      process.stderr.write(pc.dim(`ℹ ${hooksRes.description}\n`));
    }

    // C. Portal Mode: Generate www/<route>.py and www/<route>.html
    const appPkgDir = path.dirname(insp.hooksPath);
    const routeRes = generatePortalRoute(appPkgDir, insp.app.appName, insp.route, false);

    if (routeRes.pyCreated) {
      filesChanged.push({
        filePath: routeRes.pyPath,
        action: 'created',
        backupPath: routeRes.pyBackupPath,
        description: `Created portal controller ${path.basename(routeRes.pyPath)} with session boot & CSRF token`,
      });
      process.stderr.write(pc.green(`✔ Created ${path.basename(routeRes.pyPath)} (session CSRF token & boot context)\n`));
    }

    if (routeRes.htmlCreated) {
      filesChanged.push({
        filePath: routeRes.htmlPath,
        action: 'created',
        backupPath: routeRes.htmlBackupPath,
        description: `Created portal template ${path.basename(routeRes.htmlPath)} with Jinja SPA loader`,
      });
      process.stderr.write(pc.green(`✔ Created ${path.basename(routeRes.htmlPath)} (Jinja SPA loader template)\n`));
    }
  }

  let built = false;

  // D. Production Build Verification
  if (!options.skipBuild) {
    process.stderr.write(pc.cyan(`\nBuilding frontend for production (${insp.packageManager} run build)...\n`));

    const buildArgs = insp.packageManager === 'yarn' ? ['build'] : ['run', 'build'];
    const buildRes = await runner.run(insp.packageManager, buildArgs, {
      cwd: insp.frontendDir,
      timeoutMs: 180_000,
    });

    if (buildRes.exitCode !== 0) {
      process.stderr.write(
        pc.red(`\nx Frontend production build failed (exit code ${buildRes.exitCode}):\n`) +
          buildRes.stderr +
          buildRes.stdout +
          '\n' +
          pc.yellow(
            `\n! Configuration changes remain intact, but production assets were not generated.\n` +
              `  Recovery: cd "${insp.frontendDir}" && ${insp.packageManager} run build\n`
          )
      );
      return {
        success: false,
        app: insp.app.appName,
        route: insp.route,
        benchDir: insp.benchDir,
        frontendDir: insp.frontendDir,
        publicDir: insp.publicFrontendDir,
        installed: true,
        built: false,
        checkMode: false,
        dryRun: false,
        filesChanged,
        isFullyIntegrated: false,
        error: `Build verification failed with code ${buildRes.exitCode}`,
        exitCode: buildRes.exitCode || 1,
      };
    }

    built = true;

    // Verify generated assets exist in public/<outputDir>
    if (fs.existsSync(insp.publicFrontendDir)) {
      const generatedFiles = fs.readdirSync(insp.publicFrontendDir);
      process.stderr.write(
        pc.green(
          `✔ Production build verified. Output: ${insp.publicFrontendDir} (${generatedFiles.length} items)\n`
        )
      );
    }
  }

  // 6. SUCCESS REPORT
  process.stderr.write(
    '\n' +
      pc.green(
        pc.bold(
          `✔ Successfully integrated frontend with Frappe custom app '${insp.app.appName}' (${insp.mode.toUpperCase()} mode)!\n`
        )
      ) +
      '\n' +
      pc.bold('Files Created or Modified:\n')
  );

  filesChanged.forEach((f) => {
    const rel = path.relative(insp.app.appDir, f.filePath);
    process.stderr.write(`  ${pc.green(f.action.toUpperCase())}: ${rel} (${f.description})\n`);
    if (f.backupPath) {
      process.stderr.write(`    ${pc.dim(`↳ Backup: ${path.relative(insp.app.appDir, f.backupPath)}`)}\n`);
    }
  });

  process.stderr.write(
    '\n' +
      pc.bold('Reversal Instructions:\n') +
      `  To revert these changes, restore the created .bak files or delete created files:\n`
  );
  filesChanged.forEach((f) => {
    if (f.backupPath) {
      process.stderr.write(`  mv "${f.backupPath}" "${f.filePath}"\n`);
    } else if (f.action === 'created') {
      process.stderr.write(`  rm -f "${f.filePath}"\n`);
    }
  });

  if (isDeskMode) {
    process.stderr.write(
      '\n' +
        pc.bold('Frappe Desk Access:\n') +
        `  - Desk URL:   http://<your-site>/app/${insp.outputDir}\n` +
        `  - Asset URL:  /assets/${insp.app.appName}/${insp.outputDir}/\n\n`
    );
  } else {
    process.stderr.write(
      '\n' +
        pc.bold('Frappe Production Access:\n') +
        `  - Development: Run Vite dev server in ${insp.frontendDir} with proxy target to Frappe backend.\n` +
        `  - Production: Build assets to public/${insp.outputDir}. Frappe serves the SPA at: /${insp.route}\n` +
        `  - Asset URL:  /assets/${insp.app.appName}/${insp.outputDir}/\n\n`
    );
  }

  return {
    success: true,
    app: insp.app.appName,
    route: insp.route,
    benchDir: insp.benchDir,
    frontendDir: insp.frontendDir,
    publicDir: insp.publicFrontendDir,
    installed: true,
    built,
    checkMode: false,
    dryRun: false,
    filesChanged,
    isFullyIntegrated: true,
    exitCode: 0,
  };
}
