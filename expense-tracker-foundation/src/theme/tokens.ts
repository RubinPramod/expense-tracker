export const colors = {
  background: '#F8F7FF',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1EFFF',
  surfaceMuted: '#F1EFFF',
  primary: '#5B45E7',
  primaryPressed: '#4933D4',
  primaryTint: '#EAE6FF',
  text: '#17172B',
  textSecondary: '#687797',
  border: '#E4E2F6',
  expense: '#E53945',
  income: '#16A765',
  warning: '#F59E0B',
  info: '#2583E8',
  success: '#159B67',
  danger: '#E53945',
  categoryFood: '#F28A36',
  categoryTransport: '#3987E8',
  categoryShopping: '#7758E8',
  categoryHome: '#E85B75',
  categoryOther: '#16A765',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const radius = radii;
export const touchTarget = { minWidth: 44, minHeight: 44 } as const;
export const typography = { body: 16, secondary: 14, caption: 12, heading: 24, title: 20 } as const;
