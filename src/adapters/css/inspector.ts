import * as path from 'node:path';
import * as fs from 'node:fs';
import { ProjectInspection } from './types';

export function inspectProject(targetDir: string): ProjectInspection {
  const resolvedDir = path.resolve(targetDir);
  const pkgPath = path.join(resolvedDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return {
      targetDir: resolvedDir,
      hasPackageJson: false,
      framework: 'unknown',
      isVite: false,
      isTs: false,
      packageManager: 'npm',
      existingCssTools: {
        tailwindV3: false,
        tailwindV4: false,
        bootstrap: false,
        sass: false,
      },
    };
  }

  let packageJson: ProjectInspection['packageJson'];
  try {
    packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    packageJson = undefined;
  }

  const allDeps: Record<string, string> = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };

  // 1. Detect Vite
  const isVite = Boolean(allDeps['vite'] || fs.existsSync(path.join(resolvedDir, 'vite.config.ts')) || fs.existsSync(path.join(resolvedDir, 'vite.config.js')));

  // 2. Detect Framework
  let framework: 'vue' | 'react' | 'unknown' = 'unknown';
  if (allDeps['vue'] || allDeps['@vitejs/plugin-vue']) {
    framework = 'vue';
  } else if (allDeps['react'] || allDeps['@vitejs/plugin-react']) {
    framework = 'react';
  }

  // 3. Detect Package Manager from lockfiles
  let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
  if (fs.existsSync(path.join(resolvedDir, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (fs.existsSync(path.join(resolvedDir, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (fs.existsSync(path.join(resolvedDir, 'bun.lockb')) || fs.existsSync(path.join(resolvedDir, 'bun.lock'))) {
    packageManager = 'bun';
  } else if (fs.existsSync(path.join(resolvedDir, 'package-lock.json'))) {
    packageManager = 'npm';
  }

  // 4. Detect TypeScript
  const isTs = fs.existsSync(path.join(resolvedDir, 'tsconfig.json')) || fs.existsSync(path.join(resolvedDir, 'vite.config.ts'));

  // 5. Locate vite.config.(ts|js|mjs|cjs)
  let viteConfigPath: string | undefined;
  for (const candidate of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']) {
    const full = path.join(resolvedDir, candidate);
    if (fs.existsSync(full)) {
      viteConfigPath = full;
      break;
    }
  }

  // 6. Locate main script entry
  let mainScriptPath: string | undefined;
  for (const candidate of [
    'src/main.ts',
    'src/main.tsx',
    'src/main.js',
    'src/main.jsx',
    'src/index.ts',
    'src/index.tsx',
    'src/index.js',
    'src/index.jsx',
  ]) {
    const full = path.join(resolvedDir, candidate);
    if (fs.existsSync(full)) {
      mainScriptPath = full;
      break;
    }
  }

  // 7. Locate stylesheet
  let styleSheetPath: string | undefined;
  for (const candidate of [
    'src/style.scss',
    'src/style.css',
    'src/main.scss',
    'src/main.css',
    'src/index.scss',
    'src/index.css',
    'src/App.css',
  ]) {
    const full = path.join(resolvedDir, candidate);
    if (fs.existsSync(full)) {
      styleSheetPath = full;
      break;
    }
  }

  // 8. Detect Existing CSS Tools
  const tailwindV4 = Boolean(
    allDeps['@tailwindcss/vite'] ||
      (styleSheetPath && fs.existsSync(styleSheetPath) && fs.readFileSync(styleSheetPath, 'utf8').includes('@import "tailwindcss"'))
  );

  const tailwindV3 = Boolean(
    !tailwindV4 &&
      (fs.existsSync(path.join(resolvedDir, 'tailwind.config.js')) ||
        fs.existsSync(path.join(resolvedDir, 'tailwind.config.ts')) ||
        (styleSheetPath && fs.existsSync(styleSheetPath) && fs.readFileSync(styleSheetPath, 'utf8').includes('@tailwind')))
  );

  const bootstrap = Boolean(
    allDeps['bootstrap'] ||
      (mainScriptPath && fs.existsSync(mainScriptPath) && fs.readFileSync(mainScriptPath, 'utf8').includes('bootstrap'))
  );

  const sass = Boolean(
    allDeps['sass'] ||
      allDeps['sass-embedded'] ||
      (styleSheetPath && styleSheetPath.endsWith('.scss'))
  );

  return {
    targetDir: resolvedDir,
    hasPackageJson: true,
    packageJson,
    framework,
    isVite,
    isTs,
    packageManager,
    viteConfigPath,
    mainScriptPath,
    styleSheetPath,
    existingCssTools: {
      tailwindV3,
      tailwindV4,
      bootstrap,
      sass,
    },
  };
}
