import * as fs from 'node:fs';

export interface ViteUpdateResult {
  modified: boolean;
  content: string;
  backupPath?: string;
  description: string;
}

/**
 * Safely updates vite.config.ts or vite.config.js to output production assets
 * to Frappe custom app's public/frontend folder and use /assets/<app>/frontend/ base.
 */
export function updateViteConfig(
  viteConfigPath: string,
  appName: string,
  dryRun: boolean = false
): ViteUpdateResult {
  if (!fs.existsSync(viteConfigPath)) {
    throw new Error(`Vite configuration not found at '${viteConfigPath}'.`);
  }

  const originalContent = fs.readFileSync(viteConfigPath, 'utf8');

  const expectedOutDir = `public/frontend`;
  const expectedBase = `/assets/${appName}/frontend`;

  const hasOutDir = originalContent.includes(expectedOutDir);
  const hasBase = originalContent.includes(expectedBase);

  if (hasOutDir && hasBase) {
    return {
      modified: false,
      content: originalContent,
      description: `Vite configuration already specifies Frappe production asset output and base.`,
    };
  }

  let modified = originalContent;

  const baseLine = `  base: process.env.NODE_ENV === 'production' ? '/assets/${appName}/frontend/' : '/',`;
  const buildBlock =
    `  build: {\n` +
    `    outDir: '../${appName}/public/frontend',\n` +
    `    emptyOutDir: true,\n` +
    `  },`;

  // 1. Inject or update base
  if (!hasBase) {
    if (modified.includes('base:')) {
      modified = modified.replace(/base:\s*['"][^'"]*['"],?/, baseLine);
    } else {
      // Insert after defineConfig({
      modified = modified.replace(/defineConfig\(\{/, `defineConfig({\n${baseLine}`);
    }
  }

  // 2. Inject or update build.outDir
  if (!hasOutDir) {
    if (modified.includes('build: {')) {
      modified = modified.replace(
        /build:\s*\{([^}]*)\}/,
        `build: {\n    outDir: '../${appName}/public/frontend',\n    emptyOutDir: true,$1}`
      );
    } else {
      // Insert after baseLine or defineConfig({
      if (modified.includes(baseLine)) {
        modified = modified.replace(baseLine, `${baseLine}\n${buildBlock}`);
      } else {
        modified = modified.replace(/defineConfig\(\{/, `defineConfig({\n${buildBlock}`);
      }
    }
  }

  let backupPath: string | undefined;

  if (!dryRun && modified !== originalContent) {
    const timestamp = Date.now();
    backupPath = `${viteConfigPath}.bak.${timestamp}`;
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    fs.writeFileSync(viteConfigPath, modified, 'utf8');
  }

  return {
    modified: modified !== originalContent,
    content: modified,
    backupPath,
    description: `Configured Vite production base ('/assets/${appName}/frontend/') and outDir ('../${appName}/public/frontend')`,
  };
}
