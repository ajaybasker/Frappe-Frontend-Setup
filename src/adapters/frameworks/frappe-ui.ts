import { FrameworkAdapter, GeneratedFile, SupportedLanguage } from './types';

export class FrappeUIAdapter implements FrameworkAdapter {
  readonly id = 'frappe-ui' as const;
  readonly name = 'Frappe UI (Vue 3 + Vite + Tailwind CSS v3)';

  getFiles(options: {
    projectName: string;
    language: SupportedLanguage;
    backendUrl?: string;
  }): GeneratedFile[] {
    const isTs = options.language === 'ts';
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
      dependencies: {
        vue: '^3.5.13',
        'vue-router': '^4.5.0',
        'frappe-ui': '^1.0.2',
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^5.2.1',
        vite: '^6.1.0',
        tailwindcss: '^3.4.17',
        postcss: '^8.4.49',
        autoprefixer: '^10.4.20',
        '@tailwindcss/forms': '^0.5.10',
        ...(isTs ? { typescript: '^5.7.2' } : {}),
      },
    };

    const viteConfigContent = isTs
      ? `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

// Proxy target defaults to development target if not specified via environment
const backendUrl = process.env.FRAPPE_BACKEND_URL || '${backendTarget}'

export default defineConfig({
  plugins: [vue()],
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
`
      : `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

// Proxy target defaults to development target if not specified via environment
const backendUrl = process.env.FRAPPE_BACKEND_URL || '${backendTarget}'

export default defineConfig({
  plugins: [vue()],
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

    const tailwindConfigContent = `import frappeUIPreset from 'frappe-ui/tailwind'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

    const postCssConfigContent = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

    const mainExt = isTs ? 'ts' : 'js';
    const mainContent = `import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { FrappeUI } from 'frappe-ui'

const app = createApp(App)
app.use(FrappeUI)
app.mount('#app')
`;

    const appVueContent = isTs
      ? `<script setup lang="ts">
import { ref } from 'vue'
import { Button, Dialog, TextInput, Badge } from 'frappe-ui'

const showDialog = ref(false)
const count = ref(0)
const text = ref('')

function increment() {
  count.value++
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
    <div class="max-w-md w-full bg-white rounded-xl shadow-md p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">Frappe UI Starter</h1>
        <Badge theme="green">Connected</Badge>
      </div>

      <p class="text-sm text-gray-600">
        Welcome to your Frappe UI application. Configured with Vue 3, Vite, and Tailwind CSS v3.
      </p>

      <div class="space-y-4">
        <TextInput
          v-model="text"
          label="Sample Input"
          placeholder="Type something..."
        />

        <div class="flex items-center space-x-3">
          <Button theme="blue" @click="increment">
            Clicked {{ count }} times
          </Button>

          <Button variant="outline" @click="showDialog = true">
            Open Dialog
          </Button>
        </div>
      </div>

      <Dialog
        v-model="showDialog"
        :options="{
          title: 'Frappe UI Dialog',
          message: 'This is a real dialog component from frappe-ui.',
          size: 'sm',
        }"
      />
    </div>
  </div>
</template>
`
      : `<script setup>
import { ref } from 'vue'
import { Button, Dialog, TextInput, Badge } from 'frappe-ui'

const showDialog = ref(false)
const count = ref(0)
const text = ref('')

function increment() {
  count.value++
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
    <div class="max-w-md w-full bg-white rounded-xl shadow-md p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">Frappe UI Starter</h1>
        <Badge theme="green">Connected</Badge>
      </div>

      <p class="text-sm text-gray-600">
        Welcome to your Frappe UI application. Configured with Vue 3, Vite, and Tailwind CSS v3.
      </p>

      <div class="space-y-4">
        <TextInput
          v-model="text"
          label="Sample Input"
          placeholder="Type something..."
        />

        <div class="flex items-center space-x-3">
          <Button theme="blue" @click="increment">
            Clicked {{ count }} times
          </Button>

          <Button variant="outline" @click="showDialog = true">
            Open Dialog
          </Button>
        </div>
      </div>

      <Dialog
        v-model="showDialog"
        :options="{
          title: 'Frappe UI Dialog',
          message: 'This is a real dialog component from frappe-ui.',
          size: 'sm',
        }"
      />
    </div>
  </div>
</template>
`;

    const styleContent = `@tailwind base;
@tailwind components;
@tailwind utilities;
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

    const tsConfigContent = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"]
}
`;

    const jsConfigContent = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "jsx": "preserve"
  },
  "include": ["src/**/*"]
}
`;

    const npmrcContent = `legacy-peer-deps=true\n`;

    const gitignoreContent = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
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

    const files: GeneratedFile[] = [
      {
        relativePath: 'package.json',
        content: JSON.stringify(packageJsonContent, null, 2) + '\n',
      },
      {
        relativePath: '.npmrc',
        content: npmrcContent,
      },
      {
        relativePath: isTs ? 'vite.config.ts' : 'vite.config.js',
        content: viteConfigContent,
      },
      {
        relativePath: 'postcss.config.js',
        content: postCssConfigContent,
      },
      {
        relativePath: 'tailwind.config.js',
        content: tailwindConfigContent,
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
        relativePath: 'src/App.vue',
        content: appVueContent,
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
