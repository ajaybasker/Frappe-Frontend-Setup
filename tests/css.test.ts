import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Runner } from '../src/core/runner';

describe('CSS Tooling Adapters (Tailwind, Bootstrap, SCSS)', () => {
  const runner = new Runner();
  const cliBin = path.resolve(__dirname, '../../bin/frappe-frontend-cli.js');
  let tempBaseDir: string;

  before(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-phase3-css-'));
  });

  after(() => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  test('refuses to add CSS tools when not inside a project (missing package.json)', async () => {
    const emptyDir = path.join(tempBaseDir, 'no-pkg');
    fs.mkdirSync(emptyDir, { recursive: true });

    const res = await runner.run(cliBin, ['add', 'tailwind'], { cwd: emptyDir });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('No package.json found'));
  });

  test('refuses to add CSS tools when project is not a recognized Vite project', async () => {
    const nonViteDir = path.join(tempBaseDir, 'non-vite');
    fs.mkdirSync(nonViteDir, { recursive: true });
    fs.writeFileSync(
      path.join(nonViteDir, 'package.json'),
      JSON.stringify({ name: 'non-vite-project', dependencies: {} }),
      'utf8'
    );

    const res = await runner.run(cliBin, ['add', 'tailwind'], { cwd: nonViteDir });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('not a recognized Vite project'));
  });

  test('refuses unsupported CSS tool name', async () => {
    const dummyViteDir = path.join(tempBaseDir, 'dummy-vite');
    fs.mkdirSync(dummyViteDir, { recursive: true });
    fs.writeFileSync(
      path.join(dummyViteDir, 'package.json'),
      JSON.stringify({ name: 'dummy', devDependencies: { vite: '^6.0.0' } }),
      'utf8'
    );

    const res = await runner.run(cliBin, ['add', 'bulma'], { cwd: dummyViteDir });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes("Unsupported CSS tool 'bulma'"));
  });

  test('Tailwind v4 integration with Vue TypeScript project', { timeout: 180_000 }, async () => {
    const projectDir = path.join(tempBaseDir, 'vue-tailwind-v4');
    // 1. Scaffold Vue project
    const createRes = await runner.run(cliBin, ['create', 'vue', projectDir, '--ts']);
    assert.strictEqual(createRes.exitCode, 0);

    // 2. Add Tailwind CSS v4
    const addRes = await runner.run(cliBin, ['add', 'tailwind'], { cwd: projectDir, timeoutMs: 120_000 });
    assert.strictEqual(addRes.exitCode, 0);
    assert.ok(addRes.stderr.includes('Successfully configured Tailwind CSS V4'));

    // Check files and configurations
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    assert.ok(pkg.devDependencies['@tailwindcss/vite']);
    assert.ok(pkg.devDependencies['tailwindcss']);

    const viteConfig = fs.readFileSync(path.join(projectDir, 'vite.config.ts'), 'utf8');
    assert.ok(viteConfig.includes('@tailwindcss/vite'));
    assert.ok(viteConfig.includes('tailwindcss()'));

    const cssContent = fs.readFileSync(path.join(projectDir, 'src/style.css'), 'utf8');
    assert.ok(cssContent.includes('@import "tailwindcss";'));

    // Verify build artifact
    assert.ok(fs.existsSync(path.join(projectDir, 'dist/index.html')));

    // 3. Test idempotency: calling add tailwind again should not duplicate
    const secondRes = await runner.run(cliBin, ['add', 'tailwind'], { cwd: projectDir });
    assert.strictEqual(secondRes.exitCode, 0);
    assert.ok(secondRes.stderr.includes('already configured'));

    // Verify vite.config.ts has only ONE import of @tailwindcss/vite
    const updatedViteConfig = fs.readFileSync(path.join(projectDir, 'vite.config.ts'), 'utf8');
    const importCount = (updatedViteConfig.match(/@tailwindcss\/vite/g) || []).length;
    assert.strictEqual(importCount, 1);
  });

  test('Tailwind v3 compatibility integration with React project', { timeout: 180_000 }, async () => {
    const projectDir = path.join(tempBaseDir, 'react-tailwind-v3');
    // 1. Scaffold React project
    const createRes = await runner.run(cliBin, ['create', 'react', projectDir, '--ts']);
    assert.strictEqual(createRes.exitCode, 0);

    // 2. Add Tailwind CSS v3
    const addRes = await runner.run(cliBin, ['add', 'tailwind', '--v3'], { cwd: projectDir, timeoutMs: 120_000 });
    assert.strictEqual(addRes.exitCode, 0);
    assert.ok(addRes.stderr.includes('Successfully configured Tailwind CSS V3'));

    // Check files and configurations
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    assert.ok(pkg.devDependencies['tailwindcss'].includes('3.4'));
    assert.ok(pkg.devDependencies['postcss']);
    assert.ok(pkg.devDependencies['autoprefixer']);

    assert.ok(fs.existsSync(path.join(projectDir, 'tailwind.config.js')));
    assert.ok(fs.existsSync(path.join(projectDir, 'postcss.config.js')));

    const cssContent = fs.readFileSync(path.join(projectDir, 'src/style.css'), 'utf8');
    assert.ok(cssContent.includes('@tailwind base;'));
    assert.ok(cssContent.includes('@tailwind components;'));
    assert.ok(cssContent.includes('@tailwind utilities;'));

    // Verify build succeeds
    assert.ok(fs.existsSync(path.join(projectDir, 'dist/index.html')));

    // 3. Test idempotency
    const secondRes = await runner.run(cliBin, ['add', 'tailwind', '--v3'], { cwd: projectDir });
    assert.strictEqual(secondRes.exitCode, 0);
    assert.ok(secondRes.stderr.includes('already configured'));
  });

  test('Refuses to mix Tailwind v3 and v4 in the same project', async () => {
    const projectDir = path.join(tempBaseDir, 'react-tailwind-v3'); // already has v3 from previous test
    const res = await runner.run(cliBin, ['add', 'tailwind', '--v4'], { cwd: projectDir });
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Mixing Tailwind v3 and v4 is not supported'));
  });

  test('Bootstrap 5 integration with Vue project', { timeout: 180_000 }, async () => {
    const projectDir = path.join(tempBaseDir, 'vue-bootstrap');
    // 1. Scaffold Vue project
    const createRes = await runner.run(cliBin, ['create', 'vue', projectDir, '--js']);
    assert.strictEqual(createRes.exitCode, 0);

    // 2. Add Bootstrap
    const addRes = await runner.run(cliBin, ['add', 'bootstrap'], { cwd: projectDir, timeoutMs: 120_000 });
    assert.strictEqual(addRes.exitCode, 0);
    assert.ok(addRes.stderr.includes('Successfully configured Bootstrap 5'));

    // Check package.json dependencies
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies['bootstrap']);
    assert.ok(pkg.dependencies['@popperjs/core']);

    // Check entry script import
    const mainScript = fs.readFileSync(path.join(projectDir, 'src/main.js'), 'utf8');
    assert.ok(mainScript.includes('bootstrap/dist/css/bootstrap.min.css'));

    // Verify build artifact
    assert.ok(fs.existsSync(path.join(projectDir, 'dist/index.html')));

    // 3. Test idempotency
    const secondRes = await runner.run(cliBin, ['add', 'bootstrap'], { cwd: projectDir });
    assert.strictEqual(secondRes.exitCode, 0);
    assert.ok(secondRes.stderr.includes('already configured'));
  });

  test('SCSS integration with React project', { timeout: 180_000 }, async () => {
    const projectDir = path.join(tempBaseDir, 'react-scss');
    // 1. Scaffold React project
    const createRes = await runner.run(cliBin, ['create', 'react', projectDir, '--ts']);
    assert.strictEqual(createRes.exitCode, 0);

    // 2. Add SCSS
    const addRes = await runner.run(cliBin, ['add', 'scss'], { cwd: projectDir, timeoutMs: 120_000 });
    assert.strictEqual(addRes.exitCode, 0);
    assert.ok(addRes.stderr.includes('Successfully configured SCSS'));

    // Check package.json devDependencies
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
    assert.ok(pkg.devDependencies['sass-embedded']);

    // Check stylesheet migration
    assert.ok(fs.existsSync(path.join(projectDir, 'src/style.scss')));
    assert.ok(!fs.existsSync(path.join(projectDir, 'src/style.css')));

    // Check main.tsx import updated
    const mainScript = fs.readFileSync(path.join(projectDir, 'src/main.tsx'), 'utf8');
    assert.ok(mainScript.includes('./style.scss'));

    // Verify SCSS build artifact
    assert.ok(fs.existsSync(path.join(projectDir, 'dist/index.html')));

    // 3. Test idempotency
    const secondRes = await runner.run(cliBin, ['add', 'scss'], { cwd: projectDir });
    assert.strictEqual(secondRes.exitCode, 0);
    assert.ok(secondRes.stderr.includes('already configured'));
  });
});
