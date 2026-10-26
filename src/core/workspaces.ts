import * as path from 'node:path';
import * as fs from 'node:fs';

export type WorkspaceType = 'npm' | 'pnpm' | 'yarn' | 'none';

export interface WorkspaceInfo {
  type: WorkspaceType;
  isTurborepo: boolean;
  rootDir: string;
  packages: string[];
  isWorkspaceRoot: boolean;
  isWorkspacePackage: boolean;
  currentPackageName?: string;
  turboConfigPath?: string;
}

/**
 * Searches upward from startDir to detect monorepo workspace configurations
 * (npm workspaces, pnpm workspaces, Yarn workspaces, Turborepo).
 */
export function detectWorkspace(startDir: string = process.cwd()): WorkspaceInfo {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  let workspaceRoot: string | undefined;
  let workspaceType: WorkspaceType = 'none';
  let packages: string[] = [];
  let isTurborepo = false;
  let turboConfigPath: string | undefined;

  let currentPkgName: string | undefined;
  const directPkg = path.join(current, 'package.json');
  if (fs.existsSync(directPkg)) {
    try {
      const data = JSON.parse(fs.readFileSync(directPkg, 'utf8'));
      currentPkgName = data.name;
    } catch {
      // ignore
    }
  }

  // Scan current and ancestor directories
  let scanDir = current;
  while (scanDir !== root) {
    const pnpmWorkspaceFile = path.join(scanDir, 'pnpm-workspace.yaml');
    const turboFile = path.join(scanDir, 'turbo.json');
    const pkgJsonFile = path.join(scanDir, 'package.json');

    if (fs.existsSync(turboFile)) {
      isTurborepo = true;
      turboConfigPath = turboFile;
    }

    if (fs.existsSync(pnpmWorkspaceFile)) {
      workspaceType = 'pnpm';
      workspaceRoot = scanDir;
      try {
        const content = fs.readFileSync(pnpmWorkspaceFile, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('-')) {
            packages.push(trimmed.replace(/^-\s*['"]?/, '').replace(/['"]?$/, ''));
          }
        }
      } catch {
        // ignore
      }
      break;
    }

    if (fs.existsSync(pkgJsonFile)) {
      try {
        const pkgData = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));
        if (pkgData.workspaces) {
          workspaceType = fs.existsSync(path.join(scanDir, 'yarn.lock')) ? 'yarn' : 'npm';
          workspaceRoot = scanDir;
          if (Array.isArray(pkgData.workspaces)) {
            packages = pkgData.workspaces;
          } else if (pkgData.workspaces && Array.isArray(pkgData.workspaces.packages)) {
            packages = pkgData.workspaces.packages;
          }
          break;
        }
      } catch {
        // ignore
      }
    }

    scanDir = path.dirname(scanDir);
  }

  const isWorkspaceRoot = Boolean(workspaceRoot && path.resolve(workspaceRoot) === current);
  const isWorkspacePackage = Boolean(workspaceRoot && !isWorkspaceRoot && fs.existsSync(directPkg));

  return {
    type: workspaceType,
    isTurborepo,
    rootDir: workspaceRoot || current,
    packages,
    isWorkspaceRoot,
    isWorkspacePackage,
    currentPackageName: currentPkgName,
    turboConfigPath,
  };
}
