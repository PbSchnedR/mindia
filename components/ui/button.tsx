import React from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, ActivityIndicator } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

// Couleurs fixes en mode clair
const COLORS = {
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  secondaryBorder: '#2563EB',
  secondaryText: '#2563EB',
  danger: '#EF4444',
  dangerText: '#FFFFFF',
  ghostText: '#1E293B',
};

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const stylesByVariant = getVariantStyles({ variant });
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

function getVariantStyles({ variant }: { variant: Variant }) {
  switch (variant) {
    case 'secondary':
      return {
        container: { 
          backgroundColor: 'transparent', 
          borderColor: COLORS.secondaryBorder, 
          borderWidth: 1 
        },
        text: { color: COLORS.secondaryText },
      };
    case 'danger':
      return { 
        container: { backgroundColor: COLORS.danger }, 
        text: { color: COLORS.dangerText } 
      };
    case 'ghost':
      return { 
        container: { backgroundColor: 'transparent' }, 
        text: { color: COLORS.ghostText } 
      };
    case 'primary':
    default:
      return { 
        container: { backgroundColor: COLORS.primary }, 
        text: { color: COLORS.primaryText } 
      };
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

