import * as fs from 'node:fs';

export interface ViteUpdateResult {
  modified: boolean;
  content: string;
  backupPath?: string;
  description: string;
}

/**
 * Safely updates vite.config.ts or vite.config.js to output production assets
 * to Frappe custom app's public/<outputDir> folder, configure /assets/<app>/<outputDir>/ base,
 * and enable build.manifest: true for cache-safe asset loading.
 */
export function updateViteConfig(
  viteConfigPath: string,
  appName: string,
  dryRun: boolean = false,
  outputDir: string = 'frontend'
): ViteUpdateResult {
  if (!fs.existsSync(viteConfigPath)) {
    throw new Error(`Vite configuration not found at '${viteConfigPath}'.`);
  }

  const originalContent = fs.readFileSync(viteConfigPath, 'utf8');

  const expectedOutDir = `public/${outputDir}`;
  const expectedBase = `/assets/${appName}/${outputDir}`;
  const expectedManifest = 'manifest: true';

  const hasOutDir = originalContent.includes(expectedOutDir);
  const hasBase = originalContent.includes(expectedBase);
  const hasManifest = originalContent.includes(expectedManifest);

  if (hasOutDir && hasBase && hasManifest) {
    return {
      modified: false,
      content: originalContent,
      description: `Vite configuration already specifies Frappe production asset output, base, and build manifest.`,
    };
  }

  let modified = originalContent;

  const baseLine = `  base: process.env.NODE_ENV === 'production' ? '/assets/${appName}/${outputDir}/' : '/',`;
  const buildBlock =
    `  build: {\n` +
    `    outDir: '../${appName}/public/${outputDir}',\n` +
    `    emptyOutDir: true,\n` +
    `    manifest: true,\n` +
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

  // 2. Inject or update build block
  if (modified.includes('build: {')) {
    // If build block exists, ensure outDir and manifest are set
    if (!hasOutDir) {
      modified = modified.replace(
        /outDir:\s*['"][^'"]*['"]/,
        `outDir: '../${appName}/public/${outputDir}'`
      );
      if (!modified.includes(`public/${outputDir}`)) {
        modified = modified.replace(
          /build:\s*\{/,
          `build: {\n    outDir: '../${appName}/public/${outputDir}',\n    emptyOutDir: true,`
        );
      }
    }
    if (!hasManifest) {
      modified = modified.replace(/build:\s*\{/, `build: {\n    manifest: true,`);
    }
  } else {
    // Insert new build block after baseLine or defineConfig({
    if (modified.includes(baseLine)) {
      modified = modified.replace(baseLine, `${baseLine}\n${buildBlock}`);
    } else {
      modified = modified.replace(/defineConfig\(\{/, `defineConfig({\n${buildBlock}`);
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
    description: `Configured Vite production base ('/assets/${appName}/${outputDir}/'), outDir ('../${appName}/public/${outputDir}'), and manifest: true`,
  };
}
