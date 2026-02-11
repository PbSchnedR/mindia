import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Alert, Pressable, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { PageLayout } from '@/components/ui/page-layout';
import { SectionCard } from '@/components/ui/section-card';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { useSession } from '@/lib/session-context';
import { api } from '@/lib/api';
import { getTherapistById } from '@/lib/people';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

export default function TherapistSettingsScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const isDesktop = useIsDesktop();
  const hasRedirected = useRef(false);

  const [therapistName, setTherapistName] = useState('');
  const [therapistEmail, setTherapistEmail] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || session.role !== 'therapist') {
      if (!hasRedirected.current) { hasRedirected.current = true; router.replace('/'); }
      return;
    }
    void (async () => {
      try {
        const t = await getTherapistById(session.therapistId);
        if (t) {
          setTherapistName(`${t.firstName} ${t.lastName}`);
          setTherapistEmail(t.email || '');
          if (t.bookingUrl) setBookingUrl(t.bookingUrl);
        }
      } catch (e) { console.warn('Erreur chargement settings:', e); }
    })();
  }, [session, sessionLoading]);

  const handleSignOut = async () => { setMenuOpen(false); await signOut(); router.replace('/'); };

  const handleSaveBookingUrl = async () => {
    if (!session || session.role !== 'therapist') return;
    setSaving(true);
    try {
      await api.users.update(session.therapistId, { bookingUrl: bookingUrl.trim() || null } as any);
      Alert.alert('Enregistré', 'Votre lien de réservation a été mis à jour.');
    } catch (e: any) { Alert.alert('Erreur', e?.message || "Impossible d'enregistrer."); }
    finally { setSaving(false); }
  };

  const renderContent = () => (
    <View style={{ gap: spacing['2xl'] }}>
      {/* Profile */}
      <SectionCard title="Mon profil" icon="person-outline" variant="elevated">
        <Text style={[font.caption, { marginBottom: spacing.sm }]}>Informations de votre compte professionnel</Text>
        <View style={s.infoRow}>
          <View style={s.infoIcon}><Ionicons name="person" size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}><Text style={font.caption}>Nom complet</Text><Text style={font.bodyMedium}>{therapistName || '—'}</Text></View>
        </View>
        <View style={s.separator} />
        <View style={s.infoRow}>
          <View style={s.infoIcon}><Ionicons name="mail" size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}><Text style={font.caption}>Email</Text><Text style={font.bodyMedium}>{therapistEmail || '—'}</Text></View>
        </View>
      </SectionCard>

      {/* Grid: 2 cols on desktop */}
      <View style={isDesktop ? s.settingsGrid : s.settingsStack}>
        <SectionCard title="Prise de rendez-vous" icon="calendar-outline" variant="elevated" style={isDesktop ? { flex: 1 } : undefined}>
          <Text style={font.bodySmall}>Ajoutez votre lien Calendly, Doctolib ou autre pour permettre a vos patients de prendre rendez-vous directement.</Text>
          <TextField label="URL de reservation" placeholder="https://calendly.com/votre-lien" value={bookingUrl} onChangeText={setBookingUrl} autoCapitalize="none" keyboardType="url" icon="link-outline" />
          <Button title="Enregistrer" icon="checkmark" onPress={handleSaveBookingUrl} loading={saving} size="sm" />
        </SectionCard>

        <SectionCard title="Notifications" icon="notifications-outline" variant="elevated" style={isDesktop ? { flex: 1 } : undefined}>
          <View style={s.comingSoonRow}><View style={s.comingSoonBadge}><Text style={s.comingSoonText}>Prochainement</Text></View></View>
          <Text style={font.bodySmall}>Configurez vos alertes en cas de situation de crise d'un patient.</Text>
          <View style={s.comingSoonFeatures}>
            <View style={s.featureItem}><Ionicons name="notifications" size={16} color={colors.warning} /><Text style={font.caption}>Alertes urgence</Text></View>
            <View style={s.featureItem}><Ionicons name="mail" size={16} color={colors.primary} /><Text style={font.caption}>Notifications email</Text></View>
          </View>
        </SectionCard>
      </View>

      <View style={isDesktop ? { maxWidth: '50%' } : undefined}>
        <SectionCard title="Securite & Confidentialite" icon="shield-outline" variant="elevated">
          <View style={s.comingSoonRow}><View style={s.comingSoonBadge}><Text style={s.comingSoonText}>Prochainement</Text></View></View>
          <Text style={font.bodySmall}>Chiffrement des donnees, gestion des acces, export des donnees patient.</Text>
          <View style={s.comingSoonFeatures}>
            <View style={s.featureItem}><Ionicons name="lock-closed" size={16} color={colors.success} /><Text style={font.caption}>Chiffrement E2E</Text></View>
            <View style={s.featureItem}><Ionicons name="download" size={16} color={colors.primary} /><Text style={font.caption}>Export RGPD</Text></View>
          </View>
        </SectionCard>
      </View>
    </View>
  );

  // ── Desktop ─────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={s.desktopRoot}>
        <View style={s.desktopSidebar}>
          <View style={s.sidebarHeader}>
            <View style={s.sidebarLogoRow}>
              <Image source={require('@/assets/images/logo-mindia.png')} style={s.sidebarLogo} />
              <Text style={s.sidebarTitle}><Text style={{ color: colors.text }}>Mind</Text><Text style={{ color: colors.primary }}>IA</Text></Text>
            </View>
            <Text style={[font.caption, { marginTop: spacing.sm }]}>Dr. {therapistName || 'Thérapeute'}</Text>
          </View>
          <View style={s.sidebarNav}>
            <Pressable style={s.navItem} onPress={() => router.push('/therapist/dashboard')}>
              <Ionicons name="people-outline" size={20} color={colors.textTertiary} />
              <Text style={s.navLabel}>Mes Patients</Text>
            </Pressable>
            <View style={[s.navItem, s.navItemActive]}>
              <Ionicons name="settings" size={20} color={colors.primary} />
              <Text style={[s.navLabel, s.navLabelActive]}>Paramètres</Text>
            </View>
          </View>
          <View style={s.sidebarFooter}>
            <Pressable onPress={handleSignOut} style={s.sidebarSignOut}>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={[font.bodySmall, { color: colors.error, fontWeight: '600' }]}>Déconnexion</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.desktopMain}>
          <View style={s.desktopContentHeader}>
            <Text style={font.title}>Paramètres</Text>
            <Text style={[font.bodySmall, { marginTop: 2 }]}>Gérez votre profil, la prise de rendez-vous et les préférences de votre compte</Text>
          </View>
          <ScrollView contentContainerStyle={s.desktopScroll} showsVerticalScrollIndicator={false}>
            {renderContent()}
          </ScrollView>
        </View>
      </View>
    );
  }

  // ── Mobile ──────────────────────────────────────────────
  return (
    <PageLayout
      title="Paramètres"
      subtitle={therapistName || 'Mon compte'}
      headerRight={
        <View style={s.mobileHeaderActions}>
          <Pressable onPress={() => router.push('/therapist/dashboard')} style={s.mobileNavBtn}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleSignOut} style={s.mobileLogoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      }
    >
      {renderContent()}
    </PageLayout>
  );
}

