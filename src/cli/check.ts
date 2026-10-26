import * as path from 'node:path';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { inspectFrappeIntegration } from '../adapters/frappe';

export interface CheckCommandOptions {
  cwd?: string;
  app?: string;
  benchDir?: string;
  route?: string;
  json?: boolean;
}

export interface DiagnosticCheckItem {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export interface CheckReport {
  projectDir: string;
  hasPackageJson: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  nodeModulesInstalled: boolean;
  framework: string;
  frameworkVersion?: string;
  isVite: boolean;
  viteConfigPath?: string;
  viteProductionBaseConfigured: boolean;
  viteOutDirConfigured: boolean;
  viteProxyConfigured: boolean;
  cssTool: string;
  frappeApp?: {
    appName: string;
    appDir: string;
    benchDir?: string;
    frappeVersion?: string;
    hooksPath?: string;
    hooksConfigured: boolean;
    portalRoute: string;
    wwwPyExists: boolean;
    wwwHtmlExists: boolean;
    publicAssetsExist: boolean;
    isFullyIntegrated: boolean;
  };
  checks: DiagnosticCheckItem[];
  issues: string[];
  recommendations: string[];
  isHealthy: boolean;
  exitCode: number;
}

export async function runCheck(
  options: CheckCommandOptions = {}
): Promise<{ report: CheckReport; exitCode: number }> {
  let projectDir = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // If the current directory is an app root that contains a frontend directory, target the frontend
  if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
    const candidateFrontend = path.join(projectDir, 'frontend');
    if (fs.existsSync(path.join(candidateFrontend, 'package.json'))) {
      projectDir = candidateFrontend;
    }
  }

