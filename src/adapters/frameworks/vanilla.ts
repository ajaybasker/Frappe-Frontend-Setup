import { FrameworkAdapter, GeneratedFile, SupportedLanguage } from './types';

export class VanillaAdapter implements FrameworkAdapter {
  readonly id = 'vanilla' as const;
  readonly name = 'Vanilla (Vite)';

  getFiles(options: {
    projectName: string;
    language: SupportedLanguage;
    backendUrl?: string;
  }): GeneratedFile[] {
    const isTs = options.language === 'ts';
    const mainExt = isTs ? 'ts' : 'js';
    const backendTarget = options.backendUrl || 'http://127.0.0.1:8000';

    const packageJsonContent = {
      name: options.projectName,
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      devDependencies: {
        vite: '^6.1.0',
        ...(isTs ? { typescript: '^5.7.2' } : {}),
      },
    };

    const viteConfigContent = `import { defineConfig } from 'vite'
import path from 'node:path'

const backendUrl = process.env.FRAPPE_BACKEND_URL || '${backendTarget}'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      '^/(api|assets|files)': {
        target: backendUrl,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
`;

    const indexHtmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.${mainExt}"></script>
  </body>
</html>
`;

    const mainContent = `import './style.css'

const app = document.querySelector<HTMLDivElement>('#app') || document.querySelector('#app')
if (app) {
  app.innerHTML = \`
    <div style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center;">
      <h1>\${${JSON.stringify(options.projectName)}}</h1>
      <p>Vanilla Vite Frontend for Frappe</p>
    </div>
  \`
}
`;

    const styleContent = `body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}
`;

    const tsConfigContent = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "allowJs": true,
    "checkJs": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.js"]
}
`;

    const jsConfigContent = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false
  },
  "include": ["src/**/*"]
}
`;

    const gitignoreContent = `# Logs
logs
*.log
node_modules
dist
dist-ssr
*.local
.DS_Store
`;

    const files: GeneratedFile[] = [
      {
        relativePath: 'package.json',
        content: JSON.stringify(packageJsonContent, null, 2) + '\n',
      },
      {
        relativePath: isTs ? 'vite.config.ts' : 'vite.config.js',
        content: viteConfigContent,
      },
      {
        relativePath: 'index.html',
        content: indexHtmlContent,
      },
      {
        relativePath: 'src/style.css',
        content: styleContent,
      },
      {
        relativePath: `src/main.${mainExt}`,
        content: mainContent,
      },
      {
        relativePath: '.gitignore',
        content: gitignoreContent,
      },
    ];

    if (isTs) {
      files.push({
        relativePath: 'tsconfig.json',
        content: tsConfigContent,
      });
      files.push({
        relativePath: 'src/vite-env.d.ts',
        content: '/// <reference types="vite/client" />\n',
      });
    } else {
      files.push({
        relativePath: 'jsconfig.json',
        content: jsConfigContent,
      });
    }

    return files;
  }
}
