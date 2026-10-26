import { test, describe, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Runner } from '../src/core/runner';
import { runIntegrate } from '../src/cli/integrate';
import {
  detectBenchFrappeVersion,
  inspectFrappeIntegration,
  updateHooksFile,
  updateViteConfig,
  generatePortalRoute,
} from '../src/adapters/frappe';

describe('Frappe Custom App Integration & Asset Delivery (Phase 5)', () => {
  let tmpDir: string;
  let benchDir: string;
  let appDir: string;
  let appPkgDir: string;
  let frontendDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-integrate-test-'));
    benchDir = path.join(tmpDir, 'frappe-bench');
    appDir = path.join(benchDir, 'apps', 'test_app');
    appPkgDir = path.join(appDir, 'test_app');
    frontendDir = path.join(appDir, 'frontend');

    // Create mock Frappe bench structure
    fs.mkdirSync(path.join(benchDir, 'sites'), { recursive: true });
    fs.writeFileSync(path.join(benchDir, 'sites', 'apps.txt'), 'frappe\ntest_app\n', 'utf8');

    // Mock Frappe core app with version in pyproject.toml
    fs.mkdirSync(path.join(benchDir, 'apps', 'frappe'), { recursive: true });
    fs.writeFileSync(
      path.join(benchDir, 'apps', 'frappe', 'pyproject.toml'),
      '[project]\nname = "frappe"\nversion = "15.3.0"\n',
      'utf8'
    );

    // Mock custom app structure
    fs.mkdirSync(appPkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'pyproject.toml'),
      '[project]\nname = "test_app"\nversion = "0.0.1"\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(appPkgDir, 'hooks.py'),
      `# Test app hooks\napp_name = "test_app"\napp_title = "Test App"\napp_publisher = "Test Publisher"\n`,
      'utf8'
    );

    // Mock frontend directory with Vue + Vite
    fs.mkdirSync(path.join(frontendDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(frontendDir, 'package.json'),
      JSON.stringify(
        {
          name: 'frontend',
          version: '0.0.0',
          scripts: {
            build: 'node build.js',
          },
          dependencies: {
            vue: '^3.5.0',
          },
          devDependencies: {
            vite: '^6.0.0',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    fs.writeFileSync(
      path.join(frontendDir, 'vite.config.ts'),
      `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({\n  plugins: [vue()],\n});\n`,
      'utf8'
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  test('detects Bench and extracts Frappe version correctly', () => {
    const ver = detectBenchFrappeVersion(benchDir);
    assert.strictEqual(ver, '15.3.0');

    const noVer = detectBenchFrappeVersion('/non/existent/bench');
    assert.strictEqual(noVer, undefined);
  });

  test('inspectFrappeIntegration detects unintegrated state and missing requirements', () => {
    const res = inspectFrappeIntegration({
      cwd: appDir,
      app: 'test_app',
      benchDir,
      frontendDir,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.inspection);
    const insp = res.inspection;

    assert.strictEqual(insp.app.appName, 'test_app');
    assert.strictEqual(insp.frappeVersion, '15.3.0');
    assert.strictEqual(insp.framework, 'vue');
    assert.strictEqual(insp.isVite, true);
    assert.strictEqual(insp.viteConfiguredForProduction, false);
    assert.strictEqual(insp.hooksConfigured, false);
    assert.strictEqual(insp.wwwPyExists, false);
    assert.strictEqual(insp.wwwHtmlExists, false);
    assert.strictEqual(insp.publicFrontendHasAssets, false);
    assert.strictEqual(insp.isFullyIntegrated, false);
    assert.ok(insp.missingRequirements.length >= 4);
  });

  test('updateViteConfig sets production base and outDir and creates .bak file', () => {
    const viteConfigPath = path.join(frontendDir, 'vite.config.ts');
    const updateRes = updateViteConfig(viteConfigPath, 'test_app', false);

    assert.strictEqual(updateRes.modified, true);
    assert.ok(updateRes.backupPath);
    assert.ok(fs.existsSync(updateRes.backupPath));

    const updatedContent = fs.readFileSync(viteConfigPath, 'utf8');
    assert.ok(updatedContent.includes(`/assets/test_app/frontend/`));
    assert.ok(updatedContent.includes(`../test_app/public/frontend`));

    // Re-running does not re-modify
    const secondRes = updateViteConfig(viteConfigPath, 'test_app', false);
    assert.strictEqual(secondRes.modified, false);
  });

  test('updateHooksFile appends website_route_rules preserving existing comments and hooks', () => {
    const hooksPath = path.join(appPkgDir, 'hooks.py');
    const updateRes = updateHooksFile(hooksPath, 'frontend', false);

    assert.strictEqual(updateRes.modified, true);
    assert.ok(updateRes.backupPath);
    assert.ok(fs.existsSync(updateRes.backupPath));

    const updated = fs.readFileSync(hooksPath, 'utf8');
    assert.ok(updated.includes('app_name = "test_app"'));
    assert.ok(updated.includes('website_route_rules = ['));
    assert.ok(updated.includes('{"from_route": "/frontend/<path:app_path>", "to_route": "frontend"}'));

    // Re-running is idempotent and does not duplicate
    const secondRes = updateHooksFile(hooksPath, 'frontend', false);
    assert.strictEqual(secondRes.modified, false);
  });

  test('updateHooksFile merges into existing website_route_rules list safely', () => {
    const hooksPath = path.join(appPkgDir, 'hooks.py');
    fs.writeFileSync(
      hooksPath,
      `# Existing hooks\nwebsite_route_rules = [\n    {"from_route": "/existing", "to_route": "existing"},\n]\n`,
      'utf8'
    );

    const updateRes = updateHooksFile(hooksPath, 'custom-spa', false);
    assert.strictEqual(updateRes.modified, true);

    const updated = fs.readFileSync(hooksPath, 'utf8');
    assert.ok(updated.includes('{"from_route": "/existing", "to_route": "existing"}'));
    assert.ok(updated.includes('{"from_route": "/custom-spa/<path:app_path>", "to_route": "custom-spa"}'));
  });

  test('generatePortalRoute generates www/<route>.py and www/<route>.html', () => {
    const routeRes = generatePortalRoute(appPkgDir, 'test_app', 'frontend', false);

    assert.strictEqual(routeRes.pyCreated, true);
    assert.strictEqual(routeRes.htmlCreated, true);
    assert.ok(fs.existsSync(routeRes.pyPath));
    assert.ok(fs.existsSync(routeRes.htmlPath));

    const pyContent = fs.readFileSync(routeRes.pyPath, 'utf8');
    assert.ok(pyContent.includes('no_cache = 1'));
    assert.ok(pyContent.includes('frappe.sessions.get_csrf_token()'));
    assert.ok(pyContent.includes('context.boot = get_boot()'));

    const htmlContent = fs.readFileSync(routeRes.htmlPath, 'utf8');
    assert.ok(htmlContent.includes('csrf_token'));
    assert.ok(htmlContent.includes('frappe.get_app_path("test_app", "public", "frontend", "index.html")'));
  });

  test('--check flag inspects status without modifying any files', async () => {
    const hooksPath = path.join(appPkgDir, 'hooks.py');
    const viteConfigPath = path.join(frontendDir, 'vite.config.ts');
    const initialHooks = fs.readFileSync(hooksPath, 'utf8');
    const initialVite = fs.readFileSync(viteConfigPath, 'utf8');

    const res = await runIntegrate('frappe', {
      app: 'test_app',
      benchDir,
      frontendDir,
      check: true,
    });

    assert.strictEqual(res.checkMode, true);
    assert.strictEqual(res.isFullyIntegrated, false);
    assert.strictEqual(res.exitCode, 1);

    // Verify zero files were created or modified
    assert.strictEqual(fs.readFileSync(hooksPath, 'utf8'), initialHooks);
    assert.strictEqual(fs.readFileSync(viteConfigPath, 'utf8'), initialVite);
    assert.strictEqual(fs.existsSync(path.join(appPkgDir, 'www')), false);
  });

  test('--dry-run flag outlines proposed actions without modifying any files', async () => {
    const hooksPath = path.join(appPkgDir, 'hooks.py');
    const viteConfigPath = path.join(frontendDir, 'vite.config.ts');
    const initialHooks = fs.readFileSync(hooksPath, 'utf8');
    const initialVite = fs.readFileSync(viteConfigPath, 'utf8');

    const res = await runIntegrate('frappe', {
      app: 'test_app',
      benchDir,
      frontendDir,
      dryRun: true,
    });

    assert.strictEqual(res.dryRun, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.exitCode, 0);

    // Verify zero files modified
    assert.strictEqual(fs.readFileSync(hooksPath, 'utf8'), initialHooks);
    assert.strictEqual(fs.readFileSync(viteConfigPath, 'utf8'), initialVite);
    assert.strictEqual(fs.existsSync(path.join(appPkgDir, 'www')), false);
  });

  test('end-to-end: runIntegrate configures app, verifies files, and supports full reversal', async () => {
    const hooksPath = path.join(appPkgDir, 'hooks.py');
    const viteConfigPath = path.join(frontendDir, 'vite.config.ts');
    const origHooks = fs.readFileSync(hooksPath, 'utf8');
    const origVite = fs.readFileSync(viteConfigPath, 'utf8');

    // Mock build script that writes index.html to public/frontend
    const mockBuildScript = path.join(frontendDir, 'build.js');
    fs.writeFileSync(
      mockBuildScript,
      `const fs = require('fs');\n` +
        `const path = require('path');\n` +
        `const outDir = path.resolve(__dirname, '../test_app/public/frontend');\n` +
        `fs.mkdirSync(outDir, { recursive: true });\n` +
        `fs.writeFileSync(path.join(outDir, 'index.html'), '<!doctype html><html><body><h1>SPA</h1></body></html>');\n`,
      'utf8'
    );

    const mockRunner = {
      run: async () => {
        // Execute node build.js in frontendDir
        const script = path.join(frontendDir, 'build.js');
        const nodeRes = await import('node:child_process').then((cp) =>
          cp.spawnSync('node', [script], { cwd: frontendDir, encoding: 'utf8' })
        );
        return {
          stdout: nodeRes.stdout || '',
          stderr: nodeRes.stderr || '',
          exitCode: nodeRes.status || 0,
          durationMs: 10,
          timedOut: false,
        };
      },
    } as unknown as Runner;

    const res = await runIntegrate(
      'frappe',
      {
        app: 'test_app',
        benchDir,
        frontendDir,
        yes: true,
      },
      mockRunner
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.built, true);
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(res.filesChanged.length >= 4, true);

    // Verify files created
    assert.ok(fs.existsSync(path.join(appPkgDir, 'www', 'frontend.py')));
    assert.ok(fs.existsSync(path.join(appPkgDir, 'www', 'frontend.html')));
    assert.ok(fs.existsSync(path.join(appPkgDir, 'public', 'frontend', 'index.html')));

    // Verify subsequent --check now reports fully integrated!
    const checkRes = await runIntegrate('frappe', {
      app: 'test_app',
      benchDir,
      frontendDir,
      check: true,
    });
    assert.strictEqual(checkRes.isFullyIntegrated, true);
    assert.strictEqual(checkRes.exitCode, 0);

    // Verify reversal using .bak files
    const hooksBackup = res.filesChanged.find((f) => f.filePath === hooksPath)?.backupPath;
    const viteBackup = res.filesChanged.find((f) => f.filePath === viteConfigPath)?.backupPath;

    assert.ok(hooksBackup && fs.existsSync(hooksBackup));
    assert.ok(viteBackup && fs.existsSync(viteBackup));

    fs.copyFileSync(hooksBackup, hooksPath);
    fs.copyFileSync(viteBackup, viteConfigPath);

    assert.strictEqual(fs.readFileSync(hooksPath, 'utf8'), origHooks);
    assert.strictEqual(fs.readFileSync(viteConfigPath, 'utf8'), origVite);
  });

  test('handles failed build safely without destroying configuration changes', async () => {
    const failingRunner = {
      run: async () => {
        return {
          stdout: '',
          stderr: 'Mock build error: Out of memory or syntax error\n',
          exitCode: 2,
          durationMs: 10,
          timedOut: false,
        };
      },
    } as unknown as Runner;

    const res = await runIntegrate(
      'frappe',
      {
        app: 'test_app',
        benchDir,
        frontendDir,
        yes: true,
      },
      failingRunner
    );

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.built, false);
    assert.strictEqual(res.exitCode, 2);
    assert.ok(res.error?.includes('Build verification failed'));

    // Verify configuration changes were not destroyed
    const viteContent = fs.readFileSync(path.join(frontendDir, 'vite.config.ts'), 'utf8');
    assert.ok(viteContent.includes('/assets/test_app/frontend/'));
  });

  test('rejects invalid or non-existent app name with code 1', async () => {
    const res = await runIntegrate('frappe', {
      app: 'non_existent_app_xyz',
      benchDir,
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.error?.includes('was not found') || res.error?.includes('Invalid'));
  });
});
