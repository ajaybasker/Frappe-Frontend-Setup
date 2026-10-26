import { FrameworkAdapter, GeneratedFile, SupportedLanguage } from './types';

export class VueAdapter implements FrameworkAdapter {
  public readonly id = 'vue' as const;
  public readonly name = 'Vue 3 + Vite';

  public getFiles(options: { projectName: string; language: SupportedLanguage }): GeneratedFile[] {
    const { projectName, language } = options;
    const isTs = language === 'ts';

    const files: GeneratedFile[] = [];

    // 1. package.json
    const packageJson = {
      name: projectName,
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: isTs ? 'vue-tsc -b && vite build' : 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        vue: '^3.5.13',
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^5.2.1',
        vite: '^6.1.0',
        ...(isTs
          ? {
              typescript: '~5.7.2',
              'vue-tsc': '^2.2.0',
            }
          : {}),
      },
    };
    files.push({
      relativePath: 'package.json',
      content: JSON.stringify(packageJson, null, 2) + '\n',
    });

    // 2. vite.config.(ts|js)
    const viteConfig = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
});
`;
    files.push({
      relativePath: isTs ? 'vite.config.ts' : 'vite.config.js',
      content: viteConfig,
    });

    // 3. tsconfig.json (if TS)
    if (isTs) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          module: 'ESNext',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
        },
        include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue'],
      };
      files.push({
        relativePath: 'tsconfig.json',
        content: JSON.stringify(tsconfig, null, 2) + '\n',
      });

      files.push({
        relativePath: 'src/vite-env.d.ts',
        content: `/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
`,
      });
    }

    // 4. index.html
    const scriptSrc = isTs ? '/src/main.ts' : '/src/main.js';
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} - Vue 3</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${scriptSrc}"></script>
  </body>
</html>
`;
    files.push({
      relativePath: 'index.html',
      content: indexHtml,
    });

    // 5. src/main.(ts|js)
    const mainScript = `import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

createApp(App).mount('#app');
`;
    files.push({
      relativePath: isTs ? 'src/main.ts' : 'src/main.js',
      content: mainScript,
    });

    // 6. src/App.vue
    const scriptTag = isTs ? '<script setup lang="ts">' : '<script setup>';
    const appVue = `${scriptTag}
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <div class="frappe-app">
    <header class="header">
      <div class="badge">Frappe Frontend &bull; Vue 3</div>
      <h1>${projectName}</h1>
      <p class="subtitle">Scaffolded with frappe-frontend-cli</p>
    </header>

    <main class="main-card">
      <button type="button" @click="count++">
        Count is: <strong>{{ count }}</strong>
      </button>
      <p class="hint">Edit <code>src/App.vue</code> to start building your frontend.</p>
    </main>
  </div>
</template>

<style scoped>
.frappe-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  text-align: center;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
}

.header {
  margin-bottom: 2.5rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  background-color: #e0f2fe;
  color: #0369a1;
  margin-bottom: 1rem;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.025em;
}

.subtitle {
  color: #64748b;
  font-size: 1.125rem;
  margin: 0;
}

.main-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

button {
  background-color: #0f172a;
  color: #ffffff;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

button:hover {
  background-color: #334155;
}

.hint {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

code {
  background-color: #e2e8f0;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}
</style>
`;
    files.push({
      relativePath: 'src/App.vue',
      content: appVue,
    });

    // 7. src/style.css
    const styleCss = `*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
}

#app {
  width: 100%;
}
`;
    files.push({
      relativePath: 'src/style.css',
      content: styleCss,
    });

    // 8. .gitignore
    const gitignore = `node_modules
dist
dist-ssr
*.local
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`;
    files.push({
      relativePath: '.gitignore',
      content: gitignore,
    });

    // 9. README.md
    const readme = `# ${projectName}

This is a Vue 3 + Vite project scaffolded with [frappe-frontend-cli](https://github.com/ajaybasker/Frappe-Frontend-Setup).

## Development

\`\`\`bash
npm run dev
\`\`\`

## Production Build

\`\`\`bash
npm run build
\`\`\`
`;
    files.push({
      relativePath: 'README.md',
      content: readme,
    });

    return files;
  }
}
