import { Command } from 'commander';
import { runDoctor } from './doctor';
import { runCreate } from './create';
import { runAdd } from './add';
import { runInit } from './init';
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

  // Command: init
  program
    .command('init')
    .description('Interactive setup wizard to initialize or configure a Frappe frontend project')
    .option('--non-interactive', 'Run without interactive prompts')
    .option('-y, --yes', 'Answer yes to all prompts / run non-interactively')
    .option('--mode <mode>', 'Project mode: standalone or frappe-app (default: standalone)')
    .option('--name <name>', 'Project name (for standalone mode)')
    .option('--app <app>', 'Frappe custom app name (for frappe-app mode)')
    .option('--bench-dir <path>', 'Frappe bench root directory')
    .option('--framework <framework>', 'Frontend framework: frappe-ui, vue, react, none')
    .option('--react', 'Target React (used for validation)')
    .option('--ts', 'Use TypeScript')
    .option('--js', 'Use JavaScript')
    .option('--css <tool>', 'CSS solution: tailwind-v4, tailwind-v3, bootstrap, scss, none')
    .option('--package-manager <pm>', 'Package manager: npm, pnpm, yarn, bun')
    .option('--backend-url <url>', 'Frappe backend proxy URL (default: http://127.0.0.1:8000)')
    .option('--skip-install', 'Do not install dependencies automatically')
    .option('--skip-build', 'Do not run verification build')
    .action(async (options) => {
      try {
        const res = await runInit(options);
        process.exitCode = res.exitCode;
      } catch (err) {
        process.stderr.write(
          pc.red(`x Wizard failed: ${err instanceof Error ? err.message : String(err)}\n`)
        );
        process.exitCode = 1;
      }
    });

  program
    .command('create <template> [name]')
    .description('Scaffold a verified frontend project (vue, react, frappe-ui)')
    .option('--ts', 'Use TypeScript template (default)')
    .option('--js', 'Use JavaScript template')
    .option('--framework <framework>', 'Framework target: vue, react, frappe-ui')
    .option('--react', 'Target React framework (used for compatibility validation)')
    .option('--package-manager <pm>', 'Package manager to use: npm, pnpm, yarn, bun')
    .option('--backend-url <url>', 'Frappe backend proxy URL (default: http://127.0.0.1:8000)')
    .option('--skip-install', 'Do not install dependencies automatically')
    .option('--skip-build', 'Do not run verification build after installation')
    .action(
      async (
        template: string,
        name: string | undefined,
        options: {
          ts?: boolean;
          js?: boolean;
          framework?: string;
          react?: boolean;
          packageManager?: string;
          backendUrl?: string;
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
    .description('Add a CSS framework or tooling (tailwind, bootstrap, scss) to an existing project')
    .option('--v3', 'Use Tailwind CSS v3 compatibility mode (for tailwind)')
    .option('--v4', 'Use Tailwind CSS v4 mode (default for tailwind)')
    .option('--skip-install', 'Do not install dependencies automatically')
    .option('--skip-build', 'Do not run verification build')
    .action(
      async (
        tool: string,
        options: {
          v3?: boolean;
          v4?: boolean;
          skipInstall?: boolean;
          skipBuild?: boolean;
        }
      ) => {
        try {
          const res = await runAdd(tool, options);
          process.exitCode = res.exitCode;
        } catch (err) {
          process.stderr.write(
            pc.red(`x Failed to add tool: ${err instanceof Error ? err.message : String(err)}\n`)
          );
          process.exitCode = 1;
        }
      }
    );

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
