import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { defaultRunner } from '../src/core/runner';
import { runInit, MockPrompter } from '../src/cli/init';
import { findBenchDirectory, validateFrappeApp } from '../src/core/frappe-app';

describe('Interactive & Non-Interactive Setup Wizard (init)', () => {
  const runner = defaultRunner;
  const cliBin = path.resolve(__dirname, '../../bin/frappe-frontend-cli.js');
  let tempBaseDir: string;
  let mockBenchDir: string;
  let mockAppDir: string;

  before(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffc-init-test-'));

    // Create a mock Frappe Bench structure
    mockBenchDir = path.join(tempBaseDir, 'test-bench');
    const sitesDir = path.join(mockBenchDir, 'sites');
    const appsDir = path.join(mockBenchDir, 'apps');
    mockAppDir = path.join(appsDir, 'crm_custom');
    const pythonPkgDir = path.join(mockAppDir, 'crm_custom');

    fs.mkdirSync(sitesDir, { recursive: true });
    fs.mkdirSync(pythonPkgDir, { recursive: true });

    fs.writeFileSync(path.join(sitesDir, 'apps.txt'), 'frappe\ncrm_custom\n', 'utf8');
    fs.writeFileSync(path.join(sitesDir, 'common_site_config.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(pythonPkgDir, 'hooks.py'), '# Frappe hooks\napp_name = "crm_custom"\n', 'utf8');
    fs.writeFileSync(path.join(mockAppDir, 'pyproject.toml'), '[project]\nname = "crm_custom"\nversion = "0.0.1"\n', 'utf8');
  });

  after(async () => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  test('frappe-app detector identifies bench and custom app', () => {
    const detectedBench = findBenchDirectory(path.join(mockAppDir, 'crm_custom'));
    assert.strictEqual(detectedBench, mockBenchDir);

    const validResult = validateFrappeApp('crm_custom', { benchDir: mockBenchDir });
    assert.strictEqual(validResult.valid, true);
    assert.ok(validResult.app);
    assert.strictEqual(validResult.app.appName, 'crm_custom');
    assert.strictEqual(validResult.app.appDir, mockAppDir);
    assert.strictEqual(validResult.app.hasHooks, true);
    assert.strictEqual(validResult.app.hasPyprojectOrSetup, true);

    const invalidResult = validateFrappeApp('non_existent_app', { benchDir: mockBenchDir });
    assert.strictEqual(invalidResult.valid, false);
    assert.ok(invalidResult.error?.includes('was not found'));
  });

  test('non-interactive: rejects invalid app name format', async () => {
    const res = await runner.run(
      cliBin,
      ['init', '--non-interactive', '--mode', 'frappe-app', '--app', 'invalid/app!name'],
      { cwd: tempBaseDir }
    );
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Invalid app name'));
  });

  test('non-interactive: rejects missing --app when --mode frappe-app', async () => {
    const res = await runner.run(
      cliBin,
      ['init', '--non-interactive', '--mode', 'frappe-app'],
      { cwd: tempBaseDir }
    );
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Missing required Frappe custom app name'));
  });

  test('non-interactive: rejects non-existent Frappe app', async () => {
    const res = await runner.run(
      cliBin,
      ['init', '--non-interactive', '--mode', 'frappe-app', '--app', 'ghost_app', '--bench-dir', mockBenchDir],
      { cwd: tempBaseDir }
    );
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes("Frappe custom app 'ghost_app' was not found"));
  });

  test('non-interactive: rejects React + Frappe UI combination', async () => {
    const res = await runner.run(
      cliBin,
      ['init', '--non-interactive', '--name', 'fui-react-fail', '--framework', 'frappe-ui', '--react'],
      { cwd: tempBaseDir }
    );
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('Frappe UI is built exclusively for Vue 3 and does not support React'));
  });

  test('non-interactive: scaffolds standalone Frappe UI project', async () => {
    const projectName = 'init-fui-app';
    const targetDir = path.join(tempBaseDir, projectName);

    const res = await runner.run(
      cliBin,
      ['init', '--non-interactive', '--name', projectName, '--framework', 'frappe-ui', '--ts', '--skip-install'],
      { cwd: tempBaseDir }
    );

    assert.strictEqual(res.exitCode, 0, `Failed: ${res.stderr}\n${res.stdout}`);
    assert.ok(res.stderr.includes('Successfully completed setup'));
    assert.ok(fs.existsSync(path.join(targetDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'tailwind.config.js')));
    assert.ok(fs.existsSync(path.join(targetDir, 'src/App.vue')));
  });

  test('non-interactive: refuses to overwrite non-empty standalone directory', async () => {
    const projectName = 'init-fui-app'; // already exists from previous test
    const res = await runner.run(
      cliBin,
      ['init', '--non-interactive', '--name', projectName, '--framework', 'frappe-ui', '--ts', '--skip-install'],
      { cwd: tempBaseDir }
    );

    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('is not empty'));
  });

  test('non-interactive: scaffolds in-tree frontend for Frappe custom app', async () => {
    const frontendDir = path.join(mockAppDir, 'frontend');
    assert.strictEqual(fs.existsSync(frontendDir), false, 'frontend/ should not exist yet');

    const res = await runner.run(
      cliBin,
      [
        'init',
        '--non-interactive',
        '--mode',
        'frappe-app',
        '--app',
        'crm_custom',
        '--bench-dir',
        mockBenchDir,
        '--framework',
        'frappe-ui',
        '--ts',
        '--skip-install',
      ],
      { cwd: tempBaseDir }
    );

    assert.strictEqual(res.exitCode, 0, `Failed: ${res.stderr}\n${res.stdout}`);
    assert.ok(res.stderr.includes("Found Frappe custom app 'crm_custom'"));
    assert.ok(res.stderr.includes('The frontend application has been scaffolded inside'));
    assert.ok(res.stderr.includes('Phase 5'));

    // Verify files created inside <app>/frontend
    assert.ok(fs.existsSync(frontendDir), 'frontend/ directory created');
    assert.ok(fs.existsSync(path.join(frontendDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(frontendDir, 'src/App.vue')));
    assert.ok(fs.existsSync(path.join(frontendDir, 'vite.config.ts')));
  });

  test('non-interactive: protects existing files inside Frappe custom app frontend directory', async () => {
    // Attempting to run again on the same app when frontend/ exists and is non-empty
    const res = await runner.run(
      cliBin,
      [
        'init',
        '--non-interactive',
        '--mode',
        'frappe-app',
        '--app',
        'crm_custom',
        '--bench-dir',
        mockBenchDir,
        '--framework',
        'frappe-ui',
        '--skip-install',
      ],
      { cwd: tempBaseDir }
    );

    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes('already exists and is not empty. Aborting to protect existing files'));
  });

  test('interactive simulation: user cancels at confirmation prompt', async () => {
    const cancelledProjectName = 'cancelled-project';
    const targetDir = path.join(tempBaseDir, cancelledProjectName);

    // Simulate user answering interactive prompts:
    // 1. Step 1 (Mode): 1 (Standalone)
    // 2. Project name: cancelled-project
    // 3. Step 2 (Framework): 1 (Frappe UI)
    // 4. Step 3 (Language): 1 (TypeScript)
    // 5. Step 5 (Package Manager): 1 (npm)
    // 6. Backend URL: [Enter for default]
    // 7. Confirmation: n (CANCEL)
    const mockPrompter = new MockPrompter(['1', cancelledProjectName, '1', '1', '1', '', 'n']);

    const res = await runInit(
      {
        cwd: tempBaseDir,
        prompter: mockPrompter,
        skipInstall: true,
      },
      runner
    );

    assert.strictEqual(res.cancelled, true);
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(fs.existsSync(targetDir), false, 'Cancelled setup must not create directory');
  });

  test('interactive simulation: user completes wizard with custom choices', async () => {
    const wizardProjectName = 'wizard-vue-bootstrap';
    const targetDir = path.join(tempBaseDir, wizardProjectName);

    // Simulate user answering:
    // 1. Mode: 1 (Standalone)
    // 2. Project name: wizard-vue-bootstrap
    // 3. Framework: 2 (Vue 3)
    // 4. Language: 1 (TypeScript)
    // 5. Styling solution: 3 (Bootstrap 5)
    // 6. Package manager: 1 (npm)
    // 7. Confirmation: y (Proceed)
    const mockPrompter = new MockPrompter(['1', wizardProjectName, '2', '1', '3', '1', 'y']);

    const res = await runInit(
      {
        cwd: tempBaseDir,
        prompter: mockPrompter,
        skipInstall: true,
      },
      runner
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.exitCode, 0);
    assert.ok(fs.existsSync(path.join(targetDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'vite.config.ts')));

    // Check package.json has bootstrap and vue
    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies['vue']);
    assert.ok(pkg.dependencies['bootstrap']);
  });
});
