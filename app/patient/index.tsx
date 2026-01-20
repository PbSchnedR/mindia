import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View, Platform, Modal } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { QRScanner } from '@/components/qr-scanner';
import { signInPatientByMagicToken } from '@/lib/auth';
import { useSession } from '@/lib/session-context';

export default function PatientLoginScreen() {
  const router = useRouter();
  const { setSession } = useSession();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (data: string) => {
    setScanning(false);
    setError(null);
    setLoading(true);
    
    try {
      // Le QR code contient l'URL complète ou juste le code
      // Ex: https://mindia.app/patient?code=ALEX-2026 ou juste l'email
      let token = data;
      
      // Extraire le code si c'est une URL
      if (data.includes('code=')) {
        const match = data.match(/code=([^&]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
      
      const session = await signInPatientByMagicToken(token);
      setSession(session);
      router.replace('/patient/dashboard');
    } catch (e: any) {
      setError(e?.message ?? "QR code invalide. Demandez un nouveau code à votre thérapeute.");
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    setError(null);
    setScanning(true);
  };

  // Mode scan plein écran
  if (scanning) {
    return (
      <Modal visible={scanning} animationType="slide">
        <QRScanner 
          onScan={handleScan} 
          onCancel={() => setScanning(false)} 
        />
      </Modal>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Ma bulle</ThemedText>
        <ThemedText style={styles.subtitle}>
          Un espace d'écoute entre tes séances de thérapie.
        </ThemedText>
      </View>

      <Card style={styles.card}>
        <View style={styles.iconContainer}>
          <ThemedText style={styles.icon}>📱</ThemedText>
        </View>
        
        <ThemedText type="subtitle" style={styles.cardTitle}>
          Accède à ton espace
        </ThemedText>
        
        <ThemedText style={styles.cardText}>
          Scanne le QR code donné par ton thérapeute pour accéder à ta bulle personnelle.
        </ThemedText>

        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        <Button 
          title={loading ? "Connexion..." : "Scanner le QR code"} 
          onPress={startScanning}
          loading={loading}
          style={styles.scanButton}
        />

        {Platform.OS === 'web' && (
          <ThemedText style={styles.webHint}>
            Sur ordinateur, utilisez l'application mobile pour scanner.
          </ThemedText>
        )}
      </Card>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>
          Pas encore de code ? Demande à ton thérapeute de t'inviter.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
    fontSize: 16,
  },
  card: {
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 36,
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardText: {
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
  },
  scanButton: {
    width: '100%',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 14,
  },
  webHint: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
  },
});
