import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { Runner, RunnerError } from '../src/core/runner';

describe('Runner subprocess gateway', () => {
  const runner = new Runner();

  test('executes a basic command successfully', async () => {
    const res = await runner.run('node', ['-e', 'console.log("runner-ok")']);
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(res.stdout.trim(), 'runner-ok');
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.timedOut, false);
    assert.ok(res.durationMs >= 0);
  });

  test('captures stdout cleanly via capture()', async () => {
    const out = await runner.capture('node', ['-e', 'process.stdout.write("hello-world")']);
    assert.strictEqual(out, 'hello-world');
  });

  test('propagates non-zero exit codes', async () => {
    const res = await runner.run('node', ['-e', 'process.exit(42)']);
    assert.strictEqual(res.exitCode, 42);
    assert.strictEqual(res.timedOut, false);
  });

  test('capture() throws RunnerError on non-zero exit code', async () => {
    await assert.rejects(
      async () => {
        await runner.capture('node', ['-e', 'process.stderr.write("fail-msg"); process.exit(1);']);
      },
      (err: unknown) => {
        assert.ok(err instanceof RunnerError);
        assert.strictEqual(err.exitCode, 1);
        assert.ok(err.stderr.includes('fail-msg'));
        return true;
      }
    );
  });

  test('validates argument array types', () => {
    assert.throws(
      () => {
        // @ts-expect-error testing invalid arguments
        runner.run('node', 'invalid-string-arg');
      },
      { name: 'TypeError', message: 'Command arguments must be an array of strings' }
    );

    assert.throws(
      () => {
        // @ts-expect-error testing invalid arguments
        runner.run('node', [123]);
      },
      { name: 'TypeError', message: 'Argument must be a string, got number' }
    );
  });

  test('rejects arguments containing NUL bytes', () => {
    assert.throws(
      () => {
        runner.run('node', ['arg\0bad']);
      },
      { name: 'Error', message: 'Command arguments must not contain NUL bytes' }
    );
  });

  test('does not interpret shell meta-characters (shell: false guarantee)', async () => {
    // If shell was true, "hello; echo injected" would execute two commands.
    // With shell: false, node treats the entire string as code/args without shell expansion.
    const res = await runner.run('node', ['-e', 'console.log(process.argv[1])', 'arg1; echo injected && echo pwned']);
    assert.strictEqual(res.exitCode, 0);
    assert.strictEqual(res.stdout.trim(), 'arg1; echo injected && echo pwned');
  });

  test('handles timeouts properly', async () => {
    const res = await runner.run(
      'node',
      ['-e', 'setTimeout(() => {}, 10000)'],
      { timeoutMs: 300 }
    );
    assert.strictEqual(res.timedOut, true);
    assert.strictEqual(res.exitCode, 124);
  });

  test('handles maxBuffer overflow', async () => {
    await assert.rejects(
      async () => {
        // Generates 200KB of stdout with 10KB maxBuffer
        await runner.run('node', ['-e', 'console.log("x".repeat(200000))'], {
          maxBuffer: 10 * 1024,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('maxBuffer'));
        return true;
      }
    );
  });

  test('killAll terminates running children cleanly', async () => {
    const customRunner = new Runner();
    const runPromise = customRunner.run('node', ['-e', 'setTimeout(() => {}, 10000)']);

    // Allow process to spawn
    await new Promise((r) => setTimeout(r, 100));
    customRunner.killAll('SIGTERM');

    const res = await runPromise;
    // Process should be terminated by signal
    assert.ok(res.exitCode !== 0);
  });
});
