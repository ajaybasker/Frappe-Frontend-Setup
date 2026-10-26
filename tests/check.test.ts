import { test, describe, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runCheck } from '../src/cli/check';

describe('Project Inspection & Health Diagnostics (Phase 5 check)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-check-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('reports error and exit code 1 when package.json is missing', async () => {
    const emptyDir = path.join(tmpDir, 'empty-project');
    fs.mkdirSync(emptyDir, { recursive: true });

    const { report, exitCode } = await runCheck({ cwd: emptyDir });

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(report.hasPackageJson, false);
    assert.strictEqual(report.isHealthy, false);
    assert.ok(report.issues.some((i) => i.includes('does not contain package.json')));
    assert.ok(report.recommendations.some((r) => r.includes('npx frappe-frontend-cli create')));
  });

  test('diagnoses standalone Vue + Tailwind v4 project correctly', async () => {
    const projDir = path.join(tmpDir, 'vue-proj');
    fs.mkdirSync(projDir, { recursive: true });

    fs.writeFileSync(
      path.join(projDir, 'package.json'),
      JSON.stringify(
        {
          name: 'vue-app',
          version: '1.0.0',
          dependencies: {
            vue: '^3.5.0',
          },
          devDependencies: {
            vite: '^6.0.0',
            '@tailwindcss/vite': '^4.0.0',
            tailwindcss: '^4.0.0',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    fs.writeFileSync(
      path.join(projDir, 'vite.config.ts'),
      `import { defineConfig } from 'vite';\nimport tailwindcss from '@tailwindcss/vite';\nexport default defineConfig({ plugins: [tailwindcss()] });\n`,
      'utf8'
    );

    const { report, exitCode } = await runCheck({ cwd: projDir });

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(report.framework, 'vue');
    assert.strictEqual(report.cssTool, 'tailwind-v4');
    assert.strictEqual(report.isVite, true);
    assert.ok(report.checks.some((c) => c.name === 'Frontend Framework' && c.status === 'ok'));
  });

  test('detects and flags Tailwind v4 conflict with Frappe UI', async () => {
    const projDir = path.join(tmpDir, 'frappe-ui-conflict');
    fs.mkdirSync(projDir, { recursive: true });

    fs.writeFileSync(
      path.join(projDir, 'package.json'),
      JSON.stringify(
        {
          name: 'frappe-ui-broken',
          dependencies: {
            vue: '^3.5.0',
            'frappe-ui': '^0.1.72',
          },
          devDependencies: {
            vite: '^6.0.0',
            '@tailwindcss/vite': '^4.0.0', // Incompatible Tailwind v4
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const { report, exitCode } = await runCheck({ cwd: projDir });

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(report.framework, 'frappe-ui');
    assert.ok(report.checks.some((c) => c.name === 'Frappe UI Tailwind Compatibility' && c.status === 'error'));
    assert.ok(report.issues.some((i) => i.includes('Frappe UI requires Tailwind CSS v3')));
    assert.ok(report.recommendations.some((r) => r.includes('npx frappe-frontend-cli add tailwind --v3')));
  });

  test('diagnoses unintegrated Frappe custom app and reports missing integration items', async () => {
    const benchDir = path.join(tmpDir, 'mock-bench');
    const appDir = path.join(benchDir, 'apps', 'crm_app');
    const frontendDir = path.join(appDir, 'frontend');

    fs.mkdirSync(path.join(benchDir, 'sites'), { recursive: true });
    fs.writeFileSync(path.join(benchDir, 'sites', 'apps.txt'), 'frappe\ncrm_app\n', 'utf8');

    fs.mkdirSync(path.join(appDir, 'crm_app'), { recursive: true });
    fs.writeFileSync(path.join(appDir, 'pyproject.toml'), '[project]\nname = "crm_app"\n', 'utf8');
    fs.writeFileSync(path.join(appDir, 'crm_app', 'hooks.py'), 'app_name = "crm_app"\n', 'utf8');

    fs.mkdirSync(frontendDir, { recursive: true });
    fs.writeFileSync(
      path.join(frontendDir, 'package.json'),
      JSON.stringify(
        {
          name: 'crm-frontend',
          dependencies: { vue: '^3.5.0' },
          devDependencies: { vite: '^6.0.0' },
        },
        null,
        2
      ),
      'utf8'
    );

    const { report } = await runCheck({
      cwd: frontendDir,
      app: 'crm_app',
      benchDir,
    });

    assert.ok(report.frappeApp);
    assert.strictEqual(report.frappeApp.appName, 'crm_app');
    assert.strictEqual(report.frappeApp.isFullyIntegrated, false);
    assert.ok(report.recommendations.some((r) => r.includes('npx frappe-frontend-cli integrate frappe --app crm_app')));
  });

  test('--json flag produces valid, machine-readable JSON output', async () => {
    const projDir = path.join(tmpDir, 'json-proj');
    fs.mkdirSync(projDir, { recursive: true });

    fs.writeFileSync(
      path.join(projDir, 'package.json'),
      JSON.stringify(
        {
          name: 'json-app',
          dependencies: { react: '^18.3.0' },
          devDependencies: { vite: '^6.0.0' },
        },
        null,
        2
      ),
      'utf8'
    );

    let stdoutBuffer = '';
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any) => {
      stdoutBuffer += chunk.toString();
      return true;
    };

    try {
      const { report, exitCode } = await runCheck({
        cwd: projDir,
        json: true,
      });

      assert.strictEqual(exitCode, 0);
      assert.strictEqual(report.framework, 'react');

      const parsed = JSON.parse(stdoutBuffer);
      assert.strictEqual(parsed.framework, 'react');
      assert.strictEqual(parsed.hasPackageJson, true);
      assert.ok(Array.isArray(parsed.checks));
    } finally {
      process.stdout.write = originalStdoutWrite;
    }
  });
});
