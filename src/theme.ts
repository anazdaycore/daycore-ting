import type { CustomTheme } from '@daycore/core';
import { TOKENS } from './manifest';

// 汀's themes. Only two exist in theme.css — the backend may hand back a
// design-system builtin id ("sky" is the default the session column carries for
// a family nobody has themed yet), and that id is NOT a 汀 theme. The whitelist
// below is the whole point of this module: a value outside it falls back to
// "night" instead of leaving data-tg on a value no selector matches, which is
// the unthemed first paint that reads as a broken install.

export const BUILTIN_THEMES = ['night', 'dawn'] as const;
export type BuiltinTheme = (typeof BUILTIN_THEMES)[number];

export function isBuiltin(id: string): id is BuiltinTheme {
  return (BUILTIN_THEMES as readonly string[]).includes(id);
}

const TOKEN_NAMES = new Set(TOKENS.map((t) => t.name));

export function themeAttribute(currentTheme: string, themes: CustomTheme[]): BuiltinTheme {
  if (isBuiltin(currentTheme)) return currentTheme;
  const custom = themes.find((t) => t.id === currentTheme);
  if (custom) return custom.dark ? 'night' : 'dawn';
  return 'night';
}

export function applyThemeVars(theme: CustomTheme): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.variables)) {
    if (TOKEN_NAMES.has(name)) root.style.setProperty(name, value);
  }
}

export function clearThemeVars(): void {
  const root = document.documentElement;
  for (const name of TOKEN_NAMES) root.style.removeProperty(name);
}

export function applyTheme(currentTheme: string, themes: CustomTheme[]): void {
  document.documentElement.setAttribute('data-tg', themeAttribute(currentTheme, themes));
  const custom = themes.find((t) => t.id === currentTheme);
  if (custom) applyThemeVars(custom);
  else clearThemeVars();
}
