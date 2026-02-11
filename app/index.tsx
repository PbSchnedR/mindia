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

  // Entrance animations
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!sessionLoading && !session) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 100 }),
          Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(titleTranslateY, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 120 }),
        ]),
        Animated.timing(formOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [sessionLoading, session]);

  useEffect(() => {
    if (sessionLoading || hasRedirected.current) return;
    if (session) {
      hasRedirected.current = true;
      const dest = session.role === 'therapist' ? '/therapist/dashboard' : '/patient/dashboard';
      router.replace(dest);
    }
  }, [session, sessionLoading]);

  function switchMode(m: Mode) {
    setMode(m);
    Animated.spring(slideAnim, { toValue: m === 'therapist' ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  }

  async function handleQRScan(data: string) {
    setShowScanner(false); setIsLoading(true);
    try {
      const token = data.trim();
      if (!(await api.waitForBackend())) { Alert.alert('Erreur', "Serveur indisponible."); return; }
      const result = await api.auth.loginWithToken(token);
      if (result) { await saveSession(result.session); setSession(result.session); }
    } catch (error: any) { Alert.alert('QR Code invalide', error?.message || "QR code invalide."); }
    finally { setIsLoading(false); }
  }

  async function handlePatientAccess() {
    if (!patientEmail.trim()) { Alert.alert('Email requis', 'Entre ton email patient.'); return; }
    try {
      setPatientLoading(true);
      if (!(await api.waitForBackend())) { Alert.alert('Erreur', "Serveur indisponible."); return; }
      const result = await api.auth.loginPatientByMagicToken(patientEmail.trim());
      await saveSession(result.session); setSession(result.session);
    } catch (error: any) { Alert.alert('Connexion impossible', error?.message || 'Email invalide.'); }
    finally { setPatientLoading(false); }
  }

  async function handleTherapistLogin() {
    if (!therapistEmail.trim() || !therapistPassword.trim()) { Alert.alert('Champs requis', "Email et mot de passe requis."); return; }
    try {
      setTherapistLoading(true);
      if (!(await api.waitForBackend())) { Alert.alert('Erreur', "Serveur indisponible."); return; }
      const result = await api.auth.login(therapistEmail.trim(), therapistPassword);
      await saveSession(result.session); setSession(result.session);
    } catch (error: any) { Alert.alert('Connexion impossible', error?.message || 'Identifiants invalides.'); }
    finally { setTherapistLoading(false); }
  }

  if (sessionLoading || session) {
    return (
      <View style={s.loadingScreen}>
        <Animated.View style={[s.loadingLogo, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
          <Image source={require('@/assets/images/logo-mindia.png')} style={s.loadingLogoImg} />
        </Animated.View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing['2xl'] }} />
        <Text style={s.loadingText}>{session ? 'Redirection...' : 'Chargement...'}</Text>
      </View>
    );
  }

  const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, toggleWidth ? (toggleWidth - 8) / 2 : 0] });

  // ── Shared form ──────────────────────────────────────────
  const renderForm = () => (
    <Animated.View style={{ opacity: formOpacity, gap: spacing['2xl'] }}>
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
              <Button title={isLoading ? 'Connexion...' : 'Scanner mon QR code'} icon="qr-code-outline" onPress={() => setShowScanner(true)} disabled={isLoading} size="lg" />
              <View style={s.orDivider}><View style={s.orLine} /><Text style={s.orText}>ou</Text><View style={s.orLine} /></View>
            </>
          )}
          <TextField label="Email patient" placeholder="prenom@exemple.com" value={patientEmail} onChangeText={setPatientEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
          <Button title="Accéder à mon espace" icon="arrow-forward" onPress={handlePatientAccess} loading={patientLoading} size="lg" />
          {Platform.OS === 'web' && (
            <>
              <View style={s.orDivider}><View style={s.orLine} /><Text style={s.orText}>ou</Text><View style={s.orLine} /></View>
              <Button title="Scanner un QR code" icon="qr-code-outline" variant="secondary" onPress={() => setShowScanner(true)} disabled={isLoading} />
            </>
          )}
        </View>
      ) : (
        <View style={s.formFields}>
          <TextField label="Email" placeholder="votre.email@exemple.com" value={therapistEmail} onChangeText={setTherapistEmail} autoCapitalize="none" keyboardType="email-address" icon="mail-outline" />
          <TextField label="Mot de passe" placeholder="••••••••" value={therapistPassword} onChangeText={setTherapistPassword} secureTextEntry icon="lock-closed-outline" />
          <Button title="Se connecter" icon="log-in-outline" onPress={handleTherapistLogin} loading={therapistLoading} size="lg" />
        </View>
      )}
    </Animated.View>
  );

  // ── Desktop ──────────────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgDesktop} />
        <View style={s.desktopPage}>
          <View style={s.desktopLeft}>
            <View style={s.desktopBrand}>
              <Animated.View style={[s.desktopLogoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
                <Image source={require('@/assets/images/logo-mindia.png')} style={s.desktopLogo} />
              </Animated.View>
              <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }}>
                <Text style={s.desktopTitle}>
                  <Text style={{ color: colors.text }}>Mind</Text>
                  <Text style={{ color: colors.primary }}>IA</Text>
                </Text>
                <Text style={s.desktopTagline}>Votre relai entre les séances</Text>
              </Animated.View>
              <Animated.View style={[s.desktopFeatures, { opacity: formOpacity }]}>
                {[
                  { icon: 'chatbubble-ellipses' as const, text: 'Discussion IA bienveillante 24/7' },
                  { icon: 'shield-checkmark' as const, text: 'Données sécurisées & confidentielles' },
                  { icon: 'people' as const, text: 'Lien direct avec votre thérapeute' },
                ].map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <View style={s.featureIcon}><Ionicons name={f.icon} size={20} color={colors.primary} /></View>
                    <Text style={s.featureText}>{f.text}</Text>
                  </View>
                ))}
              </Animated.View>
            </View>
          </View>

          <View style={s.desktopRight}>
            <ScrollView contentContainerStyle={s.desktopFormScroll} showsVerticalScrollIndicator={false}>
              <View style={s.desktopCard}>
                <View style={{ alignItems: 'center', gap: spacing.sm }}>
                  <Text style={s.cardTitle}>Espace Démo</Text>
                  <Text style={s.cardSubtitle}>Connectez-vous en tant que patient ou thérapeute</Text>
                </View>
                {renderForm()}
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

  // ── Mobile ───────────────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={s.mobilePage}>
        {Platform.OS === 'android' && <View style={{ height: layout.safeAreaTop }} />}
        <ScrollView contentContainerStyle={s.mobileScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.mobileHeader}>
            <Animated.View style={[s.mobileLogoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
              <Image source={require('@/assets/images/logo-mindia.png')} style={s.mobileLogo} />
            </Animated.View>
            <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }], alignItems: 'center' }}>
              <Text style={s.mobileTitle}>
                <Text style={{ color: colors.text }}>Mind</Text>
                <Text style={{ color: colors.primary }}>IA</Text>
              </Text>
              <Text style={s.mobileTagline}>Votre relai entre les séances</Text>
            </Animated.View>
          </View>

          <View style={s.mobileCard}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Text style={s.cardTitle}>Espace Démo</Text>
              <Text style={s.cardSubtitle}>Connecte-toi en tant que patient ou thérapeute</Text>
            </View>
            {renderForm()}
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
  loadingLogo: { width: 96, height: 96, borderRadius: radius['3xl'], backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', ...shadows.glow },
  loadingLogoImg: { width: 60, height: 60 },
  loadingText: { ...font.bodySmall, marginTop: spacing.lg },

  // Desktop
  desktopPage: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgDesktop },
  desktopLeft: { flex: 1, backgroundColor: colors.bgDark, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['5xl'] },
  desktopBrand: { maxWidth: 440, gap: spacing['2xl'] },
  desktopLogoWrap: { width: 96, height: 96, borderRadius: radius['3xl'], backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', ...shadows.glow },
  desktopLogo: { width: 60, height: 60 },
  desktopTitle: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  desktopTagline: { fontSize: 18, fontWeight: '400', color: colors.textOnDark, lineHeight: 28, marginTop: spacing.sm },
  desktopFeatures: { marginTop: spacing.lg, gap: spacing.xl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  featureIcon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center' },
  featureText: { fontSize: 15, fontWeight: '500', color: colors.textOnDark, flex: 1 },
  desktopRight: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  desktopFormScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing['4xl'], paddingVertical: spacing['4xl'], width: '100%', maxWidth: 480, alignSelf: 'center' },
  desktopCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], padding: spacing['3xl'], gap: spacing['2xl'] },

  // Mobile
  mobilePage: { flex: 1, backgroundColor: colors.bg },
  mobileScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing['2xl'], paddingVertical: spacing['4xl'] },
  mobileHeader: { alignItems: 'center', marginBottom: spacing['3xl'] },
  mobileLogoWrap: { width: 88, height: 88, borderRadius: radius['2xl'], backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl, ...shadows.glow },
  mobileLogo: { width: 56, height: 56 },
  mobileTitle: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginBottom: spacing.xs },
  mobileTagline: { ...font.body, fontWeight: '500', color: colors.textSecondary },
  mobileCard: { gap: spacing['2xl'] },

  // Shared
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