const s = StyleSheet.create({
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  infoIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, backgroundColor: colors.borderLight },
  comingSoonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  comingSoonBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  comingSoonText: { ...font.caption, color: colors.warning, fontWeight: '600' },
  comingSoonFeatures: { gap: spacing.sm, marginTop: spacing.sm },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  settingsGrid: { flexDirection: 'row', gap: spacing.xl },
  settingsStack: { gap: spacing.xl },
  mobileHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mobileNavBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  mobileLogoutBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },

  // Desktop
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgDesktop },
  desktopSidebar: { width: 260, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.borderLight, paddingVertical: spacing['2xl'], justifyContent: 'space-between' },
  sidebarHeader: { paddingHorizontal: spacing['2xl'], marginBottom: spacing['3xl'] },
  sidebarLogoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sidebarLogo: { width: 36, height: 36 },
  sidebarTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sidebarNav: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg },
  navItemActive: { backgroundColor: colors.primaryLight },
  navLabel: { ...font.bodyMedium, color: colors.textSecondary },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  sidebarFooter: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sidebarSignOut: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  desktopMain: { flex: 1 },
  desktopContentHeader: { paddingHorizontal: spacing['3xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.bg },
  desktopScroll: { padding: spacing['3xl'], gap: spacing['2xl'] },
});
