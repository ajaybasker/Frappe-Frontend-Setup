import * as path from 'node:path';
import * as fs from 'node:fs';
import pc from 'picocolors';
import { Runner, defaultRunner } from '../core/runner';
import { detectPackageManagers, detectPackageManager } from '../core/facts';
import { validateFrappeApp, findBenchDirectory, FrappeAppInfo } from '../core/frappe-app';
import { runCreate } from './create';
import { runAdd } from './add';
import { SupportedPackageManager } from '../adapters/frameworks';
import { validateProjectName, validateTargetDirectory } from '../core/validation';

export interface InitOptions {
  nonInteractive?: boolean;
  yes?: boolean;
  mode?: 'standalone' | 'frappe-app';
  name?: string;
  app?: string;
  benchDir?: string;
  framework?: 'vue' | 'react' | 'frappe-ui' | 'none' | 'vanilla';
  language?: 'ts' | 'js';
  ts?: boolean;
  js?: boolean;
  css?: 'tailwind' | 'tailwind-v4' | 'tailwind-v3' | 'bootstrap' | 'scss' | 'none';
  packageManager?: string;
  backendUrl?: string;
  skipInstall?: boolean;
  skipBuild?: boolean;
  cwd?: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  prompter?: Prompter;
}

export interface InitResult {
  success: boolean;
  targetDir: string;
  mode: 'standalone' | 'frappe-app';
  framework: string;
  language: 'ts' | 'js';
  packageManager: string;
  installed: boolean;
  built: boolean;
  cancelled?: boolean;
  error?: string;
  exitCode: number;
}

import * as readlinePromises from 'node:readline/promises';

export interface Prompter {
  ask(question: string, defaultValue?: string): Promise<string>;
  choose(
    title: string,
    choices: { label: string; value: string; hint?: string }[],
    defaultIndex?: number
  ): Promise<string>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  close(): void;
}

export class ReadlinePrompter implements Prompter {
  private rl: readlinePromises.Interface;

  constructor(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stderr) {
    this.rl = readlinePromises.createInterface({ input, output });
  }

  close(): void {
    this.rl.close();
  }

  async ask(question: string, defaultValue?: string): Promise<string> {
    const q = defaultValue ? `${question} [Default: ${defaultValue}]: ` : `${question}: `;
    const answer = await this.rl.question(pc.cyan(q));
    const trimmed = answer.trim();
    return trimmed || defaultValue || '';
  }

  async choose(
    title: string,
    choices: { label: string; value: string; hint?: string }[],
    defaultIndex = 0
  ): Promise<string> {
    process.stderr.write(pc.bold(`\n${title}\n`));
    choices.forEach((c, idx) => {
      const isDefault = idx === defaultIndex;
      const num = `[${idx + 1}]`;
      const line = `  ${pc.cyan(num)} ${c.label}${c.hint ? pc.dim(` (${c.hint})`) : ''}${
        isDefault ? pc.green(' (default)') : ''
      }\n`;
      process.stderr.write(line);
    });

    const promptText = `Select option [1-${choices.length}] (default: ${defaultIndex + 1}): `;
    const answer = await this.rl.question(pc.cyan(promptText));
    const trimmed = answer.trim();
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= choices.length) {
      return choices[num - 1].value;
    }
    return choices[defaultIndex].value;
  }

  async confirm(question: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await this.rl.question(pc.cyan(`\n${question} ${hint} `));
    const trimmed = answer.trim().toLowerCase();
    if (!trimmed) {
      return defaultYes;
    }
    return trimmed === 'y' || trimmed === 'yes';
  }
}

export class MockPrompter implements Prompter {
  private answers: string[];
  private currentIndex = 0;

  constructor(answers: string[]) {
    this.answers = answers;
  }

  close(): void {}

  private nextAnswer(): string | undefined {
    if (this.currentIndex < this.answers.length) {
      return this.answers[this.currentIndex++];
    }
    return undefined;
  }

  async ask(_question: string, defaultValue?: string): Promise<string> {
    const ans = this.nextAnswer();
    return ans !== undefined && ans.trim() !== '' ? ans.trim() : defaultValue || '';
  }

  async choose(
    _title: string,
    choices: { label: string; value: string; hint?: string }[],
    defaultIndex = 0
  ): Promise<string> {
    const ans = this.nextAnswer();
    if (ans !== undefined) {
      const num = parseInt(ans.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= choices.length) {
        return choices[num - 1].value;
      }
      const direct = choices.find((c) => c.value === ans.trim().toLowerCase());
      if (direct) {
        return direct.value;
      }
    }
    return choices[defaultIndex].value;
  }

