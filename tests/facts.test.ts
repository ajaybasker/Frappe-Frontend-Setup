import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { gatherFacts, detectOs, detectNode } from '../src/core/facts';

describe('Environment Fact Gathering', () => {
  test('detectOs returns current platform facts', () => {
    const osFacts = detectOs();
    assert.strictEqual(typeof osFacts.platform, 'string');
    assert.strictEqual(typeof osFacts.arch, 'string');
    assert.strictEqual(typeof osFacts.release, 'string');
    assert.strictEqual(typeof osFacts.isLinux, 'boolean');
    assert.strictEqual(typeof osFacts.isMac, 'boolean');
    assert.strictEqual(typeof osFacts.isWindows, 'boolean');
  });

  test('detectNode returns valid semver for current process', () => {
    const nodeFacts = detectNode();
    assert.ok(nodeFacts.major >= 18);
    assert.ok(nodeFacts.version.startsWith('v'));
    assert.ok(nodeFacts.path.length > 0);
  });

  test('gatherFacts collects full environment facts', async () => {
    const facts = await gatherFacts();
    assert.ok(facts.os);
    assert.ok(facts.node);
    assert.ok(facts.packageManagers);
    assert.ok(facts.git);
    assert.ok(facts.bench);
    assert.ok(facts.cwd);

    // npm should be available on this development system
    assert.ok(facts.packageManagers.available.includes('npm'));
    assert.ok(facts.git.available);
  });
});
