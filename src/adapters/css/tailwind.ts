import * as path from 'node:path';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { ProjectInspection, AddCssOptions, AddCssResult } from './types';
import { Runner } from '../../core/runner';

export async function addTailwind(
  inspection: ProjectInspection,
  options: AddCssOptions,
  runner: Runner
): Promise<AddCssResult> {
  const { targetDir, viteConfigPath, styleSheetPath, packageManager } = inspection;
  const version = options.version || 'v4';

  // Check if already configured
  if (version === 'v4' && inspection.existingCssTools.tailwindV4) {
    process.stderr.write(pc.cyan(`ℹ Tailwind CSS v4 is already configured in ${targetDir}.\n`));
    return {
      success: true,
      tool: 'tailwind',
      targetDir,
      installed: true,
      built: true,
      alreadyConfigured: true,
      exitCode: 0,
    };
  }

  if (version === 'v3' && inspection.existingCssTools.tailwindV3) {
    process.stderr.write(pc.cyan(`ℹ Tailwind CSS v3 is already configured in ${targetDir}.\n`));
    return {
      success: true,
      tool: 'tailwind',
      targetDir,
      installed: true,
      built: true,
      alreadyConfigured: true,
      exitCode: 0,
    };
  }

  // Conflict prevention: do not mix v3 and v4
  if (version === 'v4' && inspection.existingCssTools.tailwindV3) {
    const errorMsg =
      `Project already has Tailwind CSS v3 configured. Mixing Tailwind v3 and v4 is not supported.\n` +
      `To upgrade to v4, remove existing tailwind.config and postcss.config first.`;
    process.stderr.write(pc.red(`x ${errorMsg}\n`));
    return {
      success: false,
      tool: 'tailwind',
      targetDir,
      installed: false,
      built: false,
      alreadyConfigured: false,
      error: errorMsg,
      exitCode: 1,
    };
  }

  if (version === 'v3' && inspection.existingCssTools.tailwindV4) {
    const errorMsg =
      `Project already has Tailwind CSS v4 configured. Mixing Tailwind v3 and v4 is not supported.`;
    process.stderr.write(pc.red(`x ${errorMsg}\n`));
    return {
      success: false,
      tool: 'tailwind',
      targetDir,
      installed: false,
      built: false,
      alreadyConfigured: false,
      error: errorMsg,
      exitCode: 1,
    };
  }

  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = inspection.packageJson || JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.devDependencies = pkg.devDependencies || {};

  // Ensure stylesheet exists
  const cssFile = styleSheetPath || path.join(targetDir, 'src/style.css');
  if (!fs.existsSync(cssFile)) {
    fs.mkdirSync(path.dirname(cssFile), { recursive: true });
    fs.writeFileSync(cssFile, '/* Styles */\n', 'utf8');
  }

  if (version === 'v4') {
    process.stderr.write(pc.cyan(`Configuring Tailwind CSS v4 (@tailwindcss/vite)...\n`));

    // 1. Dependencies
    pkg.devDependencies['tailwindcss'] = '^4.0.0';
    pkg.devDependencies['@tailwindcss/vite'] = '^4.0.0';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // 2. Vite Config Integration
    if (viteConfigPath && fs.existsSync(viteConfigPath)) {
      let configContent = fs.readFileSync(viteConfigPath, 'utf8');
      if (!configContent.includes('@tailwindcss/vite')) {
        configContent = `import tailwindcss from '@tailwindcss/vite';\n` + configContent;
        // Insert tailwindcss() into plugins array
        configContent = configContent.replace(/plugins:\s*\[/, 'plugins: [tailwindcss(), ');
        fs.writeFileSync(viteConfigPath, configContent, 'utf8');
      }
    }

    // 3. Stylesheet Integration
    let cssContent = fs.readFileSync(cssFile, 'utf8');
    if (!cssContent.includes('@import "tailwindcss"') && !cssContent.includes("@import 'tailwindcss'")) {
      cssContent = `@import "tailwindcss";\n\n` + cssContent;
      fs.writeFileSync(cssFile, cssContent, 'utf8');
    }
  } else {
    process.stderr.write(pc.cyan(`Configuring Tailwind CSS v3 (compatibility mode)...\n`));

    // 1. Dependencies
    pkg.devDependencies['tailwindcss'] = '^3.4.17';
    pkg.devDependencies['postcss'] = '^8.4.49';
    pkg.devDependencies['autoprefixer'] = '^10.4.20';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // 2. tailwind.config.js
    const tailwindConfigPath = path.join(targetDir, 'tailwind.config.js');
    if (!fs.existsSync(tailwindConfigPath)) {
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
      fs.writeFileSync(tailwindConfigPath, tailwindConfig, 'utf8');
    }

    // 3. postcss.config.js
    const postcssConfigPath = path.join(targetDir, 'postcss.config.js');
    if (!fs.existsSync(postcssConfigPath)) {
      const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
      fs.writeFileSync(postcssConfigPath, postcssConfig, 'utf8');
    }

    // 4. Stylesheet Integration
    let cssContent = fs.readFileSync(cssFile, 'utf8');
    if (!cssContent.includes('@tailwind')) {
      cssContent = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n` + cssContent;
      fs.writeFileSync(cssFile, cssContent, 'utf8');
    }
  }

  // 4. Install Dependencies
  let installed = false;
  if (!options.skipInstall) {
    process.stderr.write(pc.cyan(`Installing dependencies with ${packageManager}...\n`));
    const installArgs = packageManager === 'yarn' ? [] : ['install'];
    const installRes = await runner.run(packageManager, installArgs, {
      cwd: targetDir,
      timeoutMs: 180_000,
    });

    if (installRes.exitCode !== 0) {
      process.stderr.write(
        pc.red(`\nx Failed to install Tailwind dependencies:\n`) +
          installRes.stderr +
          installRes.stdout +
          '\n' +
          pc.yellow(`  Recovery: cd "${targetDir}" && ${packageManager} install\n`)
      );
      return {
        success: false,
        tool: 'tailwind',
        targetDir,
        installed: false,
        built: false,
        alreadyConfigured: false,
        error: `Installation failed with exit code ${installRes.exitCode}`,
        exitCode: installRes.exitCode,
      };
    }
    installed = true;

    // 5. Verification Build
    if (!options.skipBuild) {
      process.stderr.write(pc.cyan(`Verifying project build (${packageManager} run build)...\n`));
      const buildArgs = packageManager === 'yarn' ? ['build'] : ['run', 'build'];
      const buildRes = await runner.run(packageManager, buildArgs, {
        cwd: targetDir,
        timeoutMs: 120_000,
      });

      if (buildRes.exitCode !== 0) {
        process.stderr.write(
          pc.red(`\nx Project build verification failed with Tailwind CSS:\n`) +
            buildRes.stderr +
            buildRes.stdout +
            '\n'
        );
        return {
          success: false,
          tool: 'tailwind',
          targetDir,
          installed: true,
          built: false,
          alreadyConfigured: false,
          error: `Build verification failed with exit code ${buildRes.exitCode}`,
          exitCode: buildRes.exitCode,
        };
      }
    }
  }

  process.stderr.write(pc.green(`✔ Successfully configured Tailwind CSS ${version.toUpperCase()} in ${targetDir}!\n`));
  return {
    success: true,
    tool: 'tailwind',
    targetDir,
    installed,
    built: !options.skipBuild && installed,
    alreadyConfigured: false,
    exitCode: 0,
  };
}
