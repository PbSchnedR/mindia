import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Pressable,
  Text,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, shadows, radius, font, layout } from '@/constants/tokens';
import { useIsDesktop } from '@/hooks/use-breakpoint';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  stickyContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
  contentStyle?: ViewStyle;
  noScroll?: boolean;
  bgColor?: string;
  /** Hide header completely */
  hideHeader?: boolean;
}

export function PageLayout({
  children,
  title,
  subtitle,
  headerRight,
  stickyContent,
  bottomContent,
  contentStyle,
  noScroll = false,
  bgColor,
  hideHeader = false,
}: PageLayoutProps) {
  const isDesktop = useIsDesktop();
  const bg = bgColor || (isDesktop ? colors.bgDesktop : colors.bg);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.safeArea} />

        {!hideHeader && (
          <View style={[styles.headerOuter, isDesktop && styles.headerOuterDesktop]}>
            <View style={[styles.header, isDesktop && styles.headerDesktop]}>
              <View style={styles.headerLeft}>
                {subtitle ? (
                  <Text style={styles.greeting} numberOfLines={1}>{subtitle}</Text>
                ) : null}
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
              </View>
              {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
            </View>
          </View>
        )}

        {stickyContent}

        {noScroll ? (
          <View style={[styles.content, isDesktop && styles.contentDesktop, contentStyle]}>
            {children}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isDesktop && styles.scrollContentDesktop,
              bottomContent ? { paddingBottom: spacing['3xl'] } : { paddingBottom: 100 },
              contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        )}

        {bottomContent}
      </View>
    </>
  );
}

/* ── Header icon button ──────────────────────────────── */
export function HeaderIconButton({
  icon,
  onPress,
  color = colors.textSecondary,
  size = 22,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  size?: number;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.iconBtn}>
      <View style={styles.iconBtnInner}>
        <Ionicons name={icon} size={size} color={color} />
        {badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ── Dropdown menu ───────────────────────────────────── */
export function DropdownMenu({
  visible,
  items,
}: {
  visible: boolean;
  items: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean }[];
}) {
  if (!visible) return null;
  return (
    <View style={styles.dropdown}>
      {items.map((item, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
          onPress={item.onPress}
        >
          <View style={[styles.dropdownIcon, item.danger && { backgroundColor: colors.errorLight }]}>
            <Ionicons
              name={item.icon}
              size={18}
              color={item.danger ? colors.error : colors.primary}
            />
          </View>
          <Text style={[styles.dropdownText, item.danger && { color: colors.error }]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    paddingTop: layout.safeAreaTop,
  },

  // Header
  headerOuter: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerOuterDesktop: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerDesktop: {
    maxWidth: layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing['2xl'],
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  greeting: {
    ...font.bodySmall,
    fontSize: 13,
  },
  title: {
    ...font.title,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: layout.pagePadding,
  },
  contentDesktop: {
    maxWidth: layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    padding: layout.pagePadding,
    gap: spacing['2xl'],
  },
  scrollContentDesktop: {
    maxWidth: layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing['4xl'],
  },

  // Icon button
  iconBtn: {
    padding: spacing.xs,
  },
  iconBtnInner: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },

  // Dropdown
  dropdown: {
    backgroundColor: colors.bg,
    marginHorizontal: layout.pagePadding,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.sm,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  dropdownItemPressed: {
    backgroundColor: colors.bgSecondary,
  },
  dropdownIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownText: {
    ...font.bodyMedium,
  },
});
