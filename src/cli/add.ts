import pc from 'picocolors';
import { Runner, defaultRunner } from '../core/runner';
import { inspectProject, addTailwind, addBootstrap, addScss, AddCssResult, TailwindVersion } from '../adapters/css';

export interface AddCommandOptions {
  v3?: boolean;
  v4?: boolean;
  skipInstall?: boolean;
  skipBuild?: boolean;
  cwd?: string;
}

export async function runAdd(
  toolInput: string,
  options: AddCommandOptions = {},
  runner: Runner = defaultRunner
): Promise<AddCssResult & { exitCode: number }> {
  const cwd = options.cwd || process.cwd();
  const tool = (toolInput || '').toLowerCase().trim();

  // 1. Inspect target project
  const inspection = inspectProject(cwd);

  if (!inspection.hasPackageJson) {
    const errorMsg = `No package.json found in '${cwd}'. Run this command inside an existing frontend project.`;
    process.stderr.write(pc.red(`x ${errorMsg}\n`));
    return {
      success: false,
      tool: tool as any,
      targetDir: cwd,
      installed: false,
      built: false,
      alreadyConfigured: false,
      error: errorMsg,
      exitCode: 1,
    };
  }

  if (!inspection.isVite) {
    const errorMsg = `Project in '${cwd}' is not a recognized Vite project. 'frappe-frontend-cli add' currently supports Vite-based projects.`;
    process.stderr.write(pc.red(`x ${errorMsg}\n`));
    return {
      success: false,
      tool: tool as any,
      targetDir: cwd,
      installed: false,
      built: false,
      alreadyConfigured: false,
      error: errorMsg,
      exitCode: 1,
    };
  }

  // 2. Dispatch to specific adapter
  switch (tool) {
    case 'tailwind': {
      const version: TailwindVersion = options.v3 ? 'v3' : 'v4';
      const res = await addTailwind(
        inspection,
        {
          version,
          skipInstall: options.skipInstall,
          skipBuild: options.skipBuild,
        },
        runner
      );
      return { ...res, exitCode: res.exitCode };
    }

    case 'bootstrap': {
      const res = await addBootstrap(
        inspection,
        {
          skipInstall: options.skipInstall,
          skipBuild: options.skipBuild,
        },
        runner
      );
      return { ...res, exitCode: res.exitCode };
    }

    case 'scss':
    case 'sass': {
      const res = await addScss(
        inspection,
        {
          skipInstall: options.skipInstall,
          skipBuild: options.skipBuild,
        },
        runner
      );
      return { ...res, exitCode: res.exitCode };
    }

    default: {
      const errorMsg = `Unsupported CSS tool '${toolInput}'. Supported tools: 'tailwind', 'bootstrap', 'scss'.`;
      process.stderr.write(pc.red(`x ${errorMsg}\n`));
      return {
        success: false,
        tool: tool as any,
        targetDir: cwd,
        installed: false,
        built: false,
        alreadyConfigured: false,
        error: errorMsg,
        exitCode: 1,
      };
    }
  }
}
