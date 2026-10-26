/**
 * Pure evaluation logic for EnvironmentFacts -> DoctorReport
 */

import {
  EnvironmentFacts,
  DoctorReport,
  CheckItem,
} from './types';
import {
  SYSTEM_REQUIREMENTS,
  isNodeVersionSupported,
  isNodeVersionRecommended,
  parseSemver,
} from './matrix';

export function evaluateEnvironment(
  facts: EnvironmentFacts,
  requirements = SYSTEM_REQUIREMENTS
): DoctorReport {
  const checks: CheckItem[] = [];

  // 1. Operating System Check
  if (requirements.supportedPlatforms.includes(facts.os.platform)) {
    checks.push({
      id: 'os-platform',
      category: 'os',
      title: 'Operating System',
      status: 'ok',
      message: `${facts.os.platform} (${facts.os.arch}) is fully supported.`,
    });
  } else if (requirements.experimentalPlatforms.includes(facts.os.platform)) {
    checks.push({
      id: 'os-platform',
      category: 'os',
      title: 'Operating System',
      status: 'warn',
      message: `${facts.os.platform} (${facts.os.arch}) is experimental.`,
      hint: 'Frappe Framework backends run on Linux. For full Frappe integration, WSL2 or Linux is recommended.',
    });
  } else {
    checks.push({
      id: 'os-platform',
      category: 'os',
      title: 'Operating System',
      status: 'fail',
      message: `Platform '${facts.os.platform}' is unsupported.`,
      hint: 'Use Linux (Ubuntu 22.04/24.04/26.04), macOS, or WSL2.',
    });
  }

  // 2. Node.js Version Check
  const nodeSupported = isNodeVersionSupported(facts.node.major, facts.node.minor, facts.node.patch);
  const nodeRecommended = isNodeVersionRecommended(facts.node.major);

  if (!nodeSupported) {
    checks.push({
      id: 'node-version',
      category: 'node',
      title: 'Node.js Version',
      status: 'fail',
      message: `Node.js ${facts.node.version} is not supported. Minimum required is v${requirements.node.minMajor}.${requirements.node.minMinor}.${requirements.node.minPatch}.`,
      hint: `Upgrade Node.js to v${requirements.node.recommendedMajor}.x LTS or higher using nvm, fnm, or your system package manager.`,
    });
  } else if (!nodeRecommended) {
    checks.push({
      id: 'node-version',
      category: 'node',
      title: 'Node.js Version',
      status: 'warn',
      message: `Node.js ${facts.node.version} meets minimum (>=18.0.0), but v${requirements.node.recommendedMajor}.x LTS is recommended.`,
      hint: `Consider upgrading to Node.js ${requirements.node.recommendedMajor}.x LTS for optimal build performance.`,
    });
  } else {
    checks.push({
      id: 'node-version',
      category: 'node',
      title: 'Node.js Version',
      status: 'ok',
      message: `Node.js ${facts.node.version} meets all requirements.`,
    });
  }

  // 3. Package Managers Check
  if (facts.packageManagers.available.length === 0) {
    checks.push({
      id: 'pm-availability',
      category: 'package-manager',
      title: 'Package Manager',
      status: 'fail',
      message: 'No supported package manager (npm, pnpm, yarn, bun) was found.',
      hint: 'Install npm or pnpm to enable project scaffolding and dependency management.',
    });
  } else {
    const defaultPm = facts.packageManagers.preferred;
    const info = facts.packageManagers[defaultPm];
    checks.push({
      id: 'pm-availability',
      category: 'package-manager',
      title: 'Package Manager',
      status: 'ok',
      message: `Preferred package manager: ${defaultPm} ${info ? info.version : ''} (${facts.packageManagers.available.join(', ')} available).`,
    });
  }

  // 4. Git Check
  if (!facts.git.available) {
    checks.push({
      id: 'git-availability',
      category: 'git',
      title: 'Git Version Control',
      status: 'fail',
      message: 'Git is not installed or not available on PATH.',
      hint: 'Install Git (e.g. `sudo apt install git` or `brew install git`) to enable repository and template operations.',
    });
  } else {
    const gitSemver = facts.git.version ? parseSemver(facts.git.version) : null;
    if (gitSemver && (gitSemver.major < requirements.git.minMajor || (gitSemver.major === requirements.git.minMajor && gitSemver.minor < requirements.git.minMinor))) {
      checks.push({
        id: 'git-availability',
        category: 'git',
        title: 'Git Version Control',
        status: 'warn',
        message: `Git ${facts.git.version} is older than recommended (>=${requirements.git.minMajor}.${requirements.git.minMinor}).`,
        hint: 'Update Git for enhanced submodule and shallow-clone support.',
      });
    } else {
      checks.push({
        id: 'git-availability',
        category: 'git',
        title: 'Git Version Control',
        status: 'ok',
        message: `Git ${facts.git.version || 'installed'} is available and ready.`,
      });
    }
  }

  // 5. Frappe Bench Environment Context Check
  if (facts.bench.isInsideApp) {
    checks.push({
      id: 'frappe-context',
      category: 'bench',
      title: 'Frappe Context',
      status: 'info',
      message: `Inside Frappe Custom App '${facts.bench.appName}' at ${facts.bench.appRoot}.`,
      hint: 'You can use in-tree frontend integration mode to build directly into public assets.',
    });
  } else if (facts.bench.isInsideBench) {
    const appsSuffix =
      facts.bench.customApps && facts.bench.customApps.length > 0
        ? ` (${facts.bench.customApps.length} custom apps detected: ${facts.bench.customApps.join(', ')})`
        : '';
    checks.push({
      id: 'frappe-context',
      category: 'bench',
      title: 'Frappe Context',
      status: 'info',
      message: `Inside Frappe Bench workspace at ${facts.bench.benchRoot}${appsSuffix}.`,
      hint: 'Custom app frontend scaffolding will automatically detect bench assets.',
    });
  } else if (facts.bench.cliAvailable) {
    checks.push({
      id: 'frappe-context',
      category: 'bench',
      title: 'Frappe Context',
      status: 'info',
      message: `Bench CLI detected (${facts.bench.cliVersion || 'available'}), but current working directory is not inside a Frappe bench.`,
      hint: 'Standalone frontends can be created anywhere. To integrate into a Frappe app, navigate to your app directory.',
    });
  } else {
    checks.push({
      id: 'frappe-context',
      category: 'bench',
      title: 'Frappe Context',
      status: 'info',
      message: 'No Frappe Bench detected in the current directory context.',
      hint: 'Standalone frontend applications (Vue, React) can be created here. In-tree custom app integration requires a bench workspace.',
    });
  }

  // 6. Monorepo Workspace Check (if detected)
  if (facts.workspace) {
    checks.push({
      id: 'workspace-monorepo',
      category: 'package-manager',
      title: 'Monorepo Workspace',
      status: 'info',
      message: `${facts.workspace.type.toUpperCase()} workspace detected${facts.workspace.isTurborepo ? ' with Turborepo' : ''} at ${facts.workspace.rootDir}.`,
      hint: 'Frontend commands respect monorepo package isolation and dependencies.',
    });
  }

  const failures = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;
  const passed = checks.filter((c) => c.status === 'ok').length;

  return {
    timestamp: new Date().toISOString(),
    healthy: failures === 0,
    facts,
    checks,
    summary: {
      total: checks.length,
      passed,
      warnings,
      failures,
    },
  };
}