  const checks: DiagnosticCheckItem[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  const pkgPath = path.join(projectDir, 'package.json');
  const hasPackageJson = fs.existsSync(pkgPath);

  let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (
    fs.existsSync(path.join(projectDir, 'bun.lockb')) ||
    fs.existsSync(path.join(projectDir, 'bun.lock'))
  ) {
    packageManager = 'bun';
  }

  const nodeModulesInstalled = fs.existsSync(path.join(projectDir, 'node_modules'));

  // 1. Package.json check
  if (!hasPackageJson) {
    checks.push({
      name: 'Package Configuration',
      status: 'error',
      message: 'package.json not found',
      detail: `No Node.js project found in '${projectDir}'.`,
    });
    issues.push(`Target directory '${projectDir}' does not contain package.json.`);
    recommendations.push(
      `Initialize a new frontend project using: npx frappe-frontend-cli create <vue|react|frappe-ui> or npx frappe-frontend-cli init`
    );

    const report: CheckReport = {
      projectDir,
      hasPackageJson: false,
      packageManager,
      nodeModulesInstalled,
      framework: 'none',
      isVite: false,
      viteProductionBaseConfigured: false,
      viteOutDirConfigured: false,
      viteProxyConfigured: false,
      cssTool: 'none',
      checks,
      issues,
      recommendations,
      isHealthy: false,
      exitCode: 1,
    };

    if (options.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      renderTextReport(report);
    }

    return { report, exitCode: 1 };
  }

  checks.push({
    name: 'Package Configuration',
    status: 'ok',
    message: 'package.json found and valid',
    detail: path.basename(pkgPath),
  });

  // Read package.json dependencies
  let pkgData: any = {};
  try {
    pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    checks.push({
      name: 'Package JSON Syntax',
      status: 'error',
      message: 'package.json is malformed JSON',
      detail: String(err),
    });
    issues.push('package.json contains syntax errors.');
  }

  const allDeps: Record<string, string> = {
    ...(pkgData.dependencies || {}),
    ...(pkgData.devDependencies || {}),
  };

  // 2. node_modules check
  if (!nodeModulesInstalled) {
    checks.push({
      name: 'Dependencies Installation',
      status: 'warn',
      message: 'node_modules missing',
      detail: `Run '${packageManager} install'`,
    });
    issues.push('Dependencies are not installed (missing node_modules).');
    recommendations.push(`Run '${packageManager} install' to install dependencies.`);
  } else {
    checks.push({
      name: 'Dependencies Installation',
      status: 'ok',
      message: 'node_modules installed',
    });
  }

  // 3. Framework detection
  let framework = 'unknown';
  let frameworkVersion: string | undefined;

  if (allDeps['frappe-ui']) {
    framework = 'frappe-ui';
    frameworkVersion = allDeps['frappe-ui'];
  } else if (allDeps['vue']) {
    framework = 'vue';
    frameworkVersion = allDeps['vue'];
  } else if (allDeps['react']) {
    framework = 'react';
    frameworkVersion = allDeps['react'];
  } else if (allDeps['vite']) {
    framework = 'vanilla';
    frameworkVersion = allDeps['vite'];
  }

  checks.push({
    name: 'Frontend Framework',
    status: framework !== 'unknown' ? 'ok' : 'warn',
    message: `${framework} ${frameworkVersion ? `(${frameworkVersion})` : ''}`,
  });

  // Check Frappe UI compatibility
  if (framework === 'frappe-ui') {
    if (allDeps['@tailwindcss/vite']) {
      checks.push({
        name: 'Frappe UI Tailwind Compatibility',
        status: 'error',
        message: 'Tailwind v4 detected with Frappe UI',
        detail: 'Frappe UI requires Tailwind CSS v3 compatibility mode',
      });
      issues.push(
        'Frappe UI requires Tailwind CSS v3. Tailwind v4 (@tailwindcss/vite) will cause style breaks.'
      );
      recommendations.push(
        'Switch to Tailwind CSS v3 using: npx frappe-frontend-cli add tailwind --v3'
      );
    } else if (allDeps['tailwindcss']) {
      const twVer = allDeps['tailwindcss'];
      if (twVer.startsWith('^4') || twVer.startsWith('4')) {
        checks.push({
          name: 'Frappe UI Tailwind Compatibility',
          status: 'error',
          message: `Tailwind ${twVer} detected with Frappe UI`,
          detail: 'Frappe UI requires Tailwind CSS v3',
        });
        issues.push('Frappe UI requires Tailwind CSS v3.');
      } else {
        checks.push({
          name: 'Frappe UI Tailwind Compatibility',
          status: 'ok',
          message: `Tailwind CSS v3 compatibility confirmed (${twVer})`,
        });
      }
    }
  }

  // 4. Vite Configuration Check
  let isVite = Boolean(allDeps['vite']);
  let viteConfigPath: string | undefined;
  const tsConfig = path.join(projectDir, 'vite.config.ts');
  const jsConfig = path.join(projectDir, 'vite.config.js');

  if (fs.existsSync(tsConfig)) {
    viteConfigPath = tsConfig;
    isVite = true;
  } else if (fs.existsSync(jsConfig)) {
    viteConfigPath = jsConfig;
    isVite = true;
  }

  let viteProductionBaseConfigured = false;
  let viteOutDirConfigured = false;
  let viteProxyConfigured = false;

  if (viteConfigPath) {
    try {
      const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
      viteProductionBaseConfigured = viteContent.includes('/assets/') && viteContent.includes('/frontend');
      viteOutDirConfigured = viteContent.includes('public/frontend');
      viteProxyConfigured = viteContent.includes('/api') || viteContent.includes('proxy');

      checks.push({
        name: 'Vite Configuration',
        status: 'ok',
        message: path.basename(viteConfigPath),
      });

      if (viteProductionBaseConfigured) {
        checks.push({
          name: 'Vite Production Base URL',
          status: 'ok',
          message: 'Configured for Frappe /assets/<app>/frontend/',
        });
      } else {
        checks.push({
          name: 'Vite Production Base URL',
          status: 'warn',
          message: 'Not configured for Frappe production assets',
          detail: 'Expected base: /assets/<app>/frontend/',
        });
      }

      if (viteOutDirConfigured) {
        checks.push({
          name: 'Vite Production Output Directory',
          status: 'ok',
          message: 'Configured to ../<app>/public/frontend',
        });
      } else {
        checks.push({
          name: 'Vite Production Output Directory',
          status: 'warn',
          message: 'Not configured to output into Frappe public directory',
          detail: 'Expected build.outDir: ../<app>/public/frontend',
        });
      }

      if (viteProxyConfigured) {
        checks.push({
          name: 'Vite Backend Proxy',
          status: 'ok',
          message: 'Configured for Frappe backend API routes',
        });
      } else {
        checks.push({
          name: 'Vite Backend Proxy',
          status: 'warn',
          message: 'Backend proxy for /api or /assets not configured in vite.config',
        });
      }
    } catch (err) {
      checks.push({
        name: 'Vite Configuration',
        status: 'error',
        message: `Failed to read ${path.basename(viteConfigPath)}: ${err}`,
      });
    }
  } else {
    checks.push({
      name: 'Vite Configuration',
      status: 'warn',
      message: 'vite.config file not found',
    });
  }

  // 5. CSS Tooling Detection
  let cssTool = 'none';
  if (allDeps['@tailwindcss/vite']) {
    cssTool = 'tailwind-v4';
  } else if (allDeps['tailwindcss']) {
    cssTool = 'tailwind-v3';
  } else if (allDeps['bootstrap']) {
    cssTool = 'bootstrap';
  } else if (allDeps['sass'] || allDeps['sass-embedded']) {
    cssTool = 'scss';
  }

  checks.push({
    name: 'CSS Tooling',
    status: 'ok',
    message: cssTool,
  });

  // 6. Frappe Custom App Integration Diagnostics
  let frappeAppReport: CheckReport['frappeApp'];

  // Try to find if this frontend is linked to or inside a Frappe custom app
  let appName = options.app;
  if (!appName) {
    if (path.basename(projectDir) === 'frontend') {
      appName = path.basename(path.dirname(projectDir));
    }
  }

  if (appName) {
    const inspectRes = inspectFrappeIntegration({
      cwd: projectDir,
      app: appName,
      benchDir: options.benchDir,
      route: options.route,
      frontendDir: projectDir,
    });

    if (inspectRes.success && inspectRes.inspection) {
      const insp = inspectRes.inspection;
      frappeAppReport = {
        appName: insp.app.appName,
        appDir: insp.app.appDir,
        benchDir: insp.benchDir,
        frappeVersion: insp.frappeVersion,
        hooksPath: insp.hooksPath,
        hooksConfigured: insp.hooksConfigured,
        portalRoute: insp.route,
        wwwPyExists: insp.wwwPyExists,
        wwwHtmlExists: insp.wwwHtmlExists,
        publicAssetsExist: insp.publicFrontendHasAssets,
        isFullyIntegrated: insp.isFullyIntegrated,
      };

      checks.push({
        name: 'Frappe Custom App',
        status: 'ok',
        message: `${insp.app.appName} (${insp.app.appDir})`,
        detail: insp.frappeVersion ? `Frappe ${insp.frappeVersion}` : undefined,
      });

      checks.push({
        name: 'Frappe Routing (hooks.py)',
        status: insp.hooksConfigured ? 'ok' : 'warn',
        message: insp.hooksConfigured
          ? `website_route_rules registered for /${insp.route}`
          : `website_route_rules missing for /${insp.route}`,
      });

      checks.push({
        name: 'Portal Route Files',
        status: insp.wwwPyExists && insp.wwwHtmlExists ? 'ok' : 'warn',
        message:
          insp.wwwPyExists && insp.wwwHtmlExists
            ? `www/${insp.route}.py & www/${insp.route}.html present`
            : `Missing www/${insp.route}.py or www/${insp.route}.html`,
      });

      checks.push({
        name: 'Production Asset Delivery',
        status: insp.publicFrontendHasAssets ? 'ok' : 'warn',
        message: insp.publicFrontendHasAssets
          ? `Assets present in ${insp.publicFrontendDir}`
          : `Assets missing in ${insp.publicFrontendDir} (needs build)`,
      });

      if (!insp.isFullyIntegrated) {
        insp.missingRequirements.forEach((req) => issues.push(req));
        recommendations.push(
          `Run: npx frappe-frontend-cli integrate frappe --app ${insp.app.appName} --route ${insp.route}`
        );
      }
    }
  }

  const hasErrors = checks.some((c) => c.status === 'error');
  const isHealthy = !hasErrors && issues.length === 0;
  const exitCode = hasErrors ? 1 : 0;

  const report: CheckReport = {
    projectDir,
    hasPackageJson,
    packageManager,
    nodeModulesInstalled,
    framework,
    frameworkVersion,
    isVite,
    viteConfigPath,
    viteProductionBaseConfigured,
    viteOutDirConfigured,
    viteProxyConfigured,
    cssTool,
    frappeApp: frappeAppReport,
    checks,
    issues,
    recommendations,
    isHealthy,
    exitCode,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    renderTextReport(report);
  }

  return { report, exitCode };
}

function renderTextReport(report: CheckReport): void {
  process.stderr.write(
    '\n' +
      pc.bold('Frappe Frontend Project Diagnostic Report\n') +
      pc.dim('────────────────────────────────────────────────────────────\n') +
      `  ${pc.bold('Project Directory:')} ${report.projectDir}\n` +
      `  ${pc.bold('Framework:')}         ${report.framework}${report.frameworkVersion ? ` (${report.frameworkVersion})` : ''}\n` +
      `  ${pc.bold('Package Manager:')}   ${report.packageManager}\n` +
      `  ${pc.bold('CSS Tooling:')}       ${report.cssTool}\n`
  );

  if (report.frappeApp) {
    process.stderr.write(
      `  ${pc.bold('Frappe Custom App:')} ${report.frappeApp.appName} (${report.frappeApp.appDir})\n` +
        `  ${pc.bold('Frappe Version:')}    ${report.frappeApp.frappeVersion || 'v14 / v15 / v16 compatible'}\n` +
        `  ${pc.bold('SPA Route:')}         /${report.frappeApp.portalRoute}\n`
    );
  }

  process.stderr.write(
    pc.dim('────────────────────────────────────────────────────────────\n') +
      pc.bold('Diagnostics:\n')
  );

  report.checks.forEach((item) => {
    let icon = pc.green('✔');
    if (item.status === 'warn') icon = pc.yellow('!');
    if (item.status === 'error') icon = pc.red('✖');

    const detailStr = item.detail ? pc.dim(` (${item.detail})`) : '';
    process.stderr.write(`  ${icon} ${pc.bold(item.name)}: ${item.message}${detailStr}\n`);
  });

  if (report.issues.length > 0) {
    process.stderr.write(
      '\n' + pc.yellow(pc.bold(`Issues Detected (${report.issues.length}):\n`))
    );
    report.issues.forEach((iss) => {
      process.stderr.write(`  - ${iss}\n`);
    });
  }

  if (report.recommendations.length > 0) {
    process.stderr.write(
      '\n' + pc.cyan(pc.bold('Actionable Recommendations:\n'))
    );
    report.recommendations.forEach((rec) => {
      process.stderr.write(`  - ${rec}\n`);
    });
  }

  process.stderr.write(pc.dim('────────────────────────────────────────────────────────────\n'));

  if (report.isHealthy) {
    process.stderr.write(pc.green(pc.bold('✔ Project diagnostics healthy and verified.\n\n')));
  } else {
    process.stderr.write(
      pc.yellow(
        pc.bold(
          report.exitCode !== 0
            ? '✖ Diagnostic check reported errors.\n\n'
            : '! Diagnostic check reported warnings or incomplete integration.\n\n'
        )
      )
    );
  }
}
