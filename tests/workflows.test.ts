import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { runInit, MockPrompter } from '../src/cli/init';
import { runCreate } from '../src/cli/create';
import { runAdd } from '../src/cli/add';
import { runIntegrate } from '../src/cli/integrate';
import { runCheck } from '../src/cli/check';
import { defaultRunner } from '../src/core/runner';

describe('Phase 7: End-to-End User Workflows Verification', () => {
  let tempBaseDir: string;

  before(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-phase7-workflows-'));
  });

  after(() => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  test('Workflow 1: Interactive setup wizard (init) guides, summarizes, confirms, and scaffolds', async () => {
    const wizardDir = path.join(tempBaseDir, 'wf1-wizard');
    fs.mkdirSync(wizardDir, { recursive: true });

    // MockPrompter answers option numbers:
    // 1. mode: '1' (Standalone)
    // 2. name: 'wizard-vue-app'
    // 3. framework: '2' (Vue 3)
    // 4. language: '1' (TypeScript)
    // 5. styling: '1' (Tailwind CSS v4)
    // 6. package manager: '1' (npm)
    // 7. backend URL: '' (use default)
    // 8. confirm: 'y'
    const prompter = new MockPrompter([
      '1',
      'wizard-vue-app',
      '2',
      '1',
      '1',
      '1',
      '',
      'y',
    ]);

    const result = await runInit(
      {
        prompter,
        cwd: wizardDir,
        skipInstall: true,
        skipBuild: true,
      },
      defaultRunner
    );

    assert.strictEqual(result.exitCode, 0, 'Interactive init should succeed with exitCode 0');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.framework, 'vue');
    assert.strictEqual(result.language, 'ts');

    const createdPkg = path.join(result.targetDir, 'package.json');
    assert.strictEqual(fs.existsSync(createdPkg), true, 'package.json should be created');

    const pkgJson = JSON.parse(fs.readFileSync(createdPkg, 'utf8'));
    assert.strictEqual(pkgJson.name, 'wizard-vue-app');
    assert.ok(pkgJson.dependencies?.vue || pkgJson.devDependencies?.vue);
  });

  test('Workflow 2: Standalone Vue and React project scaffolding (TS & JS)', async () => {
    const wf2Dir = path.join(tempBaseDir, 'wf2-standalone');
    fs.mkdirSync(wf2Dir, { recursive: true });

    // 2a. Vue JavaScript
    const vueRes = await runCreate('vue', 'test-vue-js', {
      js: true,
      skipInstall: true,
      skipBuild: true,
      cwd: wf2Dir,
    });
    assert.strictEqual(vueRes.exitCode, 0);
    assert.strictEqual(vueRes.language, 'js');
    assert.strictEqual(fs.existsSync(path.join(vueRes.targetDir, 'src/main.js')), true);

    // 2b. React TypeScript
    const reactRes = await runCreate('react', 'test-react-ts', {
      ts: true,
      skipInstall: true,
      skipBuild: true,
      cwd: wf2Dir,
    });
    assert.strictEqual(reactRes.exitCode, 0);
    assert.strictEqual(reactRes.language, 'ts');
    assert.strictEqual(fs.existsSync(path.join(reactRes.targetDir, 'src/main.tsx')), true);
    assert.strictEqual(fs.existsSync(path.join(reactRes.targetDir, 'tsconfig.json')), true);
  });

  test('Workflow 3: CSS Tooling integration, idempotency, and compatibility checks', async () => {
    const wf3Dir = path.join(tempBaseDir, 'wf3-css');
    fs.mkdirSync(wf3Dir, { recursive: true });

    // Scaffold base Vue project
    const proj = await runCreate('vue', 'css-test-app', {
      ts: true,
      skipInstall: true,
      skipBuild: true,
      cwd: wf3Dir,
    });
    assert.strictEqual(proj.exitCode, 0);

    // 3a. Add Tailwind v4
    const tw4Res = await runAdd('tailwind', {
      cwd: proj.targetDir,
      v4: true,
      skipInstall: true,
      skipBuild: true,
    });
    assert.strictEqual(tw4Res.exitCode, 0);
    assert.strictEqual(tw4Res.alreadyConfigured, false);

    // 3b. Repeated add: idempotent check
    const repeatedRes = await runAdd('tailwind', {
      cwd: proj.targetDir,
      v4: true,
      skipInstall: true,
      skipBuild: true,
    });
    assert.strictEqual(repeatedRes.exitCode, 0);
    assert.strictEqual(repeatedRes.alreadyConfigured, true, 'Repeated add must detect already configured');

    // 3c. Incompatible Tailwind v3 attempt on Tailwind v4 project
    const conflictRes = await runAdd('tailwind', {
      cwd: proj.targetDir,
      v3: true,
      skipInstall: true,
      skipBuild: true,
    });
    assert.strictEqual(conflictRes.exitCode, 1, 'Tailwind v3 should be rejected when v4 exists');
    assert.ok(conflictRes.error?.includes('Mixing Tailwind v3 and v4 is not supported'));

    // 3d. Add Bootstrap 5
    const bootProj = await runCreate('vue', 'boot-test-app', {
      ts: true,
      skipInstall: true,
      skipBuild: true,
      cwd: wf3Dir,
    });
    const bootRes = await runAdd('bootstrap', {
      cwd: bootProj.targetDir,
      skipInstall: true,
      skipBuild: true,
    });
    assert.strictEqual(bootRes.exitCode, 0);

    // 3e. Add SCSS
    const scssProj = await runCreate('vue', 'scss-test-app', {
      ts: true,
      skipInstall: true,
      skipBuild: true,
      cwd: wf3Dir,
    });
    const scssRes = await runAdd('scss', {
      cwd: scssProj.targetDir,
      skipInstall: true,
      skipBuild: true,
    });
    assert.strictEqual(scssRes.exitCode, 0);
    assert.strictEqual(fs.existsSync(path.join(scssProj.targetDir, 'src/style.scss')), true);
  });

  test('Workflow 4: Frappe UI scaffolding with Tailwind v3 pinning & proxy configuration', async () => {
    const wf4Dir = path.join(tempBaseDir, 'wf4-frappe-ui');
    fs.mkdirSync(wf4Dir, { recursive: true });

    const fuiRes = await runCreate('frappe-ui', 'my-portal-ui', {
      backendUrl: 'http://127.0.0.1:8000',
      skipInstall: true,
      skipBuild: true,
      cwd: wf4Dir,
    });

    assert.strictEqual(fuiRes.exitCode, 0);
    assert.strictEqual(fuiRes.framework, 'frappe-ui');

    const pkg = JSON.parse(fs.readFileSync(path.join(fuiRes.targetDir, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies['frappe-ui'], 'Must include frappe-ui');
    assert.strictEqual(pkg.devDependencies['tailwindcss'], '^3.4.17', 'Must pin Tailwind v3');
    assert.strictEqual(fs.existsSync(path.join(fuiRes.targetDir, 'tailwind.config.js')), true);
    assert.strictEqual(fs.existsSync(path.join(fuiRes.targetDir, 'postcss.config.js')), true);

    const viteConfig = fs.readFileSync(path.join(fuiRes.targetDir, 'vite.config.ts'), 'utf8');
    assert.ok(viteConfig.includes("http://127.0.0.1:8000"), 'Vite proxy target must be configured');
    assert.ok(viteConfig.includes("proxy:"), 'Proxy config must be present');
  });

  test('Workflow 5: Existing Frappe Custom App integration (portal, dry-run, backup, and check)', async () => {
    const wf5Dir = path.join(tempBaseDir, 'wf5-app');
    const benchDir = path.join(wf5Dir, 'frappe-bench');
    const appsDir = path.join(benchDir, 'apps');
    const sitesDir = path.join(benchDir, 'sites');
    const appDir = path.join(appsDir, 'crm_app');
    const pkgDir = path.join(appDir, 'crm_app');
    const frontendDir = path.join(appDir, 'frontend');

    fs.mkdirSync(sitesDir, { recursive: true });
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.mkdirSync(frontendDir, { recursive: true });

    fs.writeFileSync(path.join(sitesDir, 'apps.txt'), 'frappe\ncrm_app\n', 'utf8');
    fs.writeFileSync(path.join(sitesDir, 'common_site_config.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(appDir, 'pyproject.toml'), '[project]\nname = "crm_app"\nversion = "0.0.1"\n', 'utf8');
    fs.writeFileSync(path.join(pkgDir, 'hooks.py'), '# Frappe hooks\napp_name = "crm_app"\n', 'utf8');
    fs.writeFileSync(
      path.join(frontendDir, 'package.json'),
      JSON.stringify({ name: 'crm-frontend', version: '0.0.1', dependencies: { vue: '^3.5.0' } }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(frontendDir, 'vite.config.ts'),
      'import { defineConfig } from "vite";\nexport default defineConfig({});\n',
      'utf8'
    );

    // 5a. Dry-run inspection
    const dryRunRes = await runIntegrate('frappe', {
      app: 'crm_app',
      benchDir,
      frontendDir,
      dryRun: true,
      skipBuild: true,
    });
    assert.strictEqual(dryRunRes.exitCode, 0);
    assert.strictEqual(fs.existsSync(path.join(pkgDir, 'www/frontend.py')), false, 'Dry-run must not create files');

    // 5b. Real integration execution
    const realRes = await runIntegrate('frappe', {
      app: 'crm_app',
      benchDir,
      frontendDir,
      skipBuild: true,
    });
    assert.strictEqual(realRes.exitCode, 0);
    assert.strictEqual(fs.existsSync(path.join(pkgDir, 'www/frontend.py')), true);
    assert.strictEqual(fs.existsSync(path.join(pkgDir, 'www/frontend.html')), true);

    const updatedVite = fs.readFileSync(path.join(frontendDir, 'vite.config.ts'), 'utf8');
    assert.ok(updatedVite.includes("base: process.env.NODE_ENV === 'production' ? '/assets/crm_app/frontend/' : '/'"));
    assert.ok(updatedVite.includes("outDir: '../crm_app/public/frontend'"));
    assert.ok(updatedVite.includes("manifest: true"));

    // Check backups were created
    const viteFiles = fs.readdirSync(frontendDir);
    const hasViteBak = viteFiles.some((f) => f.startsWith('vite.config.ts.bak.'));
    assert.strictEqual(hasViteBak, true, 'Backup for vite.config.ts should exist');

    const hooksFiles = fs.readdirSync(pkgDir);
    const hasHooksBak = hooksFiles.some((f) => f.startsWith('hooks.py.bak.'));
    assert.strictEqual(hasHooksBak, true, 'Backup for hooks.py should exist');

    // 5c. Run check on the integrated app
    const checkRes = await runCheck({
      cwd: frontendDir,
      app: 'crm_app',
      benchDir,
    });
    assert.ok(checkRes.report);
    assert.strictEqual(checkRes.report.frappeApp?.appName, 'crm_app');
    assert.strictEqual(checkRes.report.isVite, true);
    assert.ok(checkRes.report.viteConfigPath);
  });

  test('Workflow 6: Desk Page and Multi-App Support with Scoped Assets', async () => {
    const wf6Dir = path.join(tempBaseDir, 'wf6-multi');
    const benchDir = path.join(wf6Dir, 'frappe-bench');
    const appsDir = path.join(benchDir, 'apps');
    const sitesDir = path.join(benchDir, 'sites');

    fs.mkdirSync(sitesDir, { recursive: true });
    fs.writeFileSync(path.join(sitesDir, 'apps.txt'), 'frappe\nsales_hub\ninventory_hub\n', 'utf8');
    fs.writeFileSync(path.join(sitesDir, 'common_site_config.json'), '{}', 'utf8');

    // Create app 1: sales_hub
    const app1Dir = path.join(appsDir, 'sales_hub');
    const app1Pkg = path.join(app1Dir, 'sales_hub');
    fs.mkdirSync(app1Pkg, { recursive: true });
    fs.writeFileSync(path.join(app1Dir, 'pyproject.toml'), '[project]\nname = "sales_hub"\n', 'utf8');
    fs.writeFileSync(path.join(app1Pkg, 'hooks.py'), 'app_name = "sales_hub"\n', 'utf8');
    fs.writeFileSync(path.join(app1Pkg, 'modules.txt'), 'Sales Hub\n', 'utf8');

    // Create app 2: inventory_hub
    const app2Dir = path.join(appsDir, 'inventory_hub');
    const app2Pkg = path.join(app2Dir, 'inventory_hub');
    const app2Frontend = path.join(app2Dir, 'frontend');
    fs.mkdirSync(app2Pkg, { recursive: true });
    fs.mkdirSync(app2Frontend, { recursive: true });
    fs.writeFileSync(path.join(app2Dir, 'pyproject.toml'), '[project]\nname = "inventory_hub"\n', 'utf8');
    fs.writeFileSync(path.join(app2Pkg, 'hooks.py'), 'app_name = "inventory_hub"\n', 'utf8');
    fs.writeFileSync(path.join(app2Pkg, 'modules.txt'), 'Inventory Hub\n', 'utf8');
    fs.writeFileSync(
      path.join(app2Frontend, 'package.json'),
      JSON.stringify({ name: 'inv-front', version: '0.0.1' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(app2Frontend, 'vite.config.ts'),
      'import { defineConfig } from "vite";\nexport default defineConfig({});\n',
      'utf8'
    );

    // 6a. Disambiguation: running integrate without --app must fail
    const ambiguousRes = await runIntegrate('desk', {
      benchDir,
      frontendDir: app2Frontend,
      skipBuild: true,
    });
    assert.strictEqual(ambiguousRes.exitCode, 1);
    assert.strictEqual(ambiguousRes.success, false);
    assert.ok(ambiguousRes.error?.includes('Multiple Frappe custom apps detected in Bench'));

    // 6b. Specify explicit app and Desk mode with scoped outputDir
    const deskRes = await runIntegrate('desk', {
      app: 'inventory_hub',
      benchDir,
      frontendDir: app2Frontend,
      page: 'stock-matrix',
      pageTitle: 'Stock Matrix View',
      outputDir: 'stock-matrix-dist',
      skipBuild: true,
    });
    assert.strictEqual(deskRes.exitCode, 0);
    assert.strictEqual(deskRes.success, true);

    // Verify Desk Page files in module directory
    const pageJsonPath = path.join(
      app2Pkg,
      'inventory_hub',
      'page',
      'stock-matrix',
      'stock-matrix.json'
    );
    const pageJsPath = path.join(
      app2Pkg,
      'inventory_hub',
      'page',
      'stock-matrix',
      'stock-matrix.js'
    );
    assert.strictEqual(fs.existsSync(pageJsonPath), true, 'Desk Page DocType JSON must exist');
    assert.strictEqual(fs.existsSync(pageJsPath), true, 'Desk Page JS controller must exist');

    const pageJson = JSON.parse(fs.readFileSync(pageJsonPath, 'utf8'));
    assert.strictEqual(pageJson.doctype, 'Page');
    assert.strictEqual(pageJson.title, 'Stock Matrix View');
    assert.strictEqual(pageJson.standard, 'Yes');

    const pageJs = fs.readFileSync(pageJsPath, 'utf8');
    assert.ok(pageJs.includes("frappe.pages['stock-matrix'].on_page_load"));
    assert.ok(pageJs.includes('id="stock-matrix-app"'));
    assert.ok(pageJs.includes('/assets/inventory_hub/stock-matrix-dist/'));

    // Verify Vite config has scoped assets
    const viteContent = fs.readFileSync(path.join(app2Frontend, 'vite.config.ts'), 'utf8');
    assert.ok(viteContent.includes("base: process.env.NODE_ENV === 'production' ? '/assets/inventory_hub/stock-matrix-dist/' : '/'"));
    assert.ok(viteContent.includes("outDir: '../inventory_hub/public/stock-matrix-dist'"));

    // Verify website www/ was not touched
    assert.strictEqual(fs.existsSync(path.join(app2Pkg, 'www')), false, 'Desk mode must not create www/ portal');
  });
});
