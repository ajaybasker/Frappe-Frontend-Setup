import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'node:path';
import { Runner } from '../src/core/runner';

describe('CLI executable end-to-end', () => {
  const runner = new Runner();
  const cliBin = path.resolve(__dirname, '../../bin/frappe-frontend-cli.js');

  test('--help outputs usage and commands with exit code 0', async () => {
    const res = await runner.run(cliBin, ['--help']);
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes('Usage: frappe-frontend-cli'));
    assert.ok(res.stdout.includes('doctor'));
    assert.ok(res.stdout.includes('Examples:'));
  });

  test('-h short flag works identical to --help', async () => {
    const res = await runner.run(cliBin, ['-h']);
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes('Usage: frappe-frontend-cli'));
  });

  test('--version outputs package version with exit code 0', async () => {
    const res = await runner.run(cliBin, ['--version']);
    assert.strictEqual(res.exitCode, 0);
    assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  test('doctor command runs and outputs diagnostics', async () => {
    const res = await runner.run(cliBin, ['doctor']);
    assert.strictEqual(res.exitCode, 0);
    // Human diagnostic output goes to stderr by design rule
    assert.ok(res.stderr.includes('Environment Doctor'));
    assert.ok(res.stderr.includes('Operating System:'));
    assert.ok(res.stderr.includes('Node.js Version:'));
    assert.ok(res.stderr.includes('Diagnostic Checks:'));
  });

  test('doctor --json outputs clean, valid JSON to stdout only', async () => {
    const res = await runner.run(cliBin, ['doctor', '--json']);
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(res.stderr, ''); // stderr should be clean

    // Verify valid JSON parses correctly
    const parsed = JSON.parse(res.stdout);
    assert.strictEqual(typeof parsed, 'object');
    assert.strictEqual(typeof parsed.healthy, 'boolean');
    assert.ok(Array.isArray(parsed.checks));
    assert.ok(parsed.facts.node.version);
    assert.ok(parsed.facts.os.platform);
  });

  test('unknown command prints error and exits with non-zero exit code', async () => {
    const res = await runner.run(cliBin, ['non-existent-cmd']);
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes("error: unknown command 'non-existent-cmd'"));
  });

  test('unsupported integration target prints error and exits with code 1', async () => {
    const res = await runner.run(cliBin, ['integrate', 'unsupported']);
    assert.strictEqual(res.exitCode, 1);
    assert.ok(res.stderr.includes("Unsupported integration target 'unsupported'"));
  });
});
