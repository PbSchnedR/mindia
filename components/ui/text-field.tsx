import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, Text } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type TextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
};

export function TextField({ label, helperText, errorText, style, ...rest }: TextFieldProps) {
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');

  const borderColor = errorText ? '#EF4444' : tint;

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: text }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#9BA1A6"
        style={[styles.input, { color: text, backgroundColor: bg, borderColor }, style]}
        {...rest}
      />
      {errorText ? <Text style={styles.error}>{errorText}</Text> : helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  helper: {
    fontSize: 12,
    color: '#6B7280',
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
});

