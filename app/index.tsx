import React, { useState, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, Modal, Alert, Platform, ActivityIndicator, TextInput, Text, ScrollView, Animated, Pressable, StatusBar } from 'react-native';
import { Link, useRouter } from 'expo-router';

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
  const [userType, setUserType] = useState<'patient' | 'therapist'>('patient');
  const [therapistEmail, setTherapistEmail] = useState('camille@cabinet-demo.fr');
  const [therapistPassword, setTherapistPassword] = useState('demo1234');
  const [therapistLoading, setTherapistLoading] = useState(false);
  const toggleAnimation = useRef(new Animated.Value(0)).current;
  const [toggleWidth, setToggleWidth] = useState(0);

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

  async function handleTherapistLogin() {
    if (!therapistEmail.trim() || !therapistPassword.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir l\'email et le mot de passe.');
      return;
    }

    try {
      setTherapistLoading(true);
      const backendReady = await api.waitForBackend();
      if (!backendReady) {
        Alert.alert('Erreur', 'Le serveur n\'est pas disponible. Réessayez plus tard.');
        return;
      }

      const result = await api.auth.login(therapistEmail.trim(), therapistPassword);
      await saveSession(result.session);
      setSession(result.session);
      router.replace('/therapist/dashboard');
    } catch (error: any) {
      console.error('[Therapist Login] Erreur:', error);
      Alert.alert('Connexion impossible', error?.message || 'Email ou mot de passe invalide.');
    } finally {
      setTherapistLoading(false);
    }
  }

  function switchUserType(type: 'patient' | 'therapist') {
    setUserType(type);
    Animated.spring(toggleAnimation, {
      toValue: type === 'therapist' ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 150,
    }).start();
  }

  // Écran de chargement pendant la vérification de session
  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EC4899" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const translateX = toggleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, toggleWidth ? (toggleWidth - 8) / 2 : 0], // Largeur / 2 moins le padding
  });

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo et titre */}
          <View style={styles.header}>
            <Image source={require('@/assets/images/logo-mindia.png')} style={styles.logo} />
            <Text style={styles.title}>
              <Text style={styles.titleBase}>Mind</Text>
              <Text style={styles.titleAccent}>IA</Text>
            </Text>
            <Text style={styles.subtitle}>Relai entre les séances</Text>
          </View>

          {/* Toggle Patient/Thérapeute avec animation */}
          <View style={styles.toggleContainer}>
            <View 
              style={styles.toggle}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setToggleWidth(width);
              }}
            >
              <Animated.View 
                style={[
                  styles.toggleSlider,
                  { transform: [{ translateX }] }
                ]}
              />
              <Pressable 
                style={styles.toggleButton}
                onPress={() => switchUserType('patient')}
              >
                <Text style={[
                  styles.toggleText,
                  userType === 'patient' && styles.toggleTextActive
                ]}>Patient</Text>
              </Pressable>
              <Pressable 
                style={styles.toggleButton}
                onPress={() => switchUserType('therapist')}
              >
                <Text style={[
                  styles.toggleText,
                  userType === 'therapist' && styles.toggleTextActive
                ]}>Thérapeute</Text>
              </Pressable>
            </View>
          </View>

          {/* Contenu selon le type d'utilisateur */}
          {userType === 'patient' ? (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Accéder à ma bulle</Text>
              <Text style={styles.formSubtitle}>
                Scanne le QR code fourni par ton thérapeute pour accéder à ton espace sécurisé
              </Text>
              
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

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button 
                title="Accès debug (test)" 
                variant="secondary" 
                onPress={() => setShowDebugPatient(true)} 
              />
            </View>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Connexion Thérapeute</Text>
              <Text style={styles.formSubtitle}>
                Connecte-toi pour accéder au suivi de tes patients
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={therapistEmail}
                  onChangeText={setTherapistEmail}
                  placeholder="votre.email@exemple.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <TextInput
                  value={therapistPassword}
                  onChangeText={setTherapistPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              <Button
                title={therapistLoading ? 'Connexion...' : 'Se connecter'}
                onPress={handleTherapistLogin}
                disabled={therapistLoading}
              />

              <Link href="/therapist" asChild>
                <Text style={styles.forgotPassword}>Mot de passe oublié ?</Text>
              </Link>
            </View>
          )}
        </ScrollView>
      </View>

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
        <View style={styles.debugModal}>
          <ScrollView contentContainerStyle={styles.debugScrollContent}>
            <Text style={styles.debugTitle}>Accès debug patient</Text>
            <Text style={styles.debugDescription}>
              Renseigne un email patient valide pour entrer directement dans la bulle.
            </Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email patient</Text>
              <TextInput
                value={debugEmail}
                onChangeText={setDebugEmail}
                placeholder="patient@exemple.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>
            <Button
              title={debugLoading ? 'Connexion...' : 'Connexion debug'}
              onPress={handleDebugPatientAccess}
              disabled={debugLoading}
            />
            <Button
              title="Annuler"
              variant="secondary"
              onPress={() => setShowDebugPatient(false)}
              style={{ marginTop: 12 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 15,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleBase: {
    color: '#1E293B',
  },
  titleAccent: {
    color: '#2563EB',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  toggleContainer: {
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  toggle: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  toggleSlider: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: '48%',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  formContainer: {
    gap: 20,
    paddingHorizontal: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#94A3B8',
  },
  forgotPassword: {
    fontSize: 14,
    color: '#2563EB',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  debugModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  debugScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  debugTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  debugDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

