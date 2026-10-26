import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Runner, defaultRunner } from './runner';
import {
  EnvironmentFacts,
  OsFacts,
  NodeFacts,
  PackageManagersFacts,
  GitFacts,
  BenchFacts,
  PackageManagerInfo,
} from './types';
import { parseSemver } from './matrix';
import { findBenchApps } from './frappe-app';
import { detectWorkspace } from './workspaces';

function isWsl(): boolean {
  if (process.platform !== 'linux') return false;
  try {
    const release = os.release().toLowerCase();
    if (release.includes('microsoft') || release.includes('wsl')) return true;
    if (fs.existsSync('/proc/version')) {
      const ver = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      return ver.includes('microsoft') || ver.includes('wsl');
    }
  } catch {
    // ignore
  }
  return false;
}

export function detectOs(): OsFacts {
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();

  return {
    platform,
    release,
    arch,
    isLinux: platform === 'linux',
    isMac: platform === 'darwin',
    isWindows: platform === 'win32',
    isWsl: isWsl(),
  };
}

export function detectNode(): NodeFacts {
  const version = process.version;
  const parsed = parseSemver(version) || { major: 0, minor: 0, patch: 0 };
  return {
    version,
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    path: process.execPath,
  };
}

export async function detectPackageManager(
  name: 'npm' | 'pnpm' | 'yarn' | 'bun',
  runner: Runner
): Promise<PackageManagerInfo | undefined> {
  try {
    const res = await runner.run(name, ['--version'], { timeoutMs: 5000 });
    if (res.exitCode === 0 && res.stdout.trim()) {
      return {
        name,
        version: res.stdout.trim().split('\n')[0].trim(),
        path: name, // resolved via PATH
      };
    }
  } catch {
    // not found on PATH or failed to execute
  }
  return undefined;
}

export async function detectPackageManagers(runner: Runner): Promise<PackageManagersFacts> {
  const [npm, pnpm, yarn, bun] = await Promise.all([
    detectPackageManager('npm', runner),
    detectPackageManager('pnpm', runner),
    detectPackageManager('yarn', runner),
    detectPackageManager('bun', runner),
  ]);

  const available: string[] = [];
  if (pnpm) available.push('pnpm');
  if (npm) available.push('npm');
  if (yarn) available.push('yarn');
  if (bun) available.push('bun');

  // Preferred order: pnpm > npm > yarn > bun (pnpm is fast and disk-efficient)
  // Default to npm if present, otherwise first available, fallback 'npm'
  const preferred: 'npm' | 'pnpm' | 'yarn' | 'bun' = pnpm ? 'pnpm' : (npm ? 'npm' : (yarn ? 'yarn' : (bun ? 'bun' : 'npm')));

  return {
    npm,
    pnpm,
    yarn,
    bun,
    available,
    preferred,
  };
}

export async function detectGit(runner: Runner): Promise<GitFacts> {
  try {
    const res = await runner.run('git', ['--version'], { timeoutMs: 5000 });
    if (res.exitCode === 0 && res.stdout.trim()) {
      const match = res.stdout.match(/git version\s+([\d.]+)/i);
      return {
        available: true,
        version: match ? match[1] : res.stdout.trim(),
        path: 'git',
      };
    }
  } catch {
    // Git not available
  }
  return { available: false };
}

export async function detectBench(runner: Runner, searchCwd: string): Promise<BenchFacts> {
  let cliAvailable = false;
  let cliVersion: string | undefined;

  try {
    const res = await runner.run('bench', ['--version'], { timeoutMs: 5000 });
    if (res.exitCode === 0 && res.stdout.trim()) {
      cliAvailable = true;
      cliVersion = res.stdout.trim().split('\n')[0].trim();
    }
  } catch {
    // bench CLI not on PATH
  }

  // Scan current and parent directories for Frappe Bench markers
  let currentDir = path.resolve(searchCwd);
  let isInsideBench = false;
  let benchRoot: string | undefined;
  let isInsideApp = false;
  let appName: string | undefined;
  let appRoot: string | undefined;

  // Check upwards until root
  while (true) {
    // Check if this directory looks like a Frappe Bench
    const appsDir = path.join(currentDir, 'apps');
    const sitesDir = path.join(currentDir, 'sites');
    const frappeApp = path.join(appsDir, 'frappe');

    if (fs.existsSync(appsDir) && fs.existsSync(sitesDir) && fs.existsSync(frappeApp)) {
      isInsideBench = true;
      benchRoot = currentDir;
      break;
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  // Check if searchCwd is inside a Frappe custom app
  let appScan = path.resolve(searchCwd);
  while (true) {
    const hooksPy = path.join(appScan, 'hooks.py');
    if (fs.existsSync(hooksPy)) {
      isInsideApp = true;
      appRoot = appScan;
      appName = path.basename(appScan);
      break;
    }
    // Also check if app directory contains [appName]/hooks.py
    const dirEntries = tryReadDir(appScan);
    if (dirEntries) {
      for (const entry of dirEntries) {
        if (entry.isDirectory()) {
          const nestedHooks = path.join(appScan, entry.name, 'hooks.py');
          if (fs.existsSync(nestedHooks)) {
            isInsideApp = true;
            appRoot = appScan;
            appName = entry.name;
            break;
          }
        }
      }
      if (isInsideApp) break;
    }

    const parent = path.dirname(appScan);
    if (parent === appScan) break;
    appScan = parent;
  }

  const appsDiscovery = benchRoot ? findBenchApps(benchRoot) : { allApps: [], customApps: [] };

  return {
    cliAvailable,
    cliVersion,
    cliPath: cliAvailable ? 'bench' : undefined,
    isInsideBench,
    benchRoot,
    allApps: appsDiscovery.allApps,
    customApps: appsDiscovery.customApps,
    isInsideApp,
    appName,
    appRoot,
  };
}

function tryReadDir(dir: string): fs.Dirent[] | null {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

export async function gatherFacts(
  runner: Runner = defaultRunner,
  searchCwd: string = process.cwd()
): Promise<EnvironmentFacts> {
  const [packageManagers, git, bench] = await Promise.all([
    detectPackageManagers(runner),
    detectGit(runner),
    detectBench(runner, searchCwd),
  ]);

  const workspace = detectWorkspace(searchCwd);

  return {
    os: detectOs(),
    node: detectNode(),
    packageManagers,
    git,
    bench,
    workspace:
      workspace.type !== 'none' || workspace.isTurborepo
        ? {
            type: workspace.type,
            isTurborepo: workspace.isTurborepo,
            rootDir: workspace.rootDir,
            packages: workspace.packages,
          }
        : undefined,
    cwd: path.resolve(searchCwd),
  };
}
