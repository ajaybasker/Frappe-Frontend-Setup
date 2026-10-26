import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateProjectName, validateTargetDirectory } from '../src/core/validation';

describe('Project Name Validation', () => {
  test('accepts valid project names', () => {
    assert.strictEqual(validateProjectName('my-vue-app').valid, true);
    assert.strictEqual(validateProjectName('frappe_frontend_123').valid, true);
    assert.strictEqual(validateProjectName('myApp').valid, true);
    assert.strictEqual(validateProjectName('a').valid, true);
  });

  test('rejects empty or whitespace-only names', () => {
    assert.strictEqual(validateProjectName('').valid, false);
    assert.strictEqual(validateProjectName('   ').valid, false);
    // @ts-expect-error testing invalid type
    assert.strictEqual(validateProjectName(null).valid, false);
  });

  test('rejects names starting with dot or underscore', () => {
    const dotRes = validateProjectName('.hidden-project');
    assert.strictEqual(dotRes.valid, false);
    assert.ok(dotRes.error?.includes('dot or underscore'));

    const underRes = validateProjectName('_private_project');
    assert.strictEqual(underRes.valid, false);
    assert.ok(underRes.error?.includes('dot or underscore'));
  });

  test('rejects reserved package names', () => {
    const res = validateProjectName('node_modules');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error?.includes('reserved'));
  });

  test('rejects names with invalid characters or path separators', () => {
    assert.strictEqual(validateProjectName('my/app').valid, false);
    assert.strictEqual(validateProjectName('my\\app').valid, false);
    assert.strictEqual(validateProjectName('my project').valid, false);
    assert.strictEqual(validateProjectName('project!').valid, false);
    assert.strictEqual(validateProjectName('project@name').valid, false);
  });
});

describe('Target Directory Validation', () => {
  test('validates non-existent directory as ready for new project', () => {
    const nonExistent = path.join(os.tmpdir(), `frappe-test-nonexistent-${Date.now()}`);
    const res = validateTargetDirectory(nonExistent);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.exists, false);
    assert.strictEqual(res.isEmpty, true);
  });

  test('refuses to allow root directory as target', () => {
    const res = validateTargetDirectory('/');
    assert.strictEqual(res.valid, false);
    assert.ok(res.error?.includes('root'));
  });

  test('refuses to overwrite existing non-empty directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-nonempty-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'existing-file.txt'), 'content');

      const res = validateTargetDirectory(tempDir);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.exists, true);
      assert.strictEqual(res.isEmpty, false);
      assert.ok(res.error?.includes('not empty'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('accepts existing empty directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frappe-empty-'));
    try {
      const res = validateTargetDirectory(tempDir);
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.exists, true);
      assert.strictEqual(res.isEmpty, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('rejects if target is an existing file, not directory', () => {
    const tempFile = path.join(os.tmpdir(), `frappe-file-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'data');
    try {
      const res = validateTargetDirectory(tempFile);
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('not a directory'));
    } finally {
      fs.rmSync(tempFile, { force: true });
    }
  });
});
