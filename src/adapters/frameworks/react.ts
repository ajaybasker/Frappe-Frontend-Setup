import { FrameworkAdapter, GeneratedFile, SupportedLanguage } from './types';

export class ReactAdapter implements FrameworkAdapter {
  public readonly id = 'react' as const;
  public readonly name = 'React + Vite';

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
        build: isTs ? 'tsc -b && vite build' : 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^6.1.0',
        ...(isTs
          ? {
              '@types/react': '^18.3.18',
              '@types/react-dom': '^18.3.5',
              typescript: '~5.7.2',
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
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
`;
    files.push({
      relativePath: isTs ? 'vite.config.ts' : 'vite.config.js',
      content: viteConfig,
    });

    // 3. tsconfig.json (if TS) or jsconfig.json (if JS)
    if (isTs) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowJs: true,
          checkJs: false,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
        },
        include: ['src'],
      };
      files.push({
        relativePath: 'tsconfig.json',
        content: JSON.stringify(tsconfig, null, 2) + '\n',
      });

      files.push({
        relativePath: 'src/vite-env.d.ts',
        content: `/// <reference types="vite/client" />\n`,
      });
    } else {
      const jsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: false,
          jsx: 'react-jsx',
        },
        include: ['src'],
      };
      files.push({
        relativePath: 'jsconfig.json',
        content: JSON.stringify(jsconfig, null, 2) + '\n',
      });
    }

    // 4. index.html
    const scriptSrc = isTs ? '/src/main.tsx' : '/src/main.jsx';
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} - React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptSrc}"></script>
  </body>
</html>
`;
    files.push({
      relativePath: 'index.html',
      content: indexHtml,
    });

    // 5. src/main.(tsx|jsx)
    const rootLookup = isTs
      ? "document.getElementById('root')!"
      : "document.getElementById('root')";

    const mainScript = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

ReactDOM.createRoot(${rootLookup}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
    files.push({
      relativePath: isTs ? 'src/main.tsx' : 'src/main.jsx',
      content: mainScript,
    });

    // 6. src/App.(tsx|jsx)
    const appScript = `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="frappe-app">
      <header className="header">
        <div className="badge">Frappe Frontend &bull; React</div>
        <h1>${projectName}</h1>
        <p className="subtitle">Scaffolded with frappe-frontend-cli</p>
      </header>

      <main className="main-card">
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          Count is: <strong>{count}</strong>
        </button>
        <p className="hint">Edit <code>src/App.${isTs ? 'tsx' : 'jsx'}</code> to start building your frontend.</p>
      </main>
    </div>
  );
}
`;
    files.push({
      relativePath: isTs ? 'src/App.tsx' : 'src/App.jsx',
      content: appScript,
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
  color: #1e293b;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#root {
  width: 100%;
}

.frappe-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  text-align: center;
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
  background-color: #f0fdf4;
  color: #15803d;
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

This is a React + Vite project scaffolded with [frappe-frontend-cli](https://github.com/ajaybasker/Frappe-Frontend-Setup).

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
