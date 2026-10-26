import * as path from 'node:path';
import * as fs from 'node:fs';
import { validateFrappeApp, findBenchDirectory, findBenchApps } from '../../core/frappe-app';
import { detectWorkspace } from '../../core/workspaces';
import { FrappeIntegrationInspection, FrappeIntegrationOptions } from './types';
import { SupportedFramework } from '../frameworks/types';
import { detectAppModule } from './desk-page-generator';

/**
 * Detects Frappe version from the bench directory if available.
 */
export function detectBenchFrappeVersion(benchDir?: string): string | undefined {
  if (!benchDir) return undefined;

  // Check apps/frappe/pyproject.toml
  const pyprojectPath = path.join(benchDir, 'apps', 'frappe', 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      const match = content.match(/version\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    } catch {
      // ignore
    }
  }

  // Check apps/frappe/frappe/__init__.py
  const initPyPath = path.join(benchDir, 'apps', 'frappe', 'frappe', '__init__.py');
  if (fs.existsSync(initPyPath)) {
    try {
      const content = fs.readFileSync(initPyPath, 'utf8');
      const match = content.match(/__version__\s*=\s*["']([^"']+)["']/);
      if (match) return match[1];
    } catch {
      // ignore
    }
  }

  return undefined;
}

/**
 * Inspects a Frappe custom app and its frontend project to determine current integration status.
 */
