import React, { useState, useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import {
  StyleSheet, View, Modal, Alert, Platform, ActivityIndicator,
  Text, ScrollView, Animated, Pressable, StatusBar, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { QRScanner } from '@/components/qr-scanner';
import { api } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { useSession } from '@/lib/session-context';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

type Mode = 'patient' | 'therapist';

export default function LandingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { session, loading: sessionLoading, setSession } = useSession();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const hasRedirected = useRef(false);

  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('patient');

  const [patientEmail, setPatientEmail] = useState('');
  const [patientLoading, setPatientLoading] = useState(false);
  const [therapistEmail, setTherapistEmail] = useState('');
  const [therapistPassword, setTherapistPassword] = useState('');
  const [therapistLoading, setTherapistLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [toggleWidth, setToggleWidth] = useState(0);

  // ── Auto-redirect if already logged in ────────────────
  // Uses ONLY SessionProvider as source of truth – no duplicate token check
  useEffect(() => {
    if (sessionLoading || hasRedirected.current) return;
    if (session) {
      hasRedirected.current = true;
      const dest = session.role === 'therapist'
        ? '/therapist/dashboard'
        : '/patient/dashboard';
      router.replace(dest);
    }
  }, [session, sessionLoading]);

  function switchMode(m: Mode) {
    setMode(m);
    Animated.spring(slideAnim, {
      toValue: m === 'therapist' ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
    }).start();
  }

  // ── QR code magic link ──────────────────────────────────
  async function handleQRScan(data: string) {
    setShowScanner(false);
    setIsLoading(true);
    try {
      const token = data.trim();
      const backendReady = await api.waitForBackend();
      if (!backendReady) {
        Alert.alert('Erreur', "Le serveur n'est pas disponible.");
        return;
      }
      const result = await api.auth.loginWithToken(token);
      if (result) {
        await saveSession(result.session);
        setSession(result.session);
        // redirect handled by useEffect above
      }
    } catch (error: any) {
      Alert.alert('QR Code invalide', error?.message || "Ce QR code n'est pas valide.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePatientAccess() {
    if (!patientEmail.trim()) {
      Alert.alert('Email requis', 'Entre ton email patient pour te connecter.');
      return;
    }
    try {
      setPatientLoading(true);
      const backendReady = await api.waitForBackend();
      if (!backendReady) {
        Alert.alert('Erreur', "Le serveur n'est pas disponible.");
        return;
      }
      const result = await api.auth.loginPatientByMagicToken(patientEmail.trim());
      await saveSession(result.session);
      setSession(result.session);
      // redirect handled by useEffect above
    } catch (error: any) {
      Alert.alert('Connexion impossible', error?.message || 'Email patient invalide.');
    } finally {
      setPatientLoading(false);
    }
  }

  async function handleTherapistLogin() {
    if (!therapistEmail.trim() || !therapistPassword.trim()) {
      Alert.alert('Champs requis', "Remplis l'email et le mot de passe.");
      return;
    }
    try {
      setTherapistLoading(true);
      const backendReady = await api.waitForBackend();
      if (!backendReady) {
        Alert.alert('Erreur', "Le serveur n'est pas disponible.");
        return;
      }
      const result = await api.auth.login(therapistEmail.trim(), therapistPassword);
      await saveSession(result.session);
      setSession(result.session);
      // redirect handled by useEffect above
    } catch (error: any) {
      Alert.alert('Connexion impossible', error?.message || 'Identifiants invalides.');
    } finally {
      setTherapistLoading(false);
    }
  }

  // ── Show loading while SessionProvider checks ─────────
  if (sessionLoading) {
    return (
      <View style={s.loadingScreen}>
        <View style={s.loadingLogo}>
          <Image source={require('@/assets/images/logo-mindia.png')} style={s.loadingLogoImg} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing['2xl'] }} />
        <Text style={s.loadingText}>Chargement…</Text>
      </View>
    );
  }

  // If session exists, show loading while redirect happens
  if (session) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Redirection…</Text>
      </View>
    );
  }

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, toggleWidth ? (toggleWidth - 8) / 2 : 0],
  });

  // ── Desktop layout ──────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgDesktop} />
        <View style={s.desktopPage}>
          <View style={s.desktopLeft}>
            <View style={s.desktopBrand}>
              <Image source={require('@/assets/images/logo-mindia.png')} style={s.desktopLogo} />
              <Text style={s.desktopTitle}>
                <Text style={{ color: colors.text }}>Mind</Text>
                <Text style={{ color: colors.primary }}>IA</Text>
              </Text>
              <Text style={s.desktopTagline}>Votre relai entre les séances</Text>
              <View style={s.desktopFeatures}>
                {[
                  { icon: 'chatbubble-ellipses' as const, text: 'Discussion IA bienveillante 24/7' },
                  { icon: 'shield-checkmark' as const, text: 'Données sécurisées & confidentielles' },
                  { icon: 'people' as const, text: 'Lien direct avec votre thérapeute' },
                ].map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <View style={s.featureIcon}>
                      <Ionicons name={f.icon} size={18} color={colors.primary} />
                    </View>
                    <Text style={s.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={s.desktopRight}>
            <ScrollView contentContainerStyle={s.desktopFormScroll} showsVerticalScrollIndicator={false}>
              <View style={s.desktopCard}>
                <Text style={s.cardTitle}>Espace Démo</Text>
                <Text style={s.cardSubtitle}>Connectez-vous en tant que patient ou thérapeute</Text>

                <View style={s.toggle} onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}>
                  <Animated.View style={[s.toggleSlider, { transform: [{ translateX }] }]} />
                  <Pressable style={s.toggleBtn} onPress={() => switchMode('patient')}>
                    <Ionicons name={mode === 'patient' ? 'person' : 'person-outline'} size={16} color={mode === 'patient' ? colors.textOnPrimary : colors.textSecondary} />
                    <Text style={[s.toggleText, mode === 'patient' && s.toggleTextActive]}>Patient</Text>
                  </Pressable>
                  <Pressable style={s.toggleBtn} onPress={() => switchMode('therapist')}>
                    <Ionicons name={mode === 'therapist' ? 'medical' : 'medical-outline'} size={16} color={mode === 'therapist' ? colors.textOnPrimary : colors.textSecondary} />
                    <Text style={[s.toggleText, mode === 'therapist' && s.toggleTextActive]}>Thérapeute</Text>
                  </Pressable>
                </View>

                {mode === 'patient' ? (
                  <View style={s.formFields}>
                    <TextField label="Email patient" placeholder="prenom@exemple.com" value={patientEmail} onChangeText={setPatientEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
                    <Button title="Accéder à mon espace" icon="arrow-forward" onPress={handlePatientAccess} loading={patientLoading} size="lg" />
                    <View style={s.orDivider}><View style={s.orLine} /><Text style={s.orText}>ou</Text><View style={s.orLine} /></View>
                    <Button title="Scanner un QR code" icon="qr-code-outline" variant="secondary" onPress={() => setShowScanner(true)} disabled={isLoading} />
                  </View>
                ) : (
                  <View style={s.formFields}>
                    <TextField label="Email" placeholder="votre.email@exemple.com" value={therapistEmail} onChangeText={setTherapistEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
                    <TextField label="Mot de passe" placeholder="••••••••" value={therapistPassword} onChangeText={setTherapistPassword} secureTextEntry icon="lock-closed-outline" />
                    <Button title="Se connecter" icon="log-in-outline" onPress={handleTherapistLogin} loading={therapistLoading} size="lg" />
                  </View>
                )}
              </View>
              <Text style={s.footer}>En continuant, vous acceptez nos conditions d'utilisation{'\n'}et notre politique de confidentialité.</Text>
            </ScrollView>
          </View>
        </View>
        <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
          <QRScanner onScan={handleQRScan} onCancel={() => setShowScanner(false)} />
        </Modal>
      </>
    );
  }

  // ── Mobile layout ───────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={s.mobilePage}>
        {Platform.OS === 'android' && <View style={{ height: layout.safeAreaTop }} />}
        <ScrollView contentContainerStyle={s.mobileScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.mobileHeader}>
            <View style={s.mobileLogoWrap}>
              <Image source={require('@/assets/images/logo-mindia.png')} style={s.mobileLogo} />
            </View>
            <Text style={s.mobileTitle}>
              <Text style={{ color: colors.text }}>Mind</Text>
              <Text style={{ color: colors.primary }}>IA</Text>
            </Text>
            <Text style={s.mobileTagline}>Votre relai entre les séances</Text>
          </View>

          <View style={s.mobileCard}>
            <Text style={s.cardTitle}>Espace Démo</Text>
            <Text style={s.cardSubtitle}>Connecte-toi en tant que patient ou thérapeute</Text>

            <View style={s.toggle} onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}>
              <Animated.View style={[s.toggleSlider, { transform: [{ translateX }] }]} />
              <Pressable style={s.toggleBtn} onPress={() => switchMode('patient')}>
                <Ionicons name={mode === 'patient' ? 'person' : 'person-outline'} size={16} color={mode === 'patient' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[s.toggleText, mode === 'patient' && s.toggleTextActive]}>Patient</Text>
              </Pressable>
              <Pressable style={s.toggleBtn} onPress={() => switchMode('therapist')}>
                <Ionicons name={mode === 'therapist' ? 'medical' : 'medical-outline'} size={16} color={mode === 'therapist' ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[s.toggleText, mode === 'therapist' && s.toggleTextActive]}>Thérapeute</Text>
              </Pressable>
            </View>

            {mode === 'patient' ? (
              <View style={s.formFields}>
                {Platform.OS !== 'web' && (
                  <>
                    <Button title={isLoading ? 'Connexion…' : 'Scanner mon QR code'} icon="qr-code-outline" onPress={() => setShowScanner(true)} disabled={isLoading} size="lg" />
                    <View style={s.orDivider}><View style={s.orLine} /><Text style={s.orText}>ou</Text><View style={s.orLine} /></View>
                  </>
                )}
                <TextField label="Email patient" placeholder="prenom@exemple.com" value={patientEmail} onChangeText={setPatientEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
                <Button title="Accéder à mon espace" icon="arrow-forward" onPress={handlePatientAccess} loading={patientLoading} size="lg" />
              </View>
            ) : (
              <View style={s.formFields}>
                <TextField label="Email" placeholder="votre.email@exemple.com" value={therapistEmail} onChangeText={setTherapistEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
                <TextField label="Mot de passe" placeholder="••••••••" value={therapistPassword} onChangeText={setTherapistPassword} secureTextEntry icon="lock-closed-outline" />
                <Button title="Se connecter" icon="log-in-outline" onPress={handleTherapistLogin} loading={therapistLoading} size="lg" />
              </View>
            )}
          </View>

          <Text style={s.footer}>En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.</Text>
        </ScrollView>
      </View>
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <QRScanner onScan={handleQRScan} onCancel={() => setShowScanner(false)} />
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  loadingLogo: { width: 80, height: 80, borderRadius: radius['2xl'], backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', ...shadows.glow },
  loadingLogoImg: { width: 48, height: 48 },
  loadingText: { ...font.bodySmall, marginTop: spacing.lg },
  desktopPage: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgDesktop },
  desktopLeft: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['4xl'], borderRightWidth: 1, borderRightColor: colors.borderLight },
  desktopBrand: { maxWidth: 400, gap: spacing.lg },
  desktopLogo: { width: 64, height: 64, marginBottom: spacing.sm },
  desktopTitle: { fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  desktopTagline: { ...font.body, fontSize: 17, color: colors.textSecondary, lineHeight: 26 },
  desktopFeatures: { marginTop: spacing['2xl'], gap: spacing.xl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  featureIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  featureText: { ...font.bodyMedium, flex: 1 },
  desktopRight: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  desktopFormScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing['4xl'], paddingVertical: spacing['4xl'], width: '100%', maxWidth: 480, alignSelf: 'center' },
  desktopCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], padding: spacing['3xl'], gap: spacing['2xl'], ...shadows.lg, borderWidth: 1, borderColor: colors.borderLight },
  mobilePage: { flex: 1, backgroundColor: colors.bg },
  mobileScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing['2xl'], paddingVertical: spacing['4xl'] },
  mobileHeader: { alignItems: 'center', marginBottom: spacing['3xl'] },
  mobileLogoWrap: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, ...shadows.glow },
  mobileLogo: { width: 44, height: 44 },
  mobileTitle: { fontSize: 36, fontWeight: '800', letterSpacing: -0.8, marginBottom: spacing.xs },
  mobileTagline: { ...font.bodySmall, fontWeight: '500' },
  mobileCard: { gap: spacing['2xl'] },
  cardTitle: { ...font.subtitle, textAlign: 'center' },
  cardSubtitle: { ...font.bodySmall, textAlign: 'center', lineHeight: 20 },
  toggle: { position: 'relative', flexDirection: 'row', backgroundColor: colors.bgTertiary, borderRadius: radius.md, padding: 4 },
  toggleSlider: { position: 'absolute', left: 4, top: 4, bottom: 4, width: '48%', backgroundColor: colors.primary, borderRadius: radius.sm },
  toggleBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, zIndex: 1 },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: colors.textOnPrimary },
  formFields: { gap: spacing.lg },
  orDivider: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { paddingHorizontal: spacing.lg, ...font.caption, fontSize: 13 },
  footer: { ...font.caption, textAlign: 'center', marginTop: spacing['3xl'], lineHeight: 18 },
});
