import { FrameworkAdapter, SupportedFramework } from './types';
import { VueAdapter } from './vue';
import { ReactAdapter } from './react';

export * from './types';
export * from './vue';
export * from './react';

export function getFrameworkAdapter(framework: string): FrameworkAdapter | undefined {
  const normalized = framework.toLowerCase().trim() as SupportedFramework;
  switch (normalized) {
    case 'vue':
      return new VueAdapter();
    case 'react':
      return new ReactAdapter();
    default:
      return undefined;
  }
}
