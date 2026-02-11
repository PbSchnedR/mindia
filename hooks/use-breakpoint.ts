import { Platform, useWindowDimensions } from 'react-native';
import { layout } from '@/constants/tokens';

/**
 * Hook responsive : retourne si on est en mode desktop web.
 * Usage : const isDesktop = useIsDesktop();
 */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= layout.desktopBreakpoint;
}
