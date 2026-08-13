import { describe, expect, it } from 'vitest';
import { isBuiltin, themeAttribute } from './theme';
import type { CustomTheme } from '@daycore/core';

const theme = (id: string, dark: boolean): CustomTheme => ({
  id,
  familyId: 'ting',
  name: id,
  dark,
  variables: { '--tg-bg': '#000000' },
});

describe('isBuiltin', () => {
  it('accepts the two themes theme.css styles', () => {
    expect(isBuiltin('night')).toBe(true);
    expect(isBuiltin('dawn')).toBe(true);
  });

  it('rejects the design-system builtins the backend leaks', () => {
    expect(isBuiltin('sky')).toBe(false);
    expect(isBuiltin('sunset')).toBe(false);
    expect(isBuiltin('nature')).toBe(false);
  });
});

describe('themeAttribute', () => {
  it('passes a builtin through', () => {
    expect(themeAttribute('night', [])).toBe('night');
    expect(themeAttribute('dawn', [])).toBe('dawn');
  });

  // ⚠️ The crash this module exists to fix: a fresh session carries "sky",
  // and writing it to data-tg leaves no selector matched.
  it('falls back to night for an unknown id', () => {
    expect(themeAttribute('sky', [])).toBe('night');
    expect(themeAttribute('', [])).toBe('night');
  });

  it('maps a custom theme onto its dark/light base', () => {
    expect(themeAttribute('custom-dark', [theme('custom-dark', true)])).toBe('night');
    expect(themeAttribute('custom-light', [theme('custom-light', false)])).toBe('dawn');
  });

  it('falls back to night when a custom id is not in the list', () => {
    expect(themeAttribute('gone', [theme('other', false)])).toBe('night');
  });
});
