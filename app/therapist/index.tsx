import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { signInTherapist } from '@/lib/auth';
import { useSession } from '@/lib/session-context';

export default function TherapistLoginScreen() {
  const router = useRouter();
  const { setSession } = useSession();
  const [email, setEmail] = useState('camille@cabinet-demo.fr');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await signInTherapist(email, password);
      setSession(session);
      router.replace('/therapist/dashboard');
    } catch (e: any) {
      setError(e?.message ?? 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <ThemedView style={styles.container}>
        <View style={styles.safeArea} />
        <View style={styles.header}>
          <ThemedText type="subtitle">Espace thérapeute</ThemedText>
          <ThemedText>
            Connexion simple avec email et mot de passe. Les données sont mockées localement pour ce MVP.
          </ThemedText>
        </View>

        <Card style={styles.card}>
          <TextField
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="Mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            errorText={error ?? undefined}
          />
          <Button title="Se connecter" onPress={handleSubmit} loading={loading} />
        </Card>

        <ThemedText style={styles.helper}>
          Démo: email <ThemedText type="defaultSemiBold">camille@cabinet-demo.fr</ThemedText> / mot de passe{' '}
          <ThemedText type="defaultSemiBold">demo1234</ThemedText>.
        </ThemedText>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  safeArea: {
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  header: {
    gap: 8,
  },
  card: {
    gap: 16,
  },
  helper: {
    fontSize: 12,
    opacity: 0.8,
  },
});

