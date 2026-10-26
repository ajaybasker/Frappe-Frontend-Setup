import * as path from 'node:path';
import * as fs from 'node:fs';

export interface FrappeAppInfo {
  appName: string;
  appDir: string;
  benchDir?: string;
  hasHooks: boolean;
  hooksPath?: string;
  hasPyprojectOrSetup: boolean;
  hasFrontendDir: boolean;
  frontendDir: string;
  frontendStructure: {
    hasPackageJson: boolean;
    isVite: boolean;
    framework?: string;
  };
}

export interface BenchAppsDiscovery {
  benchDir: string;
  allApps: string[];
  customApps: string[];
}

export interface FrappeAppValidationResult {
  valid: boolean;
  app?: FrappeAppInfo;
  error?: string;
  candidateApps?: string[];
}

/**
 * Searches upward from startDir to detect a Frappe bench root.
 * A bench root contains a `sites` directory (with apps.txt or common_site_config.json)
 * and an `apps` directory.
 */
export function findBenchDirectory(startDir: string = process.cwd()): string | undefined {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const sitesDir = path.join(current, 'sites');
    const appsDir = path.join(current, 'apps');

    if (fs.existsSync(sitesDir) && fs.existsSync(appsDir)) {
      const hasAppsTxt = fs.existsSync(path.join(sitesDir, 'apps.txt'));
      const hasCommonConfig = fs.existsSync(path.join(sitesDir, 'common_site_config.json'));
      if (hasAppsTxt || hasCommonConfig) {
        return current;
      }
    }

    current = path.dirname(current);
  }

  return undefined;
}

/**
 * Discovers all apps and custom apps inside a Frappe bench root.
 */
export function findBenchApps(benchDir?: string): BenchAppsDiscovery {
  if (!benchDir || !fs.existsSync(benchDir)) {
    return { benchDir: benchDir || '', allApps: [], customApps: [] };
  }

  const appsDir = path.join(benchDir, 'apps');
  const allApps: string[] = [];

  if (fs.existsSync(appsDir)) {
    try {
      const entries = fs.readdirSync(appsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          allApps.push(entry.name);
        }
      }
    } catch {
      // ignore
    }
  }

  const customApps = allApps.filter((a) => a !== 'frappe');
  return { benchDir, allApps, customApps };
}

/**
 * Validates whether an app exists in the filesystem and is a legitimate Frappe custom app.
 */
export function validateFrappeApp(
  appNameInput: string,
  options: { benchDir?: string; cwd?: string } = {}
): FrappeAppValidationResult {
  const cwd = options.cwd || process.cwd();
  const detectedBench = options.benchDir || findBenchDirectory(cwd);
  const benchApps = findBenchApps(detectedBench);

  const appName = (appNameInput || '').trim();

  if (!appName) {
    const count = benchApps.customApps.length;
    let errorMsg = 'Please specify a Frappe custom app name (e.g. my_custom_app).';
    if (count > 1) {
      errorMsg += `\nMultiple custom apps detected in Bench: ${benchApps.customApps.join(', ')}.\nUse: --app <name>`;
    } else if (count === 1) {
      errorMsg += `\nDetected single custom app in Bench: '${benchApps.customApps[0]}'. Use: --app ${benchApps.customApps[0]}`;
    }
    return {
      valid: false,
      error: errorMsg,
      candidateApps: benchApps.customApps,
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(appName)) {
    return {
      valid: false,
      error: `Invalid app name '${appName}'. Frappe app names should only contain alphanumeric characters, underscores, or hyphens.`,
    };
  }

  const candidateDirs: string[] = [];

  if (detectedBench) {
    candidateDirs.push(path.join(detectedBench, 'apps', appName));
  }

  candidateDirs.push(path.join(cwd, 'apps', appName));
  candidateDirs.push(path.join(cwd, appName));

  // Also check if cwd itself is the app directory
  if (path.basename(cwd) === appName) {
    candidateDirs.push(cwd);
  }

  for (const candidate of candidateDirs) {
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      continue;
    }

    // Check for Frappe app markers: hooks.py in <app>/<appName>/hooks.py or <app>/hooks.py
    let hooksPath: string | undefined;
    const nestedHooks = path.join(resolved, appName, 'hooks.py');
    const directHooks = path.join(resolved, 'hooks.py');

    if (fs.existsSync(nestedHooks)) {
      hooksPath = nestedHooks;
    } else if (fs.existsSync(directHooks)) {
      hooksPath = directHooks;
    }

    const hasPyproject = fs.existsSync(path.join(resolved, 'pyproject.toml'));
    const hasSetupPy = fs.existsSync(path.join(resolved, 'setup.py'));
    const hasSetupCfg = fs.existsSync(path.join(resolved, 'setup.cfg'));
    const hasPyprojectOrSetup = hasPyproject || hasSetupPy || hasSetupCfg;

    // A valid Frappe app must have hooks.py or pyproject/setup.py
    if (hooksPath || hasPyprojectOrSetup) {
      const frontendDir = path.join(resolved, 'frontend');
      const hasFrontendDir = fs.existsSync(frontendDir) && fs.statSync(frontendDir).isDirectory();

      let hasPackageJson = false;
      let isVite = false;
      let framework: string | undefined;

      const pkgPath = path.join(frontendDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        hasPackageJson = true;
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          isVite = Boolean(deps['vite']);
          if (deps['frappe-ui']) {
            framework = 'frappe-ui';
          } else if (deps['vue']) {
            framework = 'vue';
          } else if (deps['react']) {
            framework = 'react';
          }
        } catch {
          // invalid json
        }
      }

      return {
        valid: true,
        app: {
          appName,
          appDir: resolved,
          benchDir: detectedBench,
          hasHooks: Boolean(hooksPath),
          hooksPath,
          hasPyprojectOrSetup,
          hasFrontendDir,
          frontendDir,
          frontendStructure: {
            hasPackageJson,
            isVite,
            framework,
          },
        },
      };
    }
  }

  const searched = candidateDirs.map((d) => path.resolve(d)).join('\n  - ');
  return {
    valid: false,
    error:
      `Frappe custom app '${appName}' was not found or is missing hooks.py / pyproject.toml.\n` +
      `Looked in:\n  - ${searched}\n` +
      `Make sure the app exists in the bench 'apps' directory or supply an existing path.`,
  };
}
