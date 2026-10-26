#!/usr/bin/env node

import { runCli } from '../cli/index';

runCli(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`x Unexpected error: ${message}\n`);
  process.exit(1);
});
