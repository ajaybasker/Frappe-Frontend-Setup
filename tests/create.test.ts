import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Runner } from '../src/core/runner';

describe('Project Creation (Vue & React Framework Adapters)', () => {
  const runner = new Runner();
  const cliBin = path.resolve(__dirname, '../../bin/frappe-frontend-cli.js');
  let tempBaseDir: string;

  before(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-phase2-tests-'));
  });

  after(() => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  test('refuses to create project with invalid name', async () => {
    const res = await runner.run(cliBin, ['create', 'vue', 'bad name with spaces'], {
      cwd: tempBaseDir,
    });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Invalid project name'));
  });

  test('refuses to overwrite existing non-empty directory', async () => {
    const existingDir = path.join(tempBaseDir, 'existing-project');
    fs.mkdirSync(existingDir, { recursive: true });
    fs.writeFileSync(path.join(existingDir, 'important-file.txt'), 'do not delete');

    const res = await runner.run(cliBin, ['create', 'vue', existingDir]);
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('is not empty'));
    // Ensure existing file was preserved
    assert.ok(fs.existsSync(path.join(existingDir, 'important-file.txt')));
  });

  test('rejects unsupported framework template with helpful message', async () => {
    const res = await runner.run(cliBin, ['create', 'angular', 'my-app'], {
      cwd: tempBaseDir,
    });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes("Unsupported template 'angular'"));
  });

  test('rejects React + Frappe UI combination with clear explanation', async () => {
    const res = await runner.run(cliBin, ['create', 'react-frappe-ui', 'my-ui-app'], {
      cwd: tempBaseDir,
    });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Frappe UI is built exclusively for Vue 3 and does not support React'));
  });

  test('rejects unsupported package manager option', async () => {
    const targetDir = path.join(tempBaseDir, 'test-pm-invalid');
    const res = await runner.run(cliBin, ['create', 'vue', targetDir, '--package-manager', 'invalidpm']);
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes("Unsupported package manager 'invalidpm'"));
  });

  test('rejects uninstalled package manager with actionable error', async () => {
    const targetDir = path.join(tempBaseDir, 'test-pm-missing');
    // Using a fake package manager or bun if not installed
    const res = await runner.run(cliBin, ['create', 'vue', targetDir, '--package-manager', 'bun']);
    if (res.exitCode !== 0) {
      assert.ok(res.stderr.includes('is not installed or not available on PATH'));
    }
  });

  test('scaffolds Vue TypeScript project with --skip-install and verifies files', async () => {
    const targetDir = path.join(tempBaseDir, 'vue-ts-scaffold');
    const res = await runner.run(cliBin, ['create', 'vue', targetDir, '--ts', '--skip-install']);

    assert.strictEqual(res.exitCode, 0);
    assert.ok(fs.existsSync(path.join(targetDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'vite.config.ts')));
    assert.ok(fs.existsSync(path.join(targetDir, 'tsconfig.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'src/main.ts')));
    assert.ok(fs.existsSync(path.join(targetDir, 'src/App.vue')));

    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.name, 'vue-ts-scaffold');
    assert.ok(pkg.dependencies.vue);
    assert.ok(pkg.devDependencies['@vitejs/plugin-vue']);
    assert.ok(pkg.devDependencies['vue-tsc']);
  });

  test('scaffolds React JavaScript project with --skip-install and verifies files', async () => {
    const targetDir = path.join(tempBaseDir, 'react-js-scaffold');
    const res = await runner.run(cliBin, ['create', 'react', targetDir, '--js', '--skip-install']);

    assert.strictEqual(res.exitCode, 0);
    assert.ok(fs.existsSync(path.join(targetDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'vite.config.js')));
    assert.ok(fs.existsSync(path.join(targetDir, 'src/main.jsx')));
    assert.ok(fs.existsSync(path.join(targetDir, 'src/App.jsx')));

    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.name, 'react-js-scaffold');
    assert.ok(pkg.dependencies.react);
    assert.ok(pkg.devDependencies['@vitejs/plugin-react']);
  });

  // Full end-to-end project creation, npm install, and build verification:
  test('end-to-end: Vue TypeScript project scaffolds, installs, and builds successfully', { timeout: 120_000 }, async () => {
    const targetDir = path.join(tempBaseDir, 'e2e-vue-ts');
    const res = await runner.run(cliBin, ['create', 'vue', targetDir, '--ts'], { timeoutMs: 120_000 });

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stderr.includes('Production build verified successfully'));
    assert.ok(fs.existsSync(path.join(targetDir, 'dist/index.html')));
    assert.ok(fs.existsSync(path.join(targetDir, 'dist/assets')));
  });

  test('end-to-end: React TypeScript project scaffolds, installs, and builds successfully', { timeout: 120_000 }, async () => {
    const targetDir = path.join(tempBaseDir, 'e2e-react-ts');
    const res = await runner.run(cliBin, ['create', 'react', targetDir, '--ts'], { timeoutMs: 120_000 });

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stderr.includes('Production build verified successfully'));
    assert.ok(fs.existsSync(path.join(targetDir, 'dist/index.html')));
    assert.ok(fs.existsSync(path.join(targetDir, 'dist/assets')));
  });

  test('end-to-end: Vue JavaScript project scaffolds, installs, and builds successfully', { timeout: 120_000 }, async () => {
    const targetDir = path.join(tempBaseDir, 'e2e-vue-js');
    const res = await runner.run(cliBin, ['create', 'vue', targetDir, '--js'], { timeoutMs: 120_000 });

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stderr.includes('Production build verified successfully'));
    assert.ok(fs.existsSync(path.join(targetDir, 'dist/index.html')));
  });

  test('end-to-end: React JavaScript project scaffolds, installs, and builds successfully', { timeout: 120_000 }, async () => {
    const targetDir = path.join(tempBaseDir, 'e2e-react-js');
    const res = await runner.run(cliBin, ['create', 'react', targetDir, '--js'], { timeoutMs: 120_000 });

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stderr.includes('Production build verified successfully'));
    assert.ok(fs.existsSync(path.join(targetDir, 'dist/index.html')));
  });
});
