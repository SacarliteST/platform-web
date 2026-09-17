import { createTheme } from '@mantine/core';

// Направление "Operational Slate": индиго-акцент, Sora для заголовков,
// IBM Plex Sans для текста, IBM Plex Mono для чисел/данных.
const indigo = [
  '#F0EFFE',
  '#E0DEFC',
  '#C7C2FA',
  '#A9A0F6',
  '#8B7FF2',
  '#6F60EC',
  '#4338CA',
  '#372DAE',
  '#2C2489',
  '#211B67',
] as const;

export const theme = createTheme({
  primaryColor: 'indigo',
  colors: {
    indigo,
  },
  fontFamily: 'IBM Plex Sans, system-ui, -apple-system, sans-serif',
  fontFamilyMonospace: 'IBM Plex Mono, ui-monospace, monospace',
  headings: {
    fontFamily: 'Sora, IBM Plex Sans, system-ui, sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'md',
  radius: {
    xs: '6px',
    sm: '8px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },
  shadows: {
    sm: '0 1px 2px rgba(17, 24, 39, 0.04)',
    md: '0 4px 12px -4px rgba(17, 24, 39, 0.10)',
  },
});
