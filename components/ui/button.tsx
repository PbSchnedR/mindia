import React from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, ActivityIndicator } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');

  const stylesByVariant = getVariantStyles({ variant, bg, text, tint });
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        stylesByVariant.container,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={stylesByVariant.text.color} />
      ) : (
        <Text style={[styles.label, stylesByVariant.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

function getVariantStyles({
  variant,
  bg,
  text,
  tint,
}: {
  variant: Variant;
  bg: string;
  text: string;
  tint: string;
}) {
  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: 'transparent', borderColor: tint, borderWidth: 1 },
        text: { color: tint },
      };
    case 'danger':
      return { container: { backgroundColor: '#EF4444' }, text: { color: '#fff' } };
    case 'ghost':
      return { container: { backgroundColor: 'transparent' }, text: { color: text } };
    case 'primary':
    default:
      return { container: { backgroundColor: tint }, text: { color: bg } };
  }
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});

