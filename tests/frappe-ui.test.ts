import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { defaultRunner } from '../src/core/runner';

describe('Frappe UI Framework Adapter & Scaffolding', () => {
  const runner = defaultRunner;
  const cliBin = path.resolve(__dirname, '../../bin/frappe-frontend-cli.js');
  let tempBaseDir: string;

  before(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffc-fui-test-'));
  });

  after(async () => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  test('rejects React + Frappe UI combination when created directly', async () => {
    const res = await runner.run(cliBin, ['create', 'frappe-ui', 'test-app', '--framework', 'react'], {
      cwd: tempBaseDir,
    });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Frappe UI is built exclusively for Vue 3 and does not support React'));
  });

  test('scaffolds Frappe UI TypeScript project with --skip-install and verifies files', async () => {
    const projectName = 'fui-ts-app';
    const targetDir = path.join(tempBaseDir, projectName);
    const customBackend = 'http://frappe.localhost:8000';

    const res = await runner.run(
      cliBin,
      ['create', 'frappe-ui', projectName, '--ts', '--backend-url', customBackend, '--skip-install'],
      { cwd: tempBaseDir }
    );

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stderr.includes('Successfully created fui-ts-app'));

    // Verify key files exist
    assert.ok(fs.existsSync(path.join(targetDir, 'package.json')), 'package.json exists');
    assert.ok(fs.existsSync(path.join(targetDir, '.npmrc')), '.npmrc exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'vite.config.ts')), 'vite.config.ts exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'tailwind.config.js')), 'tailwind.config.js exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'postcss.config.js')), 'postcss.config.js exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'src/App.vue')), 'src/App.vue exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'src/main.ts')), 'src/main.ts exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'src/style.css')), 'src/style.css exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'tsconfig.json')), 'tsconfig.json exists');

    // Inspect package.json
    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.name, projectName);
    assert.ok(pkg.dependencies['frappe-ui'], 'frappe-ui dependency is present');
    assert.ok(pkg.dependencies['vue'], 'vue dependency is present');
    assert.ok(pkg.devDependencies['tailwindcss'], 'tailwindcss dependency is present');
    assert.strictEqual(pkg.devDependencies['tailwindcss'], '^3.4.17', 'Tailwind pinned to v3');

    // Inspect tailwind.config.js
    const twConfig = fs.readFileSync(path.join(targetDir, 'tailwind.config.js'), 'utf8');
    assert.ok(twConfig.includes("import frappeUIPreset from 'frappe-ui/tailwind'"));
    assert.ok(twConfig.includes('presets: [frappeUIPreset]'));
    assert.ok(twConfig.includes('./node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}'));

    // Inspect .npmrc
    const npmrc = fs.readFileSync(path.join(targetDir, '.npmrc'), 'utf8');
    assert.ok(npmrc.includes('legacy-peer-deps=true'));

    // Inspect vite.config.ts for proxy and custom backend URL
    const viteConfig = fs.readFileSync(path.join(targetDir, 'vite.config.ts'), 'utf8');
    assert.ok(viteConfig.includes(customBackend));
    assert.ok(viteConfig.includes("'^/(api|assets|files)'"));

    // Inspect src/App.vue for actual Frappe UI components
    const appVue = fs.readFileSync(path.join(targetDir, 'src/App.vue'), 'utf8');
    assert.ok(appVue.includes("import { Button, Dialog, TextInput, Badge } from 'frappe-ui'"));
    assert.ok(appVue.includes('<Button'));
    assert.ok(appVue.includes('<TextInput'));
    assert.ok(appVue.includes('<Dialog'));
    assert.ok(appVue.includes('<Badge'));
  });

  test('scaffolds Frappe UI JavaScript project with --skip-install and verifies files', async () => {
    const projectName = 'fui-js-app';
    const targetDir = path.join(tempBaseDir, projectName);

    const res = await runner.run(
      cliBin,
      ['create', 'frappe-ui', projectName, '--js', '--skip-install'],
      { cwd: tempBaseDir }
    );

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stderr.includes('Successfully created fui-js-app'));

    // Verify JS specific files exist
    assert.ok(fs.existsSync(path.join(targetDir, 'vite.config.js')), 'vite.config.js exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'src/main.js')), 'src/main.js exists');
    assert.ok(fs.existsSync(path.join(targetDir, 'jsconfig.json')), 'jsconfig.json exists');
    assert.strictEqual(fs.existsSync(path.join(targetDir, 'tsconfig.json')), false);

    // Verify default proxy URL is http://127.0.0.1:8000
    const viteConfig = fs.readFileSync(path.join(targetDir, 'vite.config.js'), 'utf8');
    assert.ok(viteConfig.includes('http://127.0.0.1:8000'));
  });

  test('end-to-end: Frappe UI project scaffolds, installs, and builds successfully', async () => {
    const projectName = 'fui-e2e-app';
    const targetDir = path.join(tempBaseDir, projectName);

    const res = await runner.run(
      cliBin,
      ['create', 'frappe-ui', projectName, '--ts'],
      { cwd: tempBaseDir, timeoutMs: 180_000 }
    );

    assert.strictEqual(res.exitCode, 0, `Creation failed: ${res.stderr}\n${res.stdout}`);
    assert.ok(res.stderr.includes('Production build verified successfully'));

    // Verify build output directory
    const distDir = path.join(targetDir, 'dist');
    assert.ok(fs.existsSync(distDir), 'dist/ directory created');
    assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html created');

    const assetsDir = path.join(distDir, 'assets');
    assert.ok(fs.existsSync(assetsDir), 'dist/assets directory created');
    const assetFiles = fs.readdirSync(assetsDir);
    assert.ok(assetFiles.some((f) => f.endsWith('.js')), 'JS bundle created');
    assert.ok(assetFiles.some((f) => f.endsWith('.css')), 'CSS bundle created');
  });
});
