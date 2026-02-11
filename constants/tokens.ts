/**
 * MindIA Design System v2 – Ultra Modern & Clean
 * Palette indigo-violette douce, glassmorphism, espaces généreux
 */

export const colors = {
  // Accent principal – indigo profond
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  primaryMedium: '#C7D2FE',
  primaryDark: '#4F46E5',
  primaryGradientStart: '#6366F1',
  primaryGradientEnd: '#8B5CF6',

  // Texte
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#E2E8F0',

  // Fonds
  bg: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  bgTertiary: '#F1F5F9',
  bgDesktop: '#F1F5F9',
  bgDark: '#0F172A',
  bgGlass: 'rgba(255,255,255,0.72)',

  // Bordures
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderGlass: 'rgba(255,255,255,0.18)',

  // Sémantiques
  error: '#EF4444',
  errorLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',

  // IA
  ai: '#8B5CF6',
  aiLight: '#F5F3FF',
  aiMedium: '#DDD6FE',

  // Placeholders
  placeholder: '#CBD5E1',

  // Surfaces
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  overlay: 'rgba(15,23,42,0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  top: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 10,
  },
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const font = {
  hero: { fontSize: 34, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.8 },
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 20, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, color: colors.text, lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, color: colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textTertiary },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, letterSpacing: 0.2 },
  button: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.1 },
  buttonSm: { fontSize: 13, fontWeight: '600' as const },
  mono: { fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary },
} as const;

export const layout = {
  maxWidth: 1080,
  pagePadding: 24,
  desktopBreakpoint: 1024,
  safeAreaTop: 25,
  bottomTabHeight: 68,
} as const;
