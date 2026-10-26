import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { evaluateEnvironment } from '../src/core/evaluator';
import { EnvironmentFacts } from '../src/core/types';

function createMockFacts(overrides: Partial<EnvironmentFacts> = {}): EnvironmentFacts {
  return {
    os: {
      platform: 'linux',
      release: '6.8.0',
      arch: 'x64',
      isLinux: true,
      isMac: false,
      isWindows: false,
      isWsl: false,
    },
    node: {
      version: 'v20.20.0',
      major: 20,
      minor: 20,
      patch: 0,
      path: '/usr/bin/node',
    },
    packageManagers: {
      npm: { name: 'npm', version: '10.8.0', path: 'npm' },
      available: ['npm'],
      preferred: 'npm',
    },
    git: {
      available: true,
      version: '2.43.0',
      path: 'git',
    },
    bench: {
      cliAvailable: false,
      isInsideBench: false,
      isInsideApp: false,
    },
    cwd: '/mock/workspace',
    ...overrides,
  };
}

describe('Environment Evaluator (Pure Function)', () => {
  test('evaluates ideal environment as healthy with all checks ok', () => {
    const facts = createMockFacts();
    const report = evaluateEnvironment(facts);

    assert.strictEqual(report.healthy, true);
    assert.strictEqual(report.summary.failures, 0);
    assert.ok(report.summary.passed >= 4);

    const osCheck = report.checks.find((c) => c.category === 'os');
    assert.strictEqual(osCheck?.status, 'ok');

    const nodeCheck = report.checks.find((c) => c.category === 'node');
    assert.strictEqual(nodeCheck?.status, 'ok');

    const pmCheck = report.checks.find((c) => c.category === 'package-manager');
    assert.strictEqual(pmCheck?.status, 'ok');

    const gitCheck = report.checks.find((c) => c.category === 'git');
    assert.strictEqual(gitCheck?.status, 'ok');
  });

  test('flags Node < 18.0.0 as failure with upgrade hint', () => {
    const facts = createMockFacts({
      node: {
        version: 'v16.14.0',
        major: 16,
        minor: 14,
        patch: 0,
        path: '/usr/bin/node',
      },
    });

    const report = evaluateEnvironment(facts);
    assert.strictEqual(report.healthy, false);
    assert.ok(report.summary.failures > 0);

    const nodeCheck = report.checks.find((c) => c.category === 'node');
    assert.strictEqual(nodeCheck?.status, 'fail');
    assert.ok(nodeCheck?.message.includes('not supported'));
    assert.ok(nodeCheck?.hint?.includes('Upgrade Node.js'));
  });

  test('flags Node 18 as warning because 20+ is recommended', () => {
    const facts = createMockFacts({
      node: {
        version: 'v18.19.0',
        major: 18,
        minor: 19,
        patch: 0,
        path: '/usr/bin/node',
      },
    });

    const report = evaluateEnvironment(facts);
    assert.strictEqual(report.healthy, true);
    assert.strictEqual(report.summary.failures, 0);
    assert.ok(report.summary.warnings >= 1);

    const nodeCheck = report.checks.find((c) => c.category === 'node');
    assert.strictEqual(nodeCheck?.status, 'warn');
    assert.ok(nodeCheck?.message.includes('meets minimum'));
  });

  test('flags unsupported OS as failure', () => {
    const facts = createMockFacts({
      os: {
        platform: 'aix' as NodeJS.Platform,
        release: '1.0',
        arch: 'ppc64',
        isLinux: false,
        isMac: false,
        isWindows: false,
        isWsl: false,
      },
    });

    const report = evaluateEnvironment(facts);
    assert.strictEqual(report.healthy, false);
    const osCheck = report.checks.find((c) => c.category === 'os');
    assert.strictEqual(osCheck?.status, 'fail');
    assert.ok(osCheck?.message.includes('unsupported'));
  });

  test('flags Windows as experimental warning with WSL2 hint', () => {
    const facts = createMockFacts({
      os: {
        platform: 'win32',
        release: '10.0',
        arch: 'x64',
        isLinux: false,
        isMac: false,
        isWindows: true,
        isWsl: false,
      },
    });

    const report = evaluateEnvironment(facts);
    assert.strictEqual(report.healthy, true); // not blocking
    const osCheck = report.checks.find((c) => c.category === 'os');
    assert.strictEqual(osCheck?.status, 'warn');
    assert.ok(osCheck?.hint?.includes('WSL2'));
  });

  test('flags missing package managers as failure', () => {
    const facts = createMockFacts({
      packageManagers: {
        available: [],
        preferred: 'npm',
      },
    });

    const report = evaluateEnvironment(facts);
    assert.strictEqual(report.healthy, false);
    const pmCheck = report.checks.find((c) => c.category === 'package-manager');
    assert.strictEqual(pmCheck?.status, 'fail');
    assert.ok(pmCheck?.hint?.includes('Install npm'));
  });

  test('flags missing Git as failure', () => {
    const facts = createMockFacts({
      git: { available: false },
    });

    const report = evaluateEnvironment(facts);
    assert.strictEqual(report.healthy, false);
    const gitCheck = report.checks.find((c) => c.category === 'git');
    assert.strictEqual(gitCheck?.status, 'fail');
    assert.ok(gitCheck?.hint?.includes('Install Git'));
  });

  test('reports when inside a Frappe custom app', () => {
    const facts = createMockFacts({
      bench: {
        cliAvailable: true,
        isInsideBench: true,
        benchRoot: '/home/user/frappe-bench',
        isInsideApp: true,
        appName: 'hrms',
        appRoot: '/home/user/frappe-bench/apps/hrms',
      },
    });

    const report = evaluateEnvironment(facts);
    const benchCheck = report.checks.find((c) => c.category === 'bench');
    assert.strictEqual(benchCheck?.status, 'info');
    assert.ok(benchCheck?.message.includes('hrms'));
  });

  test('reports when inside a Frappe bench workspace', () => {
    const facts = createMockFacts({
      bench: {
        cliAvailable: true,
        isInsideBench: true,
        benchRoot: '/home/user/frappe-bench',
        isInsideApp: false,
      },
    });

    const report = evaluateEnvironment(facts);
    const benchCheck = report.checks.find((c) => c.category === 'bench');
    assert.strictEqual(benchCheck?.status, 'info');
    assert.ok(benchCheck?.message.includes('Frappe Bench workspace'));
  });
});
