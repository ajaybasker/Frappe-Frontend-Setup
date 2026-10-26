export type SupportedFramework = 'vue' | 'react';
export type SupportedLanguage = 'ts' | 'js';
export type SupportedPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ScaffoldOptions {
  projectName: string;
  targetDir: string;
  framework: SupportedFramework;
  language: SupportedLanguage;
  packageManager?: SupportedPackageManager;
  skipInstall?: boolean;
  skipBuild?: boolean;
}

export interface GeneratedFile {
  relativePath: string;
  content: string;
}

export interface FrameworkAdapter {
  readonly id: SupportedFramework;
  readonly name: string;
  getFiles(options: { projectName: string; language: SupportedLanguage }): GeneratedFile[];
}

export interface ScaffoldResult {
  success: boolean;
  targetDir: string;
  projectName: string;
  framework: SupportedFramework;
  language: SupportedLanguage;
  packageManager: SupportedPackageManager;
  installed: boolean;
  built: boolean;
  error?: string;
  filesGenerated: number;
}
