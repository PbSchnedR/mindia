import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/constants/tokens';

export type TextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function TextField({ label, helperText, errorText, icon, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, errorText ? styles.inputError : null]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.textTertiary} style={styles.icon} />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, icon ? { paddingLeft: 0 } : null, style]}
          {...rest}
        />
      </View>
      {errorText ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...font.label,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.lg,
  },
  inputError: {
    borderColor: colors.error,
  },
  icon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.text,
    paddingLeft: 0,
    outlineStyle: 'none',
  } as any,
  helper: {
    ...font.caption,
  },
  error: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
});
