import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useSession } from '@/lib/session-context';

export default function PatientMagicLinkScreen() {
  const router = useRouter();
  const { signInPatient, signingIn, session } = useSession();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async () => {
    setError(undefined);
    try {
      await signInPatient(token);
      router.replace('/patient/chat');
    } catch (e) {
      console.error(e);
      setError("Lien invalide ou expiré. Vérifie le code reçu de ton thérapeute.");
      Alert.alert('Impossible de te connecter', "Le lien ne fonctionne pas. Essaie à nouveau ou contacte ton thérapeute.");
    }
  };

  const handleContinueIfAlready = () => {
    if (session?.role === 'patient') {
      router.replace('/patient/chat');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Espace patient</ThemedText>
          <ThemedText type="title">Retrouver ma bulle</ThemedText>
          <ThemedText>
            Tu as reçu un lien sécurisé de ton thérapeute. Colle simplement le code ou le texte du mail
            ici pour ouvrir ton espace.
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Code / lien magique"
            placeholder="Ex: ALEX-2026"
            value={token}
            onChangeText={setToken}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            textContentType="oneTimeCode"
            errorText={error}
          />
        </View>

        <View style={styles.actions}>
          <Button title="Ouvrir ma bulle" onPress={handleSubmit} loading={signingIn} />
          <Button
            title="Je suis déjà connecté(e)"
            variant="ghost"
            onPress={handleContinueIfAlready}
            disabled={!session}
          />
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 24,
  },
  header: {
    gap: 8,
    marginTop: 12,
  },
  form: {
    gap: 16,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
    paddingBottom: 24,
  },
});

