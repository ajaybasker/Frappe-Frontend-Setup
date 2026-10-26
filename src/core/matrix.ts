/**
 * Declarative compatibility matrix for Frappe Frontend Setup CLI
 */

export interface VersionRequirement {
  minMajor: number;
  minMinor: number;
  minPatch: number;
  recommendedMajor: number;
}

export interface FrameworkCompatibility {
  id: string;
  name: string;
  category: 'framework' | 'library';
  buildTools: string[];
  supportedCss: string[];
  integrationModes: Array<'standalone' | 'custom-app' | 'desk-page'>;
  incompatibleWith?: string[];
  notes?: string;
}

export const SYSTEM_REQUIREMENTS: {
  node: VersionRequirement;
  git: { minMajor: number; minMinor: number };
  supportedPlatforms: NodeJS.Platform[];
  experimentalPlatforms: NodeJS.Platform[];
} = {
  node: {
    minMajor: 18,
    minMinor: 0,
    minPatch: 0,
    recommendedMajor: 20,
  },
  git: {
    minMajor: 2,
    minMinor: 25,
  },
  supportedPlatforms: ['linux', 'darwin'],
  experimentalPlatforms: ['win32'],
};

export const FRAMEWORK_MATRIX: Record<string, FrameworkCompatibility> = {
  vue: {
    id: 'vue',
    name: 'Vue.js (v3)',
    category: 'framework',
    buildTools: ['vite'],
    supportedCss: ['tailwind-v4', 'tailwind-v3', 'bootstrap', 'scss', 'plain'],
    integrationModes: ['standalone', 'custom-app', 'desk-page'],
  },
  react: {
    id: 'react',
    name: 'React (v18/v19)',
    category: 'framework',
    buildTools: ['vite'],
    supportedCss: ['tailwind-v4', 'tailwind-v3', 'bootstrap', 'scss', 'plain'],
    integrationModes: ['standalone', 'custom-app'],
  },
  'frappe-ui': {
    id: 'frappe-ui',
    name: 'Frappe UI',
    category: 'library',
    buildTools: ['vite'],
    supportedCss: ['tailwind-v3'],
    integrationModes: ['custom-app', 'standalone'],
    incompatibleWith: ['react'],
    notes: 'Frappe UI requires Vue 3 and pins Tailwind CSS to v3.x.',
  },
};

export function isNodeVersionSupported(major: number, minor: number = 0, patch: number = 0): boolean {
  const req = SYSTEM_REQUIREMENTS.node;
  if (major > req.minMajor) return true;
  if (major === req.minMajor) {
    if (minor > req.minMinor) return true;
    if (minor === req.minMinor) return patch >= req.minPatch;
  }
  return false;
}

export function isNodeVersionRecommended(major: number): boolean {
  return major >= SYSTEM_REQUIREMENTS.node.recommendedMajor;
}

export function parseSemver(versionString: string): { major: number; minor: number; patch: number } | null {
  const clean = versionString.trim().replace(/^v/, '');
  const match = clean.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
  };
}
