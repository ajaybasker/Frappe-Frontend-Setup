import pc from 'picocolors';
import { CheckStatus, DoctorReport } from './types';

export const SYMBOLS: Record<CheckStatus, string> = {
  ok: pc.green('✔'),
  fail: pc.red('✖'),
  warn: pc.yellow('⚠'),
  info: pc.cyan('ℹ'),
};

export const STATUS_LABELS: Record<CheckStatus, string> = {
  ok: pc.green('[OK]'),
  fail: pc.red('[FAIL]'),
  warn: pc.yellow('[WARN]'),
  info: pc.cyan('[INFO]'),
};

export function formatKeyValue(key: string, value: string, padWidth = 24): string {
  const paddedKey = key.padEnd(padWidth, ' ');
  return `  ${pc.dim(paddedKey)} ${value}`;
}

export function printDoctorReport(report: DoctorReport, write: (str: string) => void = (s) => process.stderr.write(s + '\n')): void {
  const { facts, checks, summary } = report;

  write('');
  write(pc.bold(pc.cyan('Frappe Frontend Setup CLI — Environment Doctor')));
  write(pc.dim('─'.repeat(60)));
  write('');

  // Overview Table
  write(pc.bold('System Overview:'));
  write(formatKeyValue('Operating System:', `${facts.os.platform} (${facts.os.arch}) [${facts.os.release}]`));
  write(formatKeyValue('Node.js Version:', `${facts.node.version} (${facts.node.path})`));

  const pmList = facts.packageManagers.available.length
    ? facts.packageManagers.available
        .map((p) => {
          const info = facts.packageManagers[p as 'npm' | 'pnpm' | 'yarn' | 'bun'];
          const isPref = p === facts.packageManagers.preferred ? pc.green(' (preferred)') : '';
          return `${p} ${info?.version || ''}${isPref}`;
        })
        .join(', ')
    : pc.red('none');

  write(formatKeyValue('Package Managers:', pmList));
  write(
    formatKeyValue(
      'Git Version Control:',
      facts.git.available ? `${facts.git.version || 'installed'}` : pc.red('not found')
    )
  );

  let benchStatus = pc.dim('not detected');
  if (facts.bench.isInsideApp) {
    benchStatus = pc.green(`Inside custom app '${facts.bench.appName}'`);
  } else if (facts.bench.isInsideBench) {
    benchStatus = pc.green(`Inside bench at ${facts.bench.benchRoot}`);
  } else if (facts.bench.cliAvailable) {
    benchStatus = pc.cyan(`Bench CLI on PATH (${facts.bench.cliVersion || 'ready'})`);
  }
  write(formatKeyValue('Frappe Bench Context:', benchStatus));
  write(formatKeyValue('Working Directory:', facts.cwd));
  write('');

  // Checks Section
  write(pc.bold('Diagnostic Checks:'));
  for (const check of checks) {
    const symbol = SYMBOLS[check.status];
    write(`  ${symbol} ${pc.bold(check.title)}: ${check.message}`);
    if (check.hint) {
      write(`    ${pc.dim('↳ Hint:')} ${pc.yellow(check.hint)}`);
    }
  }

  write('');
  write(pc.dim('─'.repeat(60)));

  // Summary
  if (summary.failures > 0) {
    write(
      pc.red(
        pc.bold(
          `✖ Diagnostics completed with ${summary.failures} failure(s) and ${summary.warnings} warning(s).`
        )
      )
    );
    write(pc.red('  Please address the failed items above before proceeding with project setup.'));
  } else if (summary.warnings > 0) {
    write(
      pc.yellow(
        pc.bold(
          `⚠ Diagnostics completed: all prerequisites met with ${summary.warnings} advisory warning(s).`
        )
      )
    );
  } else {
    write(
      pc.green(
        pc.bold(
          `✔ All essential frontend prerequisites are satisfied (${summary.passed} checks passed).`
        )
      )
    );
  }
  write('');
}
