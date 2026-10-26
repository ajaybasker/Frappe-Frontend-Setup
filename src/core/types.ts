/**
 * Core type definitions for Frappe Frontend Setup CLI
 */

export interface OsFacts {
  platform: NodeJS.Platform;
  release: string;
  arch: string;
  isLinux: boolean;
  isMac: boolean;
  isWindows: boolean;
  isWsl: boolean;
}

export interface NodeFacts {
  version: string;
  major: number;
  minor: number;
  patch: number;
  path: string;
}

export interface PackageManagerInfo {
  name: 'npm' | 'pnpm' | 'yarn' | 'bun';
  version: string;
  path: string;
}

export interface PackageManagersFacts {
  npm?: PackageManagerInfo;
  pnpm?: PackageManagerInfo;
  yarn?: PackageManagerInfo;
  bun?: PackageManagerInfo;
  available: string[];
  preferred: 'npm' | 'pnpm' | 'yarn' | 'bun';
}

export interface GitFacts {
  available: boolean;
  version?: string;
  path?: string;
}

export interface BenchFacts {
  cliAvailable: boolean;
  cliVersion?: string;
  cliPath?: string;
  isInsideBench: boolean;
  benchRoot?: string;
  allApps?: string[];
  customApps?: string[];
  isInsideApp: boolean;
  appName?: string;
  appRoot?: string;
}

export interface EnvironmentFacts {
  os: OsFacts;
  node: NodeFacts;
  packageManagers: PackageManagersFacts;
  git: GitFacts;
  bench: BenchFacts;
  workspace?: {
    type: string;
    isTurborepo: boolean;
    rootDir: string;
    packages: string[];
  };
  cwd: string;
}

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface CheckItem {
  id: string;
  category: 'os' | 'node' | 'package-manager' | 'git' | 'bench';
  title: string;
  status: CheckStatus;
  message: string;
  hint?: string;
}

export interface DoctorReport {
  timestamp: string;
  healthy: boolean;
  facts: EnvironmentFacts;
  checks: CheckItem[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
  };
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}
