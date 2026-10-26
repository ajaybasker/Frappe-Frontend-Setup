import { FrameworkAdapter } from './types';
import { VueAdapter } from './vue';
import { ReactAdapter } from './react';
import { FrappeUIAdapter } from './frappe-ui';
import { VanillaAdapter } from './vanilla';

export * from './types';
export * from './vue';
export * from './react';
export * from './frappe-ui';
export * from './vanilla';

export function getFrameworkAdapter(framework: string): FrameworkAdapter | undefined {
  const normalized = framework.toLowerCase().trim();
  switch (normalized) {
    case 'vue':
      return new VueAdapter();
    case 'react':
      return new ReactAdapter();
    case 'frappe-ui':
      return new FrappeUIAdapter();
    case 'vanilla':
    case 'none':
      return new VanillaAdapter();
    default:
      return undefined;
  }
}
