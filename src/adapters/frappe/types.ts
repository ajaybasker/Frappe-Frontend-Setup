import { FrappeAppInfo } from '../../core/frappe-app';
import { SupportedFramework } from '../frameworks/types';

export interface FrappeIntegrationOptions {
  app?: string;
  benchDir?: string;
  frontendDir?: string;
  route?: string;
  check?: boolean;
  dryRun?: boolean;
  skipBuild?: boolean;
  yes?: boolean;
  cwd?: string;
}

export interface FrappeIntegrationInspection {
  benchDir?: string;
  frappeVersion?: string;
  app: FrappeAppInfo;
  frontendDir: string;
  hasFrontend: boolean;
  framework: SupportedFramework | 'unknown';
  isVite: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  viteConfigPath?: string;
  viteConfiguredForProduction: boolean;
  viteBaseConfigured: boolean;
  viteOutDirConfigured: boolean;
  hooksPath: string;
  hooksConfigured: boolean;
  route: string;
  wwwPyPath: string;
  wwwPyExists: boolean;
  wwwHtmlPath: string;
  wwwHtmlExists: boolean;
  publicFrontendDir: string;
  publicFrontendExists: boolean;
  publicFrontendHasAssets: boolean;
  isFullyIntegrated: boolean;
  missingRequirements: string[];
}

export interface FileChangeRecord {
  filePath: string;
  action: 'created' | 'modified' | 'preserved';
  backupPath?: string;
  description: string;
  diff?: string;
}

export interface FrappeIntegrationResult {
  success: boolean;
  app: string;
  route: string;
  benchDir?: string;
  frontendDir: string;
  publicDir: string;
  installed: boolean;
  built: boolean;
  checkMode: boolean;
  dryRun: boolean;
  filesChanged: FileChangeRecord[];
  isFullyIntegrated: boolean;
  error?: string;
  exitCode: number;
}
