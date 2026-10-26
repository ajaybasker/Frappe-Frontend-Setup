import { gatherFacts } from '../core/facts';
import { evaluateEnvironment } from '../core/evaluator';
import { printDoctorReport } from '../core/ui';
import { defaultRunner, Runner } from '../core/runner';
import { DoctorReport } from '../core/types';

export interface DoctorOptions {
  json?: boolean;
  cwd?: string;
}

export async function runDoctor(
  options: DoctorOptions = {},
  runner: Runner = defaultRunner
): Promise<{ report: DoctorReport; exitCode: number }> {
  const cwd = options.cwd || process.cwd();
  const facts = await gatherFacts(runner, cwd);
  const report = evaluateEnvironment(facts);

  if (options.json) {
    // Rule: Clean JSON goes strictly to stdout
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    // Diagnostic messages go to stderr
    printDoctorReport(report, (s) => process.stderr.write(s + '\n'));
  }

  const exitCode = report.healthy ? 0 : 1;
  return { report, exitCode };
}
