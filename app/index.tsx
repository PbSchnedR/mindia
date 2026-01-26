import React, { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, Modal, Alert, Platform, ActivityIndicator, TextInput, Text, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/qr-scanner';
import { api } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { useSession } from '@/lib/session-context';

export default function LandingScreen() {
  const router = useRouter();
  const { setSession } = useSession();
  const [showScanner, setShowScanner] = useState(false);
  const [showDebugPatient, setShowDebugPatient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [debugEmail, setDebugEmail] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);

  // Vérifier s'il y a déjà une session valide au démarrage
  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const token = await api.auth.getStoredToken();
      if (token) {
        // Attendre que le backend soit disponible
        const backendReady = await api.waitForBackend();
        if (backendReady) {
          // Vérifier le token sans afficher d'erreur utilisateur
          const result = await api.auth.verifyToken(token);
          if (result) {
            // Session valide, rediriger selon le rôle
            await saveSession(result.session);
            setSession(result.session);
            if (result.session.role === 'therapist') {
              setTimeout(() => router.replace('/therapist/dashboard'), 0);
            } else {
              setTimeout(() => router.replace('/patient/dashboard'), 0);
            }
            return;
          }
        }
      }
      // Pas de token ou token invalide, rester sur la page d'accueil
    } catch (error) {
      // Erreur silencieuse, juste logger
      console.log('Vérification de session:', error);
    } finally {
      setCheckingSession(false);
    }
  }

  async function handleQRScan(data: string) {
    setShowScanner(false);
    setIsLoading(true);

    try {
      // Le QR code contient un magic token patient (usage unique)
      const token = data.trim();
      console.log('[QR Scan] Token scanné (début):', token.substring(0, 20) + '...');
      
      // Attendre que le backend soit disponible
      const backendReady = await api.waitForBackend();
      if (!backendReady) {
        Alert.alert('Erreur', 'Le serveur n\'est pas disponible. Réessayez plus tard.');
        setIsLoading(false);
        return;
      }

      // Vérifier et se connecter avec le token permanent
      // Le token est stocké en mémoire (cache) et dans AsyncStorage pour persistance
      console.log('[QR Scan] Vérification du token...');
      const result = await api.auth.loginWithToken(token);
      
      if (result) {
        console.log('[QR Scan] Token valide, session créée pour:', result.user.role);
        await saveSession(result.session);
        setSession(result.session);
        
        if (result.session.role === 'patient') {
          console.log('[QR Scan] Redirection vers le dashboard patient');
          router.replace('/patient/dashboard');
        } else {
          Alert.alert('Erreur', 'Ce QR code n\'est pas un QR patient.');
        }
      }
    } catch (error: any) {
      console.error('[QR Scan] Erreur:', error);
      Alert.alert(
        'QR Code invalide',
        error?.message || 'Ce QR code n\'est pas valide.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDebugPatientAccess() {
    if (!debugEmail.trim()) {
      Alert.alert('Email requis', 'Entre un email patient pour la connexion debug.');
      return;
    }

    try {
      setDebugLoading(true);
      const backendReady = await api.waitForBackend();
      if (!backendReady) {
        Alert.alert('Erreur', 'Le serveur n\'est pas disponible. Réessayez plus tard.');
        return;
      }

      const result = await api.auth.loginPatientByMagicToken(debugEmail.trim());
      await saveSession(result.session);
      setSession(result.session);
      setShowDebugPatient(false);
      router.replace('/patient/dashboard');
    } catch (error: any) {
      console.error('[Debug Patient] Erreur:', error);
      Alert.alert('Connexion impossible', error?.message || 'Email patient invalide.');
    } finally {
      setDebugLoading(false);
    }
  }

  // Écran de chargement pendant la vérification de session
  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EC4899" />
        <ThemedText style={styles.loadingText}>Chargement...</ThemedText>
      </View>
    );
  }

  return (
    <>
      <ThemedView style={styles.page}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.titleContainer}>
            <View style={styles.brandBlock}>
              <Image source={require('@/assets/images/logo-mindia.png')} style={styles.logoTop} />
              <Text style={styles.appTitle}>
                <Text style={styles.appTitleBase}>Mind</Text>
                <Text style={styles.appTitleAccent}>IA</Text>
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.taglineBlock}>
              <ThemedText style={styles.heroTitle}>Relai entre les seances</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Une bulle de parole continue entre les séances, pour les patients et les thérapeutes. MVP centré
                sur les moments de down.
              </ThemedText>
            </View>
          </ThemedView>

          <View style={styles.cardsRow}>
            <Card style={styles.card}>
              <ThemedText type="subtitle">Espace patient</ThemedText>
              <ThemedText style={styles.cardText}>
                Rejoins ta bulle sécurisée en scannant le QR code donné par ton thérapeute. Disponible 24h/24.
              </ThemedText>
              {Platform.OS === 'web' ? (
                <Link href="/patient" asChild>
                  <Button title="Entrer avec mon code" />
                </Link>
              ) : (
                <Button 
                  title={isLoading ? "Connexion..." : "Scanner mon QR code"} 
                  onPress={() => setShowScanner(true)}
                  disabled={isLoading}
                />
              )}
            </Card>
          </View>

          <View style={styles.cardsRow}>
            <Card style={styles.cardAlt}>
              <ThemedText type="subtitle">Accès debug patient</ThemedText>
              <ThemedText style={styles.cardText}>
                Accès temporaire sans QR code. Entre l'email patient pour tester la bulle.
              </ThemedText>
              <Button title="Accès debug" variant="secondary" onPress={() => setShowDebugPatient(true)} />
            </Card>
          </View>

          <View style={styles.cardsRow}>
            <Card style={styles.card}>
              <ThemedText type="subtitle">Espace thérapeute</ThemedText>
              <ThemedText style={styles.cardText}>
                Visualise les moments-clés entre deux séances, sans remplacer la relation humaine.
              </ThemedText>
              <Link href="/therapist" asChild>
                <Button title="Espace thérapeute" variant="secondary" />
              </Link>
            </Card>
          </View>
        </ScrollView>
      </ThemedView>

      {/* Modal Scanner QR */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <QRScanner
          onScan={handleQRScan}
          onCancel={() => setShowScanner(false)}
        />
      </Modal>

      {/* Modal Debug Patient */}
      <Modal
        visible={showDebugPatient}
        animationType="slide"
        onRequestClose={() => setShowDebugPatient(false)}
      >
        <ThemedView style={styles.debugContainer}>
          <ThemedText type="title">Accès debug patient</ThemedText>
          <ThemedText style={styles.debugText}>
            Renseigne un email patient valide pour entrer directement dans la bulle.
          </ThemedText>
          <TextInput
            value={debugEmail}
            onChangeText={setDebugEmail}
            placeholder="Email patient"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.debugInput}
          />
          <Button
            title={debugLoading ? 'Connexion...' : 'Connexion debug'}
            onPress={handleDebugPatientAccess}
            disabled={debugLoading}
          />
          <Button
            title="Retour"
            variant="secondary"
            onPress={() => setShowDebugPatient(false)}
            style={{ marginTop: 12 }}
          />
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    padding: 28,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  loadingText: {
    marginTop: 16,
    color: '#9CA3AF',
  },
  titleContainer: {
    gap: 18,
    marginBottom: 28,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
  },
  logoTop: {
    width: 120,
    height: 120,
    borderRadius: 0,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  appTitleBase: {
    color: '#E2E8F0',
  },
  appTitleAccent: {
    color: '#22D3EE',
  },
  separator: {
    width: '70%',
    height: 1,
    backgroundColor: 'rgba(226, 232, 240, 0.2)',
  },
  taglineBlock: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
    textAlign: 'center',
  },
  cardsRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  card: {
    gap: 12,
  },
  cardAlt: {
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.2)',
    backgroundColor: 'rgba(236, 72, 153, 0.05)',
  },
  cardText: {
    fontSize: 14,
    opacity: 0.8,
  },
  debugContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  debugText: {
    opacity: 0.7,
  },
  debugInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
