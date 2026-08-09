import type { PageKey } from './pageTheme';

export type PageVisualPreset = 'default' | 'nova' | 'hologram' | 'terminal';

export const DEFAULT_PAGE_VISUAL_PRESET: PageVisualPreset = 'default';

export function isPageVisualPreset(value: unknown): value is PageVisualPreset {
  return value === 'default' || value === 'nova' || value === 'hologram' || value === 'terminal';
}

export function getPageVisualPresetStorageKey(pageKey: PageKey) {
  return `oguricap:page-visual-preset:${pageKey}`;
}