export function inspectFrappeIntegration(
  options: FrappeIntegrationOptions
): { success: boolean; inspection?: FrappeIntegrationInspection; error?: string } {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const benchDir = options.benchDir ? path.resolve(options.benchDir) : findBenchDirectory(cwd);
  const benchApps = findBenchApps(benchDir);
  const workspace = detectWorkspace(cwd);

  // 1. Resolve custom app
  let appName = (options.app || '').trim();

  // If no app is explicitly specified, try to infer
  if (!appName) {
    if (path.basename(cwd) === 'frontend') {
      const parentDir = path.dirname(cwd);
      const pkgJson = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgJson)) {
        appName = path.basename(parentDir);
      }
    } else {
      const directHooks = path.join(cwd, 'hooks.py');
      const nestedHooks = path.join(cwd, path.basename(cwd), 'hooks.py');
      if (fs.existsSync(directHooks) || fs.existsSync(nestedHooks)) {
        appName = path.basename(cwd);
      }
    }

    // If still not determined, check benchApps
    if (!appName) {
      if (benchApps.customApps.length === 1) {
        appName = benchApps.customApps[0];
      } else if (benchApps.customApps.length > 1) {
        return {
          success: false,
          error:
            `Multiple Frappe custom apps detected in Bench: ${benchApps.customApps.join(', ')}.\n` +
            `Please specify the target custom app using: --app <app_name> (e.g. --app ${benchApps.customApps[0]})`,
        };
      }
    }
  }

  if (!appName) {
    return {
      success: false,
      error:
        `Could not determine target Frappe custom app.\n` +
        `Please specify the custom app using: --app <app_name> (e.g. npx frappe-frontend-cli integrate frappe --app my_app)`,
    };
  }

  const appValidation = validateFrappeApp(appName, { benchDir, cwd });

  if (!appValidation.valid || !appValidation.app) {
    return {
      success: false,
      error: appValidation.error || `Invalid Frappe custom app '${appName}'.`,
    };
  }

  const app = appValidation.app;
  const frappeVersion = detectBenchFrappeVersion(benchDir);

  // 2. Resolve frontend directory
  let frontendDir = options.frontendDir ? path.resolve(options.frontendDir) : path.join(app.appDir, 'frontend');

  if (!fs.existsSync(frontendDir) && fs.existsSync(path.join(cwd, 'package.json'))) {
    frontendDir = cwd;
  }

  const hasFrontend = fs.existsSync(frontendDir) && fs.existsSync(path.join(frontendDir, 'package.json'));

  // 3. Inspect Frontend structure & Framework
  let framework: SupportedFramework | 'unknown' = 'unknown';
  let isVite = false;
  let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';

  if (hasFrontend) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      isVite = Boolean(deps['vite']);

      if (deps['frappe-ui']) {
        framework = 'frappe-ui';
      } else if (deps['vue']) {
        framework = 'vue';
      } else if (deps['react']) {
        framework = 'react';
      } else if (isVite) {
        framework = 'vanilla';
      }
    } catch {
      // ignore JSON errors
    }

    if (fs.existsSync(path.join(frontendDir, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(frontendDir, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(frontendDir, 'bun.lockb')) || fs.existsSync(path.join(frontendDir, 'bun.lock'))) {
      packageManager = 'bun';
    }
  }

  // 4. Scoped output directory & Route / Page configuration
  const mode = options.mode || 'portal';
  const route = (options.route || 'frontend').trim().replace(/^\/+|\/+$/g, '');
  const pageName = (options.page || 'frontend').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const outputDir = (options.outputDir || (mode === 'desk' ? pageName : 'frontend')).trim().replace(/^\/+|\/+$/g, '');

  // 5. Inspect Vite Configuration
  let viteConfigPath: string | undefined;
  const tsConfig = path.join(frontendDir, 'vite.config.ts');
  const jsConfig = path.join(frontendDir, 'vite.config.js');

  if (fs.existsSync(tsConfig)) {
    viteConfigPath = tsConfig;
  } else if (fs.existsSync(jsConfig)) {
    viteConfigPath = jsConfig;
  }

  let viteBaseConfigured = false;
  let viteOutDirConfigured = false;
  let viteManifestConfigured = false;

  if (viteConfigPath) {
    try {
      const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
      const expectedOutDir = `public/${outputDir}`;
      const expectedBase = `/assets/${app.appName}/${outputDir}`;

      viteOutDirConfigured = viteContent.includes(expectedOutDir);
      viteBaseConfigured = viteContent.includes(expectedBase);
      viteManifestConfigured = viteContent.includes('manifest: true');
    } catch {
      // ignore
    }
  }

  const viteConfiguredForProduction = Boolean(viteConfigPath && viteBaseConfigured && viteOutDirConfigured);

  // 6. Inspect Hooks & Routing
  const hooksPath = app.hooksPath || path.join(app.appDir, app.appName, 'hooks.py');
  let hooksConfigured = false;

  if (mode === 'portal') {
    if (fs.existsSync(hooksPath)) {
      try {
        const hooksContent = fs.readFileSync(hooksPath, 'utf8');
        const routeRulePattern = new RegExp(`["']\\/${route}\\/<path:app_path>["']`, 'i');
        hooksConfigured =
          routeRulePattern.test(hooksContent) ||
          hooksContent.includes(`to_route": "${route}"`) ||
          hooksContent.includes(`to_route': '${route}'`);
      } catch {
        // ignore
      }
    }
  } else {
    // In Desk page mode, hooks.py route rule is not strictly required because Desk routes via Page DocType
    hooksConfigured = true;
  }

  // 7. Inspect Portal or Desk Page files
  const pythonPkgDir = path.dirname(hooksPath);
  const wwwDir = path.join(pythonPkgDir, 'www');
  const wwwPyPath = path.join(wwwDir, `${route}.py`);
  const wwwHtmlPath = path.join(wwwDir, `${route}.html`);
  const wwwPyExists = fs.existsSync(wwwPyPath);
  const wwwHtmlExists = fs.existsSync(wwwHtmlPath);

  // Desk Page paths
  const moduleName = options.module || detectAppModule(pythonPkgDir, app.appName);
  const moduleSlug = moduleName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const deskPageDir = path.join(pythonPkgDir, moduleSlug, 'page', pageName);
  const deskPageJsonExists = fs.existsSync(path.join(deskPageDir, `${pageName}.json`));
  const deskPageJsExists = fs.existsSync(path.join(deskPageDir, `${pageName}.js`));

  // 8. Inspect public/<outputDir> directory and assets
  const publicDir = path.join(pythonPkgDir, 'public');
  const publicFrontendDir = path.join(publicDir, outputDir);
  const publicFrontendExists = fs.existsSync(publicFrontendDir);

  let publicFrontendHasAssets = false;
  let manifestExists = false;
  let totalBundleSizeKb = 0;
  const largeChunks: Array<{ name: string; sizeKb: number }> = [];

  if (publicFrontendExists) {
    try {
      const files = fs.readdirSync(publicFrontendDir);
      const hasIndexHtml = files.includes('index.html');
      const hasAssetsSubdir = files.includes('assets') && fs.existsSync(path.join(publicFrontendDir, 'assets'));
      publicFrontendHasAssets = hasIndexHtml || hasAssetsSubdir;

      // Check for manifest.json or .vite/manifest.json
      manifestExists =
        files.includes('manifest.json') ||
        (files.includes('.vite') && fs.existsSync(path.join(publicFrontendDir, '.vite', 'manifest.json')));

      // Scan chunk sizes in assets directory
      const assetsDir = path.join(publicFrontendDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const assetFiles = fs.readdirSync(assetsDir);
        for (const file of assetFiles) {
          const filePath = path.join(assetsDir, file);
          const stat = fs.statSync(filePath);
          const sizeKb = Math.round(stat.size / 1024);
          totalBundleSizeKb += sizeKb;
          if (sizeKb > 500 && file.endsWith('.js')) {
            largeChunks.push({ name: file, sizeKb });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 9. Determine missing requirements
  const missingRequirements: string[] = [];
  if (!hasFrontend) {
    missingRequirements.push(`Frontend directory '${frontendDir}' with package.json is missing.`);
  }
  if (!viteConfigPath) {
    missingRequirements.push(`Vite configuration file (vite.config.ts / vite.config.js) not found.`);
  } else if (!viteConfiguredForProduction) {
    if (!viteOutDirConfigured) {
      missingRequirements.push(`Vite build.outDir is not configured to output to '../${app.appName}/public/${outputDir}'.`);
    }
    if (!viteBaseConfigured) {
      missingRequirements.push(`Vite production base is not set to '/assets/${app.appName}/${outputDir}/'.`);
    }
  }

  if (mode === 'portal') {
    if (!hooksConfigured) {
      missingRequirements.push(`website_route_rules in '${hooksPath}' is not configured for route '/${route}'.`);
    }
    if (!wwwPyExists) {
      missingRequirements.push(`Portal route controller '${wwwPyPath}' is missing.`);
    }
    if (!wwwHtmlExists) {
      missingRequirements.push(`Portal route template '${wwwHtmlPath}' is missing.`);
    }
  } else {
    // mode === 'desk'
    if (!deskPageJsonExists) {
      missingRequirements.push(`Desk Page DocType JSON in '${deskPageDir}/${pageName}.json' is missing.`);
    }
    if (!deskPageJsExists) {
      missingRequirements.push(`Desk Page controller in '${deskPageDir}/${pageName}.js' is missing.`);
    }
  }

  if (!publicFrontendHasAssets) {
    missingRequirements.push(`Production assets in '${publicFrontendDir}' are missing (project needs to be built).`);
  }

  const isFullyIntegrated = missingRequirements.length === 0;

  return {
    success: true,
    inspection: {
      benchDir,
      frappeVersion,
      app,
      candidateApps: benchApps.customApps,
      frontendDir,
      hasFrontend,
      framework,
      isVite,
      packageManager,
      workspaceType: workspace.type !== 'none' ? workspace.type : undefined,
      viteConfigPath,
      viteConfiguredForProduction,
      viteBaseConfigured,
      viteOutDirConfigured,
      viteManifestConfigured,
      mode,
      route,
      outputDir,
      hooksPath,
      hooksConfigured,
      wwwPyPath,
      wwwPyExists,
      wwwHtmlPath,
      wwwHtmlExists,
      deskPageDir,
      deskPageJsonExists,
      deskPageJsExists,
      publicFrontendDir,
      publicFrontendExists,
      publicFrontendHasAssets,
      manifestExists,
      bundleDiagnostics: {
        totalSizeKb: totalBundleSizeKb,
        largeChunks,
      },
      isFullyIntegrated,
      missingRequirements,
    },
  };
}
