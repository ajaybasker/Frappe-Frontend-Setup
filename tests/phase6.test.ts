import { test, describe, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectWorkspace } from '../src/core/workspaces';
import { findBenchApps, validateFrappeApp } from '../src/core/frappe-app';
import { generateDeskPage } from '../src/adapters/frappe/desk-page-generator';
import { runIntegrate } from '../src/cli/integrate';
import { runCheck } from '../src/cli/check';
import { evaluateEnvironment } from '../src/core/evaluator';
import { EnvironmentFacts } from '../src/core/types';

describe('Phase 6: Multi-App, Monorepo Workspaces, Desk Pages & Production Hardening', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-phase6-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Part A — Multi-App Bench & Monorepo Workspaces', () => {
    test('findBenchApps detects and classifies all apps and custom apps in a Bench', () => {
      const benchDir = path.join(tmpDir, 'mock-bench');
      const appsDir = path.join(benchDir, 'apps');
      fs.mkdirSync(path.join(appsDir, 'frappe'), { recursive: true });
      fs.mkdirSync(path.join(appsDir, 'erpnext'), { recursive: true });
      fs.mkdirSync(path.join(appsDir, 'crm_custom'), { recursive: true });
      fs.mkdirSync(path.join(appsDir, 'portal_app'), { recursive: true });

      const discovery = findBenchApps(benchDir);
      assert.strictEqual(discovery.allApps.length, 4);
      assert.ok(discovery.allApps.includes('frappe'));
      assert.strictEqual(discovery.customApps.length, 3);
      assert.ok(discovery.customApps.includes('erpnext'));
      assert.ok(discovery.customApps.includes('crm_custom'));
      assert.ok(discovery.customApps.includes('portal_app'));
      assert.ok(!discovery.customApps.includes('frappe'));
    });

    test('validateFrappeApp requires explicit --app when multiple custom apps exist in Bench', () => {
      const benchDir = path.join(tmpDir, 'multi-app-bench');
      const appsDir = path.join(benchDir, 'apps');
      fs.mkdirSync(path.join(benchDir, 'sites'), { recursive: true });
      fs.writeFileSync(path.join(benchDir, 'sites', 'apps.txt'), 'frappe\napp_one\napp_two\n');
      fs.mkdirSync(path.join(appsDir, 'frappe'), { recursive: true });
      fs.mkdirSync(path.join(appsDir, 'app_one'), { recursive: true });
      fs.mkdirSync(path.join(appsDir, 'app_two'), { recursive: true });

      const res = validateFrappeApp('', { benchDir });
      assert.strictEqual(res.valid, false);
      assert.ok(res.candidateApps && res.candidateApps.length === 2);
      assert.ok(res.error?.includes('Multiple custom apps detected in Bench: app_one, app_two'));
    });

    test('detectWorkspace detects pnpm workspace and packages', () => {
      const wsRoot = path.join(tmpDir, 'pnpm-repo');
      fs.mkdirSync(path.join(wsRoot, 'packages', 'frontend-a'), { recursive: true });
      fs.writeFileSync(
        path.join(wsRoot, 'pnpm-workspace.yaml'),
        `packages:\n  - 'packages/*'\n  - 'apps/*'\n`
      );
      fs.writeFileSync(
        path.join(wsRoot, 'packages', 'frontend-a', 'package.json'),
        JSON.stringify({ name: '@monorepo/frontend-a' })
      );

      const info = detectWorkspace(path.join(wsRoot, 'packages', 'frontend-a'));
      assert.strictEqual(info.type, 'pnpm');
      assert.strictEqual(info.isWorkspacePackage, true);
      assert.strictEqual(info.currentPackageName, '@monorepo/frontend-a');
      assert.ok(info.packages.length >= 2);
    });

    test('detectWorkspace detects npm workspaces and Turborepo configuration', () => {
      const wsRoot = path.join(tmpDir, 'turbo-repo');
      fs.mkdirSync(path.join(wsRoot, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(
        path.join(wsRoot, 'package.json'),
        JSON.stringify({
          name: 'root-monorepo',
          workspaces: ['apps/*'],
        })
      );
      fs.writeFileSync(
        path.join(wsRoot, 'turbo.json'),
        JSON.stringify({
          $schema: 'https://turbo.build/schema.json',
          tasks: { build: { outputs: ['dist/**'] } },
        })
      );
      fs.writeFileSync(
        path.join(wsRoot, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web-app' })
      );

      const info = detectWorkspace(path.join(wsRoot, 'apps', 'web'));
      assert.strictEqual(info.type, 'npm');
      assert.strictEqual(info.isTurborepo, true);
      assert.strictEqual(info.isWorkspacePackage, true);
      assert.ok(info.turboConfigPath && fs.existsSync(info.turboConfigPath));
    });

    test('evaluator reports monorepo workspace facts properly', () => {
      const mockFacts: EnvironmentFacts = {
        os: { platform: 'linux', release: '6.8.0', arch: 'x64', isLinux: true, isMac: false, isWindows: false, isWsl: false },
        node: { version: 'v20.20.0', major: 20, minor: 20, patch: 0, path: '/usr/bin/node' },
        packageManagers: { available: ['pnpm'], preferred: 'pnpm' },
        git: { available: true },
        bench: { cliAvailable: false, isInsideBench: false, isInsideApp: false },
        workspace: {
          type: 'pnpm',
          isTurborepo: true,
          rootDir: '/monorepo',
          packages: ['packages/*'],
        },
        cwd: '/monorepo/packages/app',
      };

      const report = evaluateEnvironment(mockFacts);
      const wsCheck = report.checks.find((c) => c.id === 'workspace-monorepo');
      assert.ok(wsCheck);
      assert.strictEqual(wsCheck.status, 'info');
      assert.ok(wsCheck.message.includes('PNPM workspace detected with Turborepo'));
    });
  });

  describe('Part B — Production Asset Delivery & Manifest Support', () => {
    test('runIntegrate scopes outputDir to prevent collisions between multiple SPAs', async () => {
      const benchDir = path.join(tmpDir, 'bench');
      const appDir = path.join(benchDir, 'apps', 'sales_app');
      const appPkgDir = path.join(appDir, 'sales_app');
      const frontendDir = path.join(appDir, 'frontend-portal');

      fs.mkdirSync(path.join(benchDir, 'sites'), { recursive: true });
      fs.writeFileSync(path.join(benchDir, 'sites', 'apps.txt'), 'frappe\nsales_app\n');
      fs.mkdirSync(appPkgDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'pyproject.toml'), '[project]\nname = "sales_app"\n');
      fs.writeFileSync(path.join(appPkgDir, 'hooks.py'), 'app_name = "sales_app"\n');

      fs.mkdirSync(frontendDir, { recursive: true });
      fs.writeFileSync(
        path.join(frontendDir, 'package.json'),
        JSON.stringify({ name: 'sales-portal', dependencies: { vue: '^3.5.0' }, devDependencies: { vite: '^6.0.0' } })
      );
      fs.writeFileSync(
        path.join(frontendDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';\nexport default defineConfig({});\n`
      );

      const res = await runIntegrate('frappe', {
        app: 'sales_app',
        benchDir,
        frontendDir,
        route: 'portal',
        outputDir: 'portal-assets',
        skipBuild: true,
        yes: true,
      });

      assert.strictEqual(res.success, true);
      const viteContent = fs.readFileSync(path.join(frontendDir, 'vite.config.ts'), 'utf8');
      assert.ok(viteContent.includes('/assets/sales_app/portal-assets/'));
      assert.ok(viteContent.includes('../sales_app/public/portal-assets'));
      assert.ok(viteContent.includes('manifest: true'));
    });

    test('check reports large bundle chunk warnings and manifest status', async () => {
      const projDir = path.join(tmpDir, 'large-bundle-proj');
      const publicDir = path.join(projDir, 'public', 'frontend', 'assets');
      fs.mkdirSync(publicDir, { recursive: true });

      fs.writeFileSync(
        path.join(projDir, 'package.json'),
        JSON.stringify({
          name: 'large-proj',
          dependencies: { react: '^18.3.0' },
          devDependencies: { vite: '^6.0.0' },
        })
      );
      fs.writeFileSync(
        path.join(projDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';\nexport default defineConfig({ base: '/assets/app/frontend/', build: { outDir: 'public/frontend', manifest: true } });\n`
      );

      // Create a mock 600 KB JS chunk and manifest.json
      const largeChunkContent = 'console.log("chunk");\n' + 'x'.repeat(620 * 1024);
      fs.writeFileSync(path.join(publicDir, 'main-chunk.js'), largeChunkContent);
      fs.writeFileSync(path.join(projDir, 'public', 'frontend', 'manifest.json'), JSON.stringify({ 'index.html': {} }));

      const { report } = await runCheck({ cwd: projDir });
      assert.strictEqual(report.manifestExists, true);
      assert.ok(report.bundleDiagnostics && report.bundleDiagnostics.totalSizeKb >= 600);
      assert.ok(report.bundleDiagnostics.largeChunks.some((c) => c.name === 'main-chunk.js'));
      assert.ok(report.checks.some((c) => c.name === 'Bundle Size Advisory' && c.status === 'warn'));
      assert.ok(report.recommendations.some((r) => r.includes('dynamic import()')));
    });
  });

  describe('Part C — Frappe Desk Page Integration', () => {
    test('generateDeskPage creates <page>.json and <page>.js in module page directory', () => {
      const appDir = path.join(tmpDir, 'desk-app');
      const appPkgDir = path.join(appDir, 'desk_app');
      fs.mkdirSync(appPkgDir, { recursive: true });
      fs.writeFileSync(path.join(appPkgDir, 'modules.txt'), 'Desk Module\n');

      const res = generateDeskPage({
        appDir,
        appName: 'desk_app',
        pageName: 'analytics-dashboard',
        title: 'Analytics Dashboard',
        outputDir: 'analytics',
        dryRun: false,
      });

      assert.strictEqual(res.jsonCreated, true);
      assert.strictEqual(res.jsCreated, true);
      assert.ok(fs.existsSync(res.jsonPath));
      assert.ok(fs.existsSync(res.jsPath));

      const jsonContent = JSON.parse(fs.readFileSync(res.jsonPath, 'utf8'));
      assert.strictEqual(jsonContent.doctype, 'Page');
      assert.strictEqual(jsonContent.page_name, 'analytics-dashboard');
      assert.strictEqual(jsonContent.title, 'Analytics Dashboard');
      assert.strictEqual(jsonContent.module, 'Desk Module');

      const jsContent = fs.readFileSync(res.jsPath, 'utf8');
      assert.ok(jsContent.includes("frappe.pages['analytics-dashboard'].on_page_load"));
      assert.ok(jsContent.includes('frappe.ui.make_app_page'));
      assert.ok(jsContent.includes("id=\"analytics-dashboard-app\""));
      assert.ok(jsContent.includes("assetBase + 'index.js'"));
    });

    test('runIntegrate supports desk target and creates desk page files', async () => {
      const benchDir = path.join(tmpDir, 'bench-desk');
      const appDir = path.join(benchDir, 'apps', 'support_app');
      const appPkgDir = path.join(appDir, 'support_app');
      const frontendDir = path.join(appDir, 'frontend');

      fs.mkdirSync(path.join(benchDir, 'sites'), { recursive: true });
      fs.writeFileSync(path.join(benchDir, 'sites', 'apps.txt'), 'frappe\nsupport_app\n');
      fs.mkdirSync(appPkgDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'pyproject.toml'), '[project]\nname = "support_app"\n');
      fs.writeFileSync(path.join(appPkgDir, 'hooks.py'), 'app_name = "support_app"\n');
      fs.writeFileSync(path.join(appPkgDir, 'modules.txt'), 'Support\n');

      fs.mkdirSync(frontendDir, { recursive: true });
      fs.writeFileSync(
        path.join(frontendDir, 'package.json'),
        JSON.stringify({ name: 'support-ui', dependencies: { vue: '^3.5.0' }, devDependencies: { vite: '^6.0.0' } })
      );
      fs.writeFileSync(
        path.join(frontendDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';\nexport default defineConfig({});\n`
      );

      const res = await runIntegrate('desk', {
        app: 'support_app',
        benchDir,
        frontendDir,
        page: 'tickets-view',
        pageTitle: 'Tickets View',
        skipBuild: true,
        yes: true,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.exitCode, 0);

      const pageJsonPath = path.join(appPkgDir, 'support', 'page', 'tickets-view', 'tickets-view.json');
      const pageJsPath = path.join(appPkgDir, 'support', 'page', 'tickets-view', 'tickets-view.js');

      assert.ok(fs.existsSync(pageJsonPath));
      assert.ok(fs.existsSync(pageJsPath));

      // Verify Desk integration did not create website www/ routes
      assert.strictEqual(fs.existsSync(path.join(appPkgDir, 'www')), false);
    });
  });
});
