import * as path from 'node:path';
import * as fs from 'node:fs';
import { validateFrappeApp, findBenchDirectory } from '../../core/frappe-app';
import { FrappeIntegrationInspection, FrappeIntegrationOptions } from './types';
import { SupportedFramework } from '../frameworks/types';

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

  // 1. Resolve custom app
  let appName = (options.app || '').trim();

  // If no app is explicitly specified, check if cwd is an app or frontend inside an app
  if (!appName) {
    // Check if cwd is inside a frontend folder whose parent is an app
    if (path.basename(cwd) === 'frontend') {
      const parentDir = path.dirname(cwd);
      const pkgJson = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgJson)) {
        appName = path.basename(parentDir);
      }
    } else {
      // Check if cwd has hooks.py
      const directHooks = path.join(cwd, 'hooks.py');
      const nestedHooks = path.join(cwd, path.basename(cwd), 'hooks.py');
      if (fs.existsSync(directHooks) || fs.existsSync(nestedHooks)) {
        appName = path.basename(cwd);
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

  const benchDir = options.benchDir ? path.resolve(options.benchDir) : findBenchDirectory(cwd);
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

  // If frontendDir does not exist, check if cwd is itself the frontend project
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

  // 4. Inspect Vite Configuration
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

  if (viteConfigPath) {
    try {
      const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
      const expectedOutDir = `public/frontend`;
      const expectedBase = `/assets/${app.appName}/frontend`;

      viteOutDirConfigured = viteContent.includes(expectedOutDir);
      viteBaseConfigured = viteContent.includes(expectedBase);
    } catch {
      // ignore
    }
  }

  const viteConfiguredForProduction = Boolean(viteConfigPath && viteBaseConfigured && viteOutDirConfigured);

  // 5. Inspect Route and Hooks
  const route = (options.route || 'frontend').trim().replace(/^\/+|\/+$/g, '');
  const hooksPath = app.hooksPath || path.join(app.appDir, app.appName, 'hooks.py');

  let hooksConfigured = false;
  if (fs.existsSync(hooksPath)) {
    try {
      const hooksContent = fs.readFileSync(hooksPath, 'utf8');
      const routeRulePattern = new RegExp(`["']\\/${route}\\/<path:app_path>["']`, 'i');
      hooksConfigured = routeRulePattern.test(hooksContent) || hooksContent.includes(`to_route": "${route}"`) || hooksContent.includes(`to_route': '${route}'`);
    } catch {
      // ignore
    }
  }

  // 6. Inspect www/ portal files
  const pythonPkgDir = path.dirname(hooksPath);
  const wwwDir = path.join(pythonPkgDir, 'www');
  const wwwPyPath = path.join(wwwDir, `${route}.py`);
  const wwwHtmlPath = path.join(wwwDir, `${route}.html`);

  const wwwPyExists = fs.existsSync(wwwPyPath);
  const wwwHtmlExists = fs.existsSync(wwwHtmlPath);

  // 7. Inspect public/frontend directory and assets
  const publicDir = path.join(pythonPkgDir, 'public');
  const publicFrontendDir = path.join(publicDir, 'frontend');
  const publicFrontendExists = fs.existsSync(publicFrontendDir);

  let publicFrontendHasAssets = false;
  if (publicFrontendExists) {
    try {
      const files = fs.readdirSync(publicFrontendDir);
      const hasIndexHtml = files.includes('index.html');
      const hasAssetsSubdir = files.includes('assets') && fs.existsSync(path.join(publicFrontendDir, 'assets'));
      publicFrontendHasAssets = hasIndexHtml || hasAssetsSubdir;
    } catch {
      // ignore
    }
  }

  // 8. Determine missing requirements
  const missingRequirements: string[] = [];
  if (!hasFrontend) {
    missingRequirements.push(`Frontend directory '${frontendDir}' with package.json is missing.`);
  }
  if (!viteConfigPath) {
    missingRequirements.push(`Vite configuration file (vite.config.ts / vite.config.js) not found.`);
  } else if (!viteConfiguredForProduction) {
    if (!viteOutDirConfigured) {
      missingRequirements.push(`Vite build.outDir is not configured to output to '../${app.appName}/public/frontend'.`);
    }
    if (!viteBaseConfigured) {
      missingRequirements.push(`Vite production base is not set to '/assets/${app.appName}/frontend/'.`);
    }
  }
  if (!hooksConfigured) {
    missingRequirements.push(`website_route_rules in '${hooksPath}' is not configured for route '/${route}'.`);
  }
  if (!wwwPyExists) {
    missingRequirements.push(`Portal route controller '${wwwPyPath}' is missing.`);
  }
  if (!wwwHtmlExists) {
    missingRequirements.push(`Portal route template '${wwwHtmlPath}' is missing.`);
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
      frontendDir,
      hasFrontend,
      framework,
      isVite,
      packageManager,
      viteConfigPath,
      viteConfiguredForProduction,
      viteBaseConfigured,
      viteOutDirConfigured,
      hooksPath,
      hooksConfigured,
      route,
      wwwPyPath,
      wwwPyExists,
      wwwHtmlPath,
      wwwHtmlExists,
      publicFrontendDir,
      publicFrontendExists,
      publicFrontendHasAssets,
      isFullyIntegrated,
      missingRequirements,
    },
  };
}
