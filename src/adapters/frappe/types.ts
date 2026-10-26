import { FrappeAppInfo } from '../../core/frappe-app';
import { SupportedFramework } from '../frameworks/types';

export interface FrappeIntegrationOptions {
  app?: string;
  benchDir?: string;
  frontendDir?: string;
  route?: string;
  mode?: 'portal' | 'desk';
  page?: string;
  pageTitle?: string;
  module?: string;
  outputDir?: string;
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
  candidateApps?: string[];
  frontendDir: string;
  hasFrontend: boolean;
  framework: SupportedFramework | 'unknown';
  isVite: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  workspaceType?: string;
  viteConfigPath?: string;
  viteConfiguredForProduction: boolean;
  viteBaseConfigured: boolean;
  viteOutDirConfigured: boolean;
  viteManifestConfigured: boolean;
  mode: 'portal' | 'desk';
  route: string;
  outputDir: string;
  hooksPath: string;
  hooksConfigured: boolean;
  wwwPyPath: string;
  wwwPyExists: boolean;
  wwwHtmlPath: string;
  wwwHtmlExists: boolean;
  deskPageDir?: string;
  deskPageJsonExists?: boolean;
  deskPageJsExists?: boolean;
  publicFrontendDir: string;
  publicFrontendExists: boolean;
  publicFrontendHasAssets: boolean;
  manifestExists: boolean;
  bundleDiagnostics?: {
    totalSizeKb: number;
    largeChunks: Array<{ name: string; sizeKb: number }>;
  };
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
