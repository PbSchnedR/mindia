import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList, Pressable, StyleSheet, View, Text, Modal, Alert, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { HeaderIconButton } from '@/components/ui/page-layout';
import { EmptyState } from '@/components/ui/empty-state';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { listChatSessionsForTherapist } from '@/lib/chat';
import { useSession } from '@/lib/session-context';
import { getTherapistById, listPatientsForTherapist } from '@/lib/people';
import { api } from '@/lib/api';
import type { ChatSession, Patient } from '@/lib/types';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

type PatientRow = Patient & { lastSeverity?: number; lastSummary?: string; lastDate?: string };

const getMoodData = (actualMood?: string | null, severity?: number): { icon: 'happy' | 'sad' | 'warning' | 'ellipse'; color: string; label: string; bg: string } => {
  let value: number | undefined;
  if (actualMood) { const p = parseInt(String(actualMood), 10); if (p >= 1 && p <= 3) value = p; }
  if (!value && typeof severity === 'number') value = severity;
  if (value === 1) return { icon: 'happy', color: colors.success, label: 'Bien', bg: colors.successLight };
  if (value === 2) return { icon: 'sad', color: colors.warning, label: 'Difficile', bg: colors.warningLight };
  if (value === 3) return { icon: 'warning', color: colors.error, label: 'Urgence', bg: colors.errorLight };
  return { icon: 'ellipse', color: colors.textTertiary, label: 'Non renseigne', bg: colors.bgTertiary };
};