  async confirm(_question: string, defaultYes = true): Promise<boolean> {
    const ans = this.nextAnswer();
    if (ans === undefined || ans.trim() === '') {
      return defaultYes;
    }
    const trimmed = ans.trim().toLowerCase();
    return trimmed === 'y' || trimmed === 'yes';
  }
}

export async function runInit(
  options: InitOptions = {},
  runner: Runner = defaultRunner
): Promise<InitResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const isNonInteractive = Boolean(options.nonInteractive || options.yes);

  // Print Welcome banner
  process.stderr.write(
    pc.cyan(
      pc.bold(
        `\n============================================================\n` +
          `   Frappe Frontend Setup Wizard\n` +
          `   Automated, verified frontend tooling for Frappe\n` +
          `============================================================\n\n`
      )
    )
  );

  let mode: 'standalone' | 'frappe-app' = options.mode || 'standalone';
  let appInfo: FrappeAppInfo | undefined;
  let projectName = options.name || '';
  let targetDir = '';
  let framework = (options.framework || '').toLowerCase().trim();
  let language: 'ts' | 'js' = options.js && !options.ts ? 'js' : 'ts';
  let cssTool = (options.css || '').toLowerCase().trim();
  let packageManager = options.packageManager?.toLowerCase().trim() as SupportedPackageManager | undefined;
  let backendUrl = options.backendUrl || 'http://127.0.0.1:8000';

  const prompter: Prompter | undefined = isNonInteractive
    ? undefined
    : options.prompter || new ReadlinePrompter(options.input, options.output);

  try {
    // -------------------------------------------------------------
    // STEP 1: Project Type (Standalone vs Frappe App)
    // -------------------------------------------------------------
    if (!isNonInteractive && prompter) {
      const modeChoice = await prompter.choose(
        'Step 1: Choose project target',
        [
          {
            label: 'Standalone frontend project',
            value: 'standalone',
            hint: 'Independent Vite SPA repository',
          },
          {
            label: 'Configure existing Frappe custom app',
            value: 'frappe-app',
            hint: 'In-tree frontend inside bench apps directory',
          },
        ],
        0
      );
      mode = modeChoice as 'standalone' | 'frappe-app';
    }

    // -------------------------------------------------------------
    // STEP 2: App detection / Target directory validation
    // -------------------------------------------------------------
    if (mode === 'frappe-app') {
      let appName = options.app || '';

      if (!appName && !isNonInteractive && prompter) {
        // Try to detect bench and suggest detected bench path
        const detectedBench = options.benchDir || findBenchDirectory(cwd);
        if (detectedBench) {
          process.stderr.write(pc.dim(`Detected Frappe bench at: ${detectedBench}\n`));
        }

        appName = await prompter.ask('Enter Frappe custom app name');
      }

      if (!appName) {
        process.stderr.write(
          pc.red(`x Missing required Frappe custom app name. Use --app <app_name> in non-interactive mode.\n`)
        );
        return {
          success: false,
          targetDir: '',
          mode,
          framework: framework || 'frappe-ui',
          language,
          packageManager: packageManager || 'npm',
          installed: false,
          built: false,
          error: 'Missing Frappe app name',
          exitCode: 1,
        };
      }

      const validation = validateFrappeApp(appName, { benchDir: options.benchDir, cwd });
      if (!validation.valid || !validation.app) {
        process.stderr.write(pc.red(`x ${validation.error}\n`));
        return {
          success: false,
          targetDir: '',
          mode,
          framework: framework || 'frappe-ui',
          language,
          packageManager: packageManager || 'npm',
          installed: false,
          built: false,
          error: validation.error,
          exitCode: 1,
        };
      }

      appInfo = validation.app;
      projectName = 'frontend';
      targetDir = appInfo.frontendDir;

      process.stderr.write(
        pc.green(`✔ Found Frappe custom app '${appInfo.appName}' at ${appInfo.appDir}\n`)
      );
      if (appInfo.benchDir) {
        process.stderr.write(pc.dim(`  Bench directory: ${appInfo.benchDir}\n`));
      }

      // Check if frontend directory already exists and contains files
      if (appInfo.hasFrontendDir) {
        const files = fs.readdirSync(targetDir);
        if (files.length > 0) {
          if (isNonInteractive) {
            const err = `x Frontend directory '${targetDir}' already exists and is not empty. Aborting to protect existing files.`;
            process.stderr.write(pc.red(`${err}\n`));
            return {
              success: false,
              targetDir,
              mode,
              framework: framework || 'frappe-ui',
              language,
              packageManager: packageManager || 'npm',
              installed: false,
              built: false,
              error: err,
              exitCode: 1,
            };
          } else if (prompter) {
            process.stderr.write(
              pc.yellow(`! Warning: Target directory '${targetDir}' already exists and contains ${files.length} items.\n`)
            );
            const proceed = await prompter.confirm('Continue anyway? Existing files may cause conflicts:', false);
            if (!proceed) {
              process.stderr.write(pc.yellow('Setup aborted by user.\n'));
              return {
                success: false,
                targetDir,
                mode,
                framework: framework || 'frappe-ui',
                language,
                packageManager: packageManager || 'npm',
                installed: false,
                built: false,
                cancelled: true,
                exitCode: 0,
              };
            }
          }
        }
      }
    } else {
      // Standalone mode
      if (!projectName && !isNonInteractive && prompter) {
        projectName = await prompter.ask('Enter project name', 'my-frappe-frontend');
      } else if (!projectName) {
        projectName = 'my-frappe-frontend';
      }

      const nameValidation = validateProjectName(projectName);
      if (!nameValidation.valid) {
        process.stderr.write(pc.red(`x Invalid project name '${projectName}': ${nameValidation.error}\n`));
        return {
          success: false,
          targetDir: '',
          mode,
          framework: framework || 'frappe-ui',
          language,
          packageManager: packageManager || 'npm',
          installed: false,
          built: false,
          error: nameValidation.error,
          exitCode: 1,
        };
      }

      const dirValidation = validateTargetDirectory(projectName, cwd);
      if (!dirValidation.valid) {
        process.stderr.write(pc.red(`x ${dirValidation.error}\n`));
        return {
          success: false,
          targetDir: dirValidation.resolvedPath,
          mode,
          framework: framework || 'frappe-ui',
          language,
          packageManager: packageManager || 'npm',
          installed: false,
          built: false,
          error: dirValidation.error,
          exitCode: 1,
        };
      }
      targetDir = dirValidation.resolvedPath;
    }

    // -------------------------------------------------------------
    // STEP 3: Framework Selection
    // -------------------------------------------------------------
    if (!framework && !isNonInteractive && prompter) {
      const fwChoice = await prompter.choose(
        'Step 2: Choose frontend framework',
        [
          {
            label: 'Frappe UI',
            value: 'frappe-ui',
            hint: 'Vue 3 + Tailwind CSS v3 + Official Frappe UI components (Recommended)',
          },
          {
            label: 'Vue 3',
            value: 'vue',
            hint: 'Standard Vue 3 + Vite project',
          },
          {
            label: 'React',
            value: 'react',
            hint: 'Modern React + Vite project',
          },
          {
            label: 'No framework yet',
            value: 'none',
            hint: 'Vanilla HTML / JS / Vite foundation',
          },
        ],
        0
      );
      framework = fwChoice;
    } else if (!framework) {
      framework = 'frappe-ui';
    }

    // Reject React + Frappe UI combination
    if (
      framework === 'frappe-ui' &&
      ((options as any).react || (options as any).framework === 'react' || options.css === 'bootstrap')
    ) {
      // Check if user specifically requested react with frappe-ui
      if ((options as any).react || (options as any).framework === 'react') {
        const err = 'Frappe UI is built exclusively for Vue 3 and does not support React.';
        process.stderr.write(
          pc.red(
            `x ${err}\n` +
              `  Frappe UI components rely on Vue 3 reactivity and Vue single file components.\n` +
              `  To create a React project, select 'react' as your framework.\n`
          )
        );
        return {
          success: false,
          targetDir,
          mode,
          framework: 'frappe-ui',
          language,
          packageManager: packageManager || 'npm',
          installed: false,
          built: false,
          error: err,
          exitCode: 1,
        };
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Language Selection (TS vs JS)
    // -------------------------------------------------------------
    if (!options.ts && !options.js && !isNonInteractive && prompter && framework !== 'none') {
      const langChoice = await prompter.choose(
        'Step 3: Choose language',
        [
          { label: 'TypeScript', value: 'ts', hint: 'Recommended for type safety' },
          { label: 'JavaScript', value: 'js', hint: 'Plain ESNext' },
        ],
        0
      );
      language = langChoice as 'ts' | 'js';
    }

    // -------------------------------------------------------------
    // STEP 5: Styling Tooling Selection
    // -------------------------------------------------------------
    if (framework === 'frappe-ui') {
      cssTool = 'tailwind-v3';
    } else if (!cssTool && !isNonInteractive && prompter) {
      const cssChoices = [
        {
          label: 'Tailwind CSS v4',
          value: 'tailwind-v4',
          hint: 'Modern Vite integration via @tailwindcss/vite (Recommended)',
        },
        {
          label: 'Tailwind CSS v3',
          value: 'tailwind-v3',
          hint: 'Compatibility mode via PostCSS',
        },
        {
          label: 'Bootstrap 5',
          value: 'bootstrap',
          hint: 'Bootstrap 5 + Popper.js',
        },
        {
          label: 'SCSS',
          value: 'scss',
          hint: 'Sass styling via sass-embedded',
        },
        {
          label: 'None',
          value: 'none',
          hint: 'Plain vanilla CSS',
        },
      ];

      const choice = await prompter.choose('Step 4: Choose styling solution', cssChoices, 0);
      cssTool = choice;
    } else if (!cssTool) {
      cssTool = framework === 'none' ? 'none' : 'tailwind-v4';
    }

    // -------------------------------------------------------------
    // STEP 6: Package Manager Selection
    // -------------------------------------------------------------
    const pmFacts = await detectPackageManagers(runner);
    if (!packageManager && !isNonInteractive && prompter) {
      const pmChoices: { label: string; value: string; hint?: string }[] = [];
      const supportedPms: SupportedPackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

      for (const pm of supportedPms) {
        const info = pmFacts[pm];
        if (info) {
          pmChoices.push({
            label: pm,
            value: pm,
            hint: `v${info.version}${pm === pmFacts.preferred ? ', preferred' : ''}`,
          });
        }
      }

      if (pmChoices.length === 0) {
        pmChoices.push({ label: 'npm', value: 'npm', hint: 'default' });
      }

      const defaultIndex = pmChoices.findIndex((c) => c.value === pmFacts.preferred);
      const choice = await prompter.choose(
        'Step 5: Choose package manager',
        pmChoices,
        defaultIndex >= 0 ? defaultIndex : 0
      );
      packageManager = choice as SupportedPackageManager;
    } else if (!packageManager) {
      packageManager = pmFacts.preferred;
    }

    // Validate package manager availability
    const pmInfo = await detectPackageManager(packageManager, runner);
    if (!pmInfo) {
      const err = `Package manager '${packageManager}' is not available on PATH.`;
      process.stderr.write(pc.red(`x ${err}\n`));
      return {
        success: false,
        targetDir,
        mode,
        framework,
        language,
        packageManager,
        installed: false,
        built: false,
        error: err,
        exitCode: 1,
      };
    }

    // -------------------------------------------------------------
    // STEP 7: Backend URL
    // -------------------------------------------------------------
    if (!options.backendUrl && !isNonInteractive && prompter && (framework === 'frappe-ui' || mode === 'frappe-app')) {
      backendUrl = await prompter.ask('Frappe backend URL for Vite proxy', 'http://127.0.0.1:8000');
    }

    // -------------------------------------------------------------
    // STEP 8: Summary & Explicit Confirmation
    // -------------------------------------------------------------
    const frameworkDisplay =
      framework === 'frappe-ui'
        ? 'Frappe UI (Vue 3 + Tailwind CSS v3)'
        : framework === 'vue'
        ? 'Vue 3'
        : framework === 'react'
        ? 'React'
        : 'Vanilla Vite (No framework)';

    const cssDisplay =
      cssTool === 'tailwind-v3'
        ? 'Tailwind CSS v3 (PostCSS compatibility mode)'
        : cssTool === 'tailwind-v4'
        ? 'Tailwind CSS v4 (Vite plugin)'
        : cssTool === 'bootstrap'
        ? 'Bootstrap 5'
        : cssTool === 'scss'
        ? 'SCSS (sass-embedded)'
        : 'None (Plain CSS)';

    process.stderr.write(
      '\n' +
        pc.bold('------------------------------------------------------------\n') +
        pc.bold('Proposed Configuration Summary:\n') +
        pc.bold('------------------------------------------------------------\n') +
        `  ${pc.bold('Setup Target:')}     ${
          mode === 'frappe-app' ? `Frappe App '${appInfo?.appName}' (${appInfo?.appDir})` : 'Standalone Project'
        }\n` +
        `  ${pc.bold('Target Directory:')} ${targetDir}\n` +
        `  ${pc.bold('Framework:')}        ${frameworkDisplay}\n` +
        `  ${pc.bold('Language:')}         ${language === 'ts' ? 'TypeScript' : 'JavaScript'}\n` +
        `  ${pc.bold('Styling Tool:')}     ${cssDisplay}\n` +
        `  ${pc.bold('Package Manager:')}  ${packageManager}\n` +
        `  ${pc.bold('Backend Proxy:')}    ${backendUrl}\n` +
        pc.bold('------------------------------------------------------------\n\n')
    );

    if (!isNonInteractive && prompter) {
      const confirmed = await prompter.confirm('Proceed with setup and file generation?', true);
      if (!confirmed) {
        process.stderr.write(pc.yellow('\nSetup cancelled by user. No files were modified.\n'));
        return {
          success: false,
          targetDir,
          mode,
          framework,
          language,
          packageManager,
          installed: false,
          built: false,
          cancelled: true,
          exitCode: 0,
        };
      }
    }

    // -------------------------------------------------------------
    // STEP 9: Execute Project Generation
    // -------------------------------------------------------------
    process.stderr.write(pc.cyan(`\nExecuting project generation...\n`));

    // Choose base template: frappe-ui, vue, react, or vanilla
    const templateToScaffold = framework === 'none' ? 'vanilla' : framework;
    const parentDir = path.dirname(targetDir);
    const folderName = path.basename(targetDir);

    const createRes = await runCreate(
      templateToScaffold,
      folderName,
      {
        ts: language === 'ts',
        js: language === 'js',
        packageManager,
        backendUrl,
        skipInstall: options.skipInstall,
        skipBuild: options.skipBuild,
        cwd: parentDir,
      },
      runner
    );

    if (!createRes.success) {
      return {
        success: false,
        targetDir,
        mode,
        framework,
        language,
        packageManager,
        installed: createRes.installed,
        built: createRes.built,
        error: createRes.error,
        exitCode: createRes.exitCode,
      };
    }

    // -------------------------------------------------------------
    // STEP 10: Apply CSS Tooling (if not frappe-ui and not none)
    // -------------------------------------------------------------
    let cssInstalled = createRes.installed;
    let cssBuilt = createRes.built;

    if (framework !== 'frappe-ui' && cssTool && cssTool !== 'none') {
      const toolName = cssTool === 'tailwind-v3' || cssTool === 'tailwind-v4' ? 'tailwind' : cssTool;
      const twVersion = cssTool === 'tailwind-v3' ? 'v3' : 'v4';

      process.stderr.write(pc.cyan(`\nApplying CSS tooling: ${cssTool}...\n`));

      const addRes = await runAdd(
        toolName,
        {
          version: twVersion,
          skipInstall: options.skipInstall,
          skipBuild: options.skipBuild,
          cwd: targetDir,
        },
        runner
      );

      if (!addRes.success) {
        process.stderr.write(pc.yellow(`\n! Framework project created, but adding ${cssTool} encountered issues.\n`));
      } else {
        cssInstalled = addRes.installed;
        cssBuilt = addRes.built;
      }
    }

    // -------------------------------------------------------------
    // STEP 11: Success Report
    // -------------------------------------------------------------
    process.stderr.write('\n');
    process.stderr.write(
      pc.green(
        pc.bold(
          `✔ Successfully completed setup in ${targetDir}!\n`
        )
      )
    );

    if (mode === 'frappe-app') {
      process.stderr.write(
        pc.cyan(
          `\nℹ Note for Frappe custom app '${appInfo?.appName}':\n` +
            `  The frontend application has been scaffolded inside '${targetDir}'.\n` +
            `  In Phase 5, run: npx frappe-frontend-cli integrate frappe\n` +
            `  to configure hooks.py routing and production asset bundling.\n`
        )
      );
    }

    process.stderr.write('\n' + pc.bold('Next steps:\n'));
    process.stderr.write(`  cd "${targetDir}"\n`);
    if (options.skipInstall) {
      process.stderr.write(`  ${packageManager} install\n`);
    }
    const devCmd = packageManager === 'yarn' ? 'yarn dev' : `${packageManager} run dev`;
    process.stderr.write(`  ${devCmd}\n\n`);

    return {
      success: true,
      targetDir,
      mode,
      framework,
      language,
      packageManager,
      installed: cssInstalled,
      built: cssBuilt,
      exitCode: 0,
    };
  } finally {
    prompter?.close();
  }
}
