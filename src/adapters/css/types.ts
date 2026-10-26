export type SupportedCssTool = 'tailwind' | 'bootstrap' | 'scss';
export type TailwindVersion = 'v3' | 'v4';

export interface ProjectInspection {
  targetDir: string;
  hasPackageJson: boolean;
  packageJson?: {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  framework: 'vue' | 'react' | 'unknown';
  isVite: boolean;
  isTs: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  viteConfigPath?: string;
  mainScriptPath?: string;
  styleSheetPath?: string;
  existingCssTools: {
    tailwindV3: boolean;
    tailwindV4: boolean;
    bootstrap: boolean;
    sass: boolean;
  };
}

export interface AddCssOptions {
  targetDir?: string;
  version?: TailwindVersion; // For tailwind: 'v3' | 'v4' (default 'v4')
  skipInstall?: boolean;
  skipBuild?: boolean;
  cwd?: string;
}

export interface AddCssResult {
  success: boolean;
  tool: SupportedCssTool;
  targetDir: string;
  installed: boolean;
  built: boolean;
  alreadyConfigured: boolean;
  error?: string;
  exitCode: number;
}