export default function TherapistDashboardScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const isDesktop = useIsDesktop();
  const hasRedirected = useRef(false);

  const [therapistName, setTherapistName] = useState('');
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || session.role !== 'therapist') {
      if (!hasRedirected.current) { hasRedirected.current = true; router.replace('/'); }
      return;
    }
    void (async () => {
      setLoading(true); setError(null);
      try {
        const therapist = await getTherapistById(session.therapistId);
        if (therapist) setTherapistName(`${therapist.firstName} ${therapist.lastName}`);
        await loadPatients();
      } catch (err: any) {
        if (err?.status === 401) await handleSignOut();
        else setError('Une erreur est survenue.');
      } finally { setLoading(false); }
    })();
  }, [session, sessionLoading]);

  const loadPatients = async () => {
    if (!session || session.role !== 'therapist') return;
    const p = await listPatientsForTherapist(session.therapistId);
    const sessions = await listChatSessionsForTherapist(session.therapistId);
    const byPatient: Record<string, ChatSession | undefined> = {};
    for (const s of sessions) { const ex = byPatient[s.patientId]; if (!ex || ex.createdAt < s.createdAt) byPatient[s.patientId] = s; }
    setPatients(p.map((pt) => { const last = byPatient[pt.id]; return { ...pt, lastSeverity: last?.severity, lastSummary: last?.summary, lastDate: last?.createdAt }; }));
    setError(null);
  };

  const handleSignOut = async () => { await signOut(); router.replace('/'); };

  const handleCreatePatient = async () => {
    if (!session || session.role !== 'therapist') return;
    setCreateError(null);
    if (!newUsername.trim() || !newEmail.trim()) { setCreateError('Nom et email requis'); return; }
    setCreating(true);
    try {
      await api.users.createPatient(session.therapistId, { username: newUsername.trim(), email: newEmail.trim().toLowerCase() });
      setNewUsername(''); setNewEmail(''); setShowCreateModal(false); await loadPatients();
      Alert.alert('Succès', 'Patient créé avec succès');
    } catch (err: any) { setCreateError(err?.message || 'Erreur lors de la création'); }
    finally { setCreating(false); }
  };

  if (sessionLoading || loading) {
    return <View style={[s.center, { flex: 1, backgroundColor: isDesktop ? colors.bgDesktop : colors.bg }]}><Text style={font.bodySmall}>Chargement…</Text></View>;
  }
  if (error) {
    return (
      <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}>
        <View style={s.errorCard}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[font.subtitle, { color: colors.error }]}>Oups !</Text>
          <Text style={[font.bodySmall, { textAlign: 'center' }]}>{error}</Text>
          <Button title="Réessayer" onPress={() => { setLoading(true); loadPatients().finally(() => setLoading(false)); }} />
          <Button title="Déconnexion" variant="ghost" onPress={handleSignOut} />
        </View>
      </View>
    );
  }

  // ── Stats ──────────────────────────────────────────────
  const urgentCount = patients.filter((p) => p.actualMood === '3' || p.lastSeverity === 3).length;
  const difficultCount = patients.filter((p) => p.actualMood === '2' || p.lastSeverity === 2).length;

  const renderPatient = ({ item }: { item: PatientRow }) => {
    const mood = getMoodData(item.actualMood, item.lastSeverity);
    return (
      <Pressable onPress={() => router.push(`/therapist/patient/${item.id}`)} style={({ pressed }) => [s.patientCard, isDesktop && s.patientCardDesktop, pressed && s.patientCardPressed]}>
        <View style={s.patientRow}>
          <View style={[s.patientAvatar, { backgroundColor: mood.bg }]}><Ionicons name={mood.icon} size={22} color={mood.color} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.patientName}>{item.firstName} {item.lastName}</Text>
            <Text style={font.caption}>{item.therapyTopic ?? 'Sujet non renseigné'} · {item.sessionsDone ?? 0} séances</Text>
          </View>
          <View style={[s.moodPill, { backgroundColor: mood.bg }]}>
            <View style={[s.moodDot, { backgroundColor: mood.color }]} />
            <Text style={[font.caption, { color: mood.color, fontWeight: '600' }]}>{mood.label}</Text>
          </View>
        </View>
        {item.lastSummary && <Text style={[font.bodySmall, { marginTop: spacing.sm }]} numberOfLines={2}>{item.lastSummary}</Text>}
      </Pressable>
    );
  };

  // ── Create Modal ───────────────────────────────────────
  const renderCreateModal = () => (
    <Modal visible={showCreateModal} animationType="fade" transparent onRequestClose={() => setShowCreateModal(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}><Text style={font.subtitle}>Nouveau patient</Text><HeaderIconButton icon="close" onPress={() => setShowCreateModal(false)} /></View>
          <View style={s.modalBody}>
            <TextField label="Nom complet" placeholder="Ex: Jean Dupont" value={newUsername} onChangeText={setNewUsername} autoCapitalize="words" icon="person-outline" />
            <TextField label="Email" placeholder="jean.dupont@exemple.com" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
            {createError && <Text style={s.createErr}>{createError}</Text>}
          </View>
          <View style={s.modalFooter}>
            <Button title="Annuler" variant="ghost" onPress={() => { setShowCreateModal(false); setCreateError(null); setNewUsername(''); setNewEmail(''); }} style={{ flex: 1 }} />
            <Button title="Créer le patient" onPress={handleCreatePatient} loading={creating} disabled={!newUsername.trim() || !newEmail.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── Desktop ─────────────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <View style={s.desktopRoot}>
          {/* Sidebar */}
          <View style={s.desktopSidebar}>
            <View style={s.sidebarHeader}>
              <View style={s.sidebarLogoRow}>
                <Image source={require('@/assets/images/logo-mindia.png')} style={s.sidebarLogo} />
                <Text style={s.sidebarTitle}><Text style={{ color: colors.text }}>Mind</Text><Text style={{ color: colors.primary }}>IA</Text></Text>
              </View>
              <Text style={[font.caption, { marginTop: spacing.sm }]}>Dr. {therapistName || 'Thérapeute'}</Text>
            </View>

            <View style={s.sidebarNav}>
              <View style={[s.navItem, s.navItemActive]}>
                <Ionicons name="people" size={20} color={colors.primary} />
                <Text style={[s.navLabel, s.navLabelActive]}>Mes Patients</Text>
              </View>
              <Pressable style={s.navItem} onPress={() => router.push('/therapist/settings')}>
                <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
                <Text style={s.navLabel}>Paramètres</Text>
              </Pressable>
            </View>

            <View style={s.sidebarFooter}>
              <Pressable onPress={handleSignOut} style={s.sidebarSignOut}>
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                <Text style={[font.bodySmall, { color: colors.error, fontWeight: '600' }]}>Déconnexion</Text>
              </Pressable>
            </View>
          </View>

          {/* Main */}
          <View style={s.desktopMain}>
            {/* Header */}
            <View style={s.desktopHeader}>
              <View>
                <Text style={font.title}>Mes Patients</Text>
                <Text style={[font.bodySmall, { marginTop: 2 }]}>Vue d'ensemble de vos patients et de leur état actuel</Text>
              </View>
              <Button title="Ajouter un patient" icon="add" onPress={() => setShowCreateModal(true)} />
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statNumber}>{patients.length}</Text>
                <Text style={font.caption}>Patients</Text>
              </View>
              {urgentCount > 0 && (
                <View style={[s.statCard, { borderColor: colors.error }]}>
                  <Text style={[s.statNumber, { color: colors.error }]}>{urgentCount}</Text>
                  <Text style={[font.caption, { color: colors.error }]}>En urgence</Text>
                </View>
              )}
              {difficultCount > 0 && (
                <View style={[s.statCard, { borderColor: colors.warning }]}>
                  <Text style={[s.statNumber, { color: colors.warning }]}>{difficultCount}</Text>
                  <Text style={[font.caption, { color: colors.warning }]}>En difficulté</Text>
                </View>
              )}
            </View>

            {/* Patient list */}
            <FlatList
              key="desktop-2"
              data={patients}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.desktopList}
              numColumns={2}
              columnWrapperStyle={s.desktopColumns}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              renderItem={renderPatient}
              ListEmptyComponent={
                <EmptyState icon="people-outline" title="Aucun patient" subtitle="Ajoutez votre premier patient pour commencer le suivi" action={<Button title="Ajouter un patient" icon="add" size="sm" onPress={() => setShowCreateModal(true)} />} />
              }
            />
          </View>
        </View>

        {renderCreateModal()}
      </>
    );
  }

  // ── Mobile ──────────────────────────────────────────────
  return (
    <>
      <View style={s.mobilePage}>
        {Platform.OS === 'android' && <View style={{ height: layout.safeAreaTop }} />}

        {/* Header */}
        <View style={s.mobileHeader}>
          <View style={{ flex: 1 }}>
            <Text style={font.caption}>Bonjour Dr. {therapistName}</Text>
            <Text style={font.title}>Mes Patients</Text>
          </View>
          <Pressable onPress={() => router.push('/therapist/settings')} style={s.mobileSettingsBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleSignOut} style={s.mobileLogoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </Pressable>
        </View>

        {/* Add + stats */}
        <View style={s.mobileActions}>
          <Pressable style={s.addBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={[font.bodyMedium, { color: colors.primary }]}>Ajouter</Text>
          </Pressable>
          <View style={s.mobileStats}>
            <Text style={font.caption}>{patients.length} patient{patients.length > 1 ? 's' : ''}</Text>
            {urgentCount > 0 && <Text style={[font.caption, { color: colors.error }]}>· {urgentCount} urgence{urgentCount > 1 ? 's' : ''}</Text>}
          </View>
        </View>

        {/* Patient list */}
        <FlatList
          key="mobile-1"
          data={patients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.mobileList}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={renderPatient}
          ListEmptyComponent={
            <EmptyState icon="people-outline" title="Aucun patient" subtitle="Ajoutez votre premier patient" action={<Button title="Ajouter" icon="add" size="sm" onPress={() => setShowCreateModal(true)} />} />
          }
        />
      </View>
      {renderCreateModal()}
    </>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], padding: spacing['3xl'], alignItems: 'center', maxWidth: 380, width: '100%', gap: spacing.lg, ...shadows.lg },

  // Desktop layout
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
  desktopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['3xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.bg },
  statsRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing['3xl'], paddingVertical: spacing.lg },
  statCard: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center', minWidth: 100 },
  statNumber: { fontSize: 24, fontWeight: '800', color: colors.primary },
  desktopList: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['4xl'] },
  desktopColumns: { gap: spacing.md },

  // Mobile layout
  mobilePage: { flex: 1, backgroundColor: colors.bg },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.pagePadding, paddingTop: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  mobileActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: layout.pagePadding, paddingBottom: spacing.md },
  mobileSettingsBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  mobileLogoutBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.primaryMedium },
  mobileStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mobileList: { paddingHorizontal: layout.pagePadding, paddingBottom: spacing['4xl'] },

  // Patient card
  patientCard: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm },
  patientCardDesktop: { flex: 1 },
  patientCardPressed: { backgroundColor: colors.bgSecondary, borderColor: colors.primaryMedium },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  patientAvatar: { width: 48, height: 48, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  patientName: { ...font.bodyMedium, fontWeight: '700', fontSize: 16 },
  moodPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radius.full },
  moodDot: { width: 8, height: 8, borderRadius: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'] },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], width: '100%', maxWidth: 440, maxHeight: '90%', ...shadows.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg },
  modalBody: { paddingHorizontal: spacing['2xl'], gap: spacing.xl, paddingBottom: spacing.xl },
  modalFooter: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderLight },
  createErr: { color: colors.error, fontSize: 14, textAlign: 'center' },
});
