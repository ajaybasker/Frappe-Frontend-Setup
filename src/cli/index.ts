import { Command } from 'commander';
import { runDoctor } from './doctor';
import { runCreate } from './create';
import pc from 'picocolors';

// Read version safely from package.json
let packageVersion = '0.1.0';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../../package.json');
  if (pkg && pkg.version) {
    packageVersion = pkg.version;
  }
} catch {
  // fallback version
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('frappe-frontend-cli')
    .description('Automated, verified frontend setup CLI for the Frappe Framework ecosystem')
    .version(packageVersion, '-v, --version', 'Output the current version')
    .helpOption('-h, --help', 'Display help for command');

  // Command: doctor
  program
    .command('doctor')
    .description('Diagnose developer environment, Node, package managers, and Frappe context')
    .option('--json', 'Output machine-readable report in JSON format to stdout')
    .action(async (options: { json?: boolean }) => {
      try {
        const { exitCode } = await runDoctor({ json: options.json });
        process.exitCode = exitCode;
      } catch (err) {
        process.stderr.write(
          pc.red(`x Doctor diagnostic failed unexpectedly: ${err instanceof Error ? err.message : String(err)}\n`)
        );
        process.exitCode = 1;
      }
    });

  // Informative handlers for upcoming phases so users have clear expectations
  program
    .command('init')
    .description('[Planned: Phase 4] Interactive stack selector and setup wizard')
    .action(() => {
      process.stderr.write(
        pc.yellow(
          `! 'init' command will be implemented in subsequent phases. Use 'doctor' to check prerequisites.\n`
        )
      );
      process.exitCode = 1;
    });

  program
    .command('create <template> [name]')
    .description('Scaffold a verified frontend project (vue, react)')
    .option('--ts', 'Use TypeScript template (default)')
    .option('--js', 'Use JavaScript template')
    .option('--package-manager <pm>', 'Package manager to use: npm, pnpm, yarn, bun')
    .option('--skip-install', 'Do not install dependencies automatically')
    .option('--skip-build', 'Do not run verification build after installation')
    .action(
      async (
        template: string,
        name: string | undefined,
        options: {
          ts?: boolean;
          js?: boolean;
          packageManager?: string;
          skipInstall?: boolean;
          skipBuild?: boolean;
        }
      ) => {
        try {
          const res = await runCreate(template, name, options);
          process.exitCode = res.exitCode;
        } catch (err) {
          process.stderr.write(
            pc.red(`x Project creation failed: ${err instanceof Error ? err.message : String(err)}\n`)
          );
          process.exitCode = 1;
        }
      }
    );

  program
    .command('add <tool>')
    .description('[Planned: Phase 3] Add CSS framework or tooling (tailwind, bootstrap)')
    .action((tool: string) => {
      process.stderr.write(
        pc.yellow(`! 'add ${tool}' is scheduled for Phase 3 (CSS tooling).\n`)
      );
      process.exitCode = 1;
    });

  program
    .command('integrate <target>')
    .description('[Planned: Phase 5] Connect frontend with a Frappe custom app')
    .action((target: string) => {
      process.stderr.write(
        pc.yellow(`! 'integrate ${target}' is scheduled for Phase 5 (Frappe integration).\n`)
      );
      process.exitCode = 1;
    });

  program
    .command('check')
    .description('[Planned: Phase 5] Inspect existing frontend project for Frappe compatibility')
    .action(() => {
      process.stderr.write(
        pc.yellow(`! 'check' is scheduled for Phase 5 (Project inspection).\n`)
      );
      process.exitCode = 1;
    });

  program.addHelpText(
    'after',
    `
${pc.bold('Examples:')}
  $ npx frappe-frontend-cli --help
  $ npx frappe-frontend-cli --version
  $ npx frappe-frontend-cli doctor
  $ npx frappe-frontend-cli doctor --json
`
  );

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    process.stderr.write(
      pc.red(`x Error: ${err instanceof Error ? err.message : String(err)}\n`)
    );
    process.exitCode = 1;
  }
}
