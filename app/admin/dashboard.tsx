import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView, Modal, Alert, Platform, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/section-card';
import { HeaderIconButton } from '@/components/ui/page-layout';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { useSession } from '@/lib/session-context';
import { api } from '@/lib/api';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

type TabKey = 'therapists' | 'patients' | 'stats';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const isDesktop = useIsDesktop();
  const hasRedirected = useRef(false);

  const [activeTab, setActiveTab] = useState<TabKey>('therapists');
  const [therapists, setTherapists] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create therapist modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newProfession, setNewProfession] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || session.role !== 'admin') {
      if (!hasRedirected.current) { hasRedirected.current = true; router.replace('/'); }
      return;
    }
    loadData();
  }, [session, sessionLoading]);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, therapistsRes, patientsRes] = await Promise.all([
        api.admin.getStats(),
        api.admin.getTherapists(),
        api.admin.getAllPatients(),
      ]);
      setStats(statsRes.stats);
      setTherapists(therapistsRes.therapists);
      setPatients(patientsRes.patients);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  const handleSignOut = async () => { await signOut(); router.replace('/'); };

  const handleCreateTherapist = async () => {
    setCreateError(null);
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError('Nom, email et mot de passe requis'); return;
    }
    if (newPassword.length < 6) { setCreateError('Mot de passe: 6 caractères minimum'); return; }
    setCreating(true);
    try {
      await api.admin.createTherapist({
        username: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        profession: newProfession.trim() || undefined,
      });
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewProfession('');
      setShowCreate(false);
      await loadData();
    } catch (e: any) { setCreateError(e?.message || 'Erreur lors de la création'); }
    finally { setCreating(false); }
  };

  const handleDeleteTherapist = async (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Supprimer le thérapeute ${name} ?`)) return;
    } else {
      // On mobile use Alert
      return new Promise<void>((resolve) => {
        Alert.alert('Confirmer', `Supprimer le thérapeute ${name} ?`, [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve() },
          { text: 'Supprimer', style: 'destructive', onPress: async () => {
            try { await api.admin.deleteTherapist(id); await loadData(); } catch {}
            resolve();
          }},
        ]);
      });
    }
    try { await api.admin.deleteTherapist(id); await loadData(); } catch {}
  };

  if (sessionLoading || loading) {
    return <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}><Text style={font.bodySmall}>Chargement...</Text></View>;
  }

  // ── Stats Tab ────────────────────────────────
  const renderStats = () => (
    <View style={s.tabContent}>
      <View style={isDesktop ? s.statsGrid : s.statsStack}>
        {[
          { label: 'Thérapeutes', value: stats?.therapists ?? 0, icon: 'medical' as const, color: colors.primary },
          { label: 'Patients', value: stats?.patients ?? 0, icon: 'people' as const, color: colors.success },
          { label: 'Admins', value: stats?.admins ?? 0, icon: 'shield-checkmark' as const, color: colors.warning },
          { label: 'Total utilisateurs', value: stats?.total ?? 0, icon: 'globe' as const, color: colors.ai },
        ].map((stat, i) => (
          <View key={i} style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: stat.color + '14' }]}>
              <Ionicons name={stat.icon} size={24} color={stat.color} />
            </View>
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={font.caption}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ── Therapists Tab ───────────────────────────
  const renderTherapists = () => (
    <View style={s.tabContent}>
      <View style={s.tabHeader}>
        <Text style={font.sectionTitle}>{therapists.length} thérapeute{therapists.length > 1 ? 's' : ''}</Text>
        <Button title="Ajouter" icon="add" size="sm" onPress={() => setShowCreate(true)} />
      </View>
      {therapists.length === 0 ? (
        <EmptyState icon="medical-outline" title="Aucun thérapeute" subtitle="Créez le premier thérapeute" />
      ) : (
        <View style={s.cardList}>
          {therapists.map((t: any) => (
            <View key={t._id} style={s.userCard}>
              <View style={s.userRow}>
                <View style={[s.userAvatar, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="medical" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={font.bodyMedium}>{t.username}</Text>
                  <Text style={font.caption}>{t.email}</Text>
                  {t.profession && <Text style={[font.caption, { color: colors.primary }]}>{t.profession}</Text>}
                </View>
                <View style={s.userMeta}>
                  <Text style={[font.caption, { fontWeight: '600' }]}>{t.patients?.length || 0} patients</Text>
                </View>
                <Pressable onPress={() => handleDeleteTherapist(t._id, t.username)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ── Patients Tab ─────────────────────────────
  const renderPatients = () => (
    <View style={s.tabContent}>
      <Text style={font.sectionTitle}>{patients.length} patient{patients.length > 1 ? 's' : ''}</Text>
      {patients.length === 0 ? (
        <EmptyState icon="people-outline" title="Aucun patient" subtitle="Les patients sont créés par les thérapeutes" />
      ) : (
        <View style={s.cardList}>
          {patients.map((p: any) => (
            <View key={p._id} style={s.userCard}>
              <View style={s.userRow}>
                <View style={[s.userAvatar, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="person" size={20} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={font.bodyMedium}>{p.username}</Text>
                  <Text style={font.caption}>{p.email}</Text>
                </View>
                <View style={s.userMeta}>
                  {p.actual_mood && (
                    <View style={[s.moodDot, { backgroundColor: p.actual_mood === '3' ? colors.error : p.actual_mood === '2' ? colors.warning : colors.success }]} />
                  )}
                  <Text style={font.caption}>{p.sessionsDone || 0} séances</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'stats': return renderStats();
      case 'therapists': return renderTherapists();
      case 'patients': return renderPatients();
    }
  };

  const NAV_ITEMS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'therapists', label: 'Thérapeutes', icon: 'medical-outline', iconActive: 'medical' },
    { key: 'patients', label: 'Patients', icon: 'people-outline', iconActive: 'people' },
    { key: 'stats', label: 'Statistiques', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  ];

  // ── Desktop ──────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <View style={s.desktopRoot}>
          <View style={s.sidebar}>
            <View style={s.sidebarHeader}>
              <View style={s.logoRow}>
                <Image source={require('@/assets/images/logo-mindia.png')} style={s.logo} />
                <Text style={s.brandTitle}><Text style={{ color: colors.text }}>Mind</Text><Text style={{ color: colors.primary }}>IA</Text></Text>
              </View>
              <View style={s.adminBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.warning} />
                <Text style={[font.caption, { color: colors.warning, fontWeight: '700' }]}>Admin</Text>
              </View>
            </View>
            <View style={s.sidebarNav}>
              {NAV_ITEMS.map((item) => {
                const active = item.key === activeTab;
                return (
                  <Pressable key={item.key} onPress={() => setActiveTab(item.key)} style={[s.navItem, active && s.navItemActive]}>
                    <Ionicons name={active ? item.iconActive : item.icon} size={20} color={active ? colors.primary : colors.textTertiary} />
                    <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={s.sidebarFooter}>
              <Pressable onPress={handleSignOut} style={s.signOutBtn}>
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                <Text style={[font.bodySmall, { color: colors.error, fontWeight: '600' }]}>Déconnexion</Text>
              </Pressable>
            </View>
          </View>
          <View style={s.mainArea}>
            <View style={s.contentHeader}>
              <Text style={font.title}>
                {activeTab === 'therapists' ? 'Gestion des thérapeutes' : activeTab === 'patients' ? 'Tous les patients' : 'Statistiques'}
              </Text>
              <Text style={[font.bodySmall, { marginTop: 2 }]}>Panel d'administration MindIA</Text>
            </View>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              {renderContent()}
            </ScrollView>
          </View>
        </View>

        {/* Create Therapist Modal */}
        <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => setShowCreate(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={font.subtitle}>Nouveau thérapeute</Text>
                <HeaderIconButton icon="close" onPress={() => { setShowCreate(false); setCreateError(null); }} />
              </View>
              <View style={s.modalBody}>
                <TextField label="Nom complet" placeholder="Dr. Jean Dupont" value={newName} onChangeText={setNewName} icon="person-outline" />
                <TextField label="Email" placeholder="jean@cabinet.fr" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
                <TextField label="Mot de passe" placeholder="••••••••" value={newPassword} onChangeText={setNewPassword} secureTextEntry icon="lock-closed-outline" />
                <TextField label="Profession (optionnel)" placeholder="Psychologue, Psychiatre..." value={newProfession} onChangeText={setNewProfession} icon="briefcase-outline" />
                {createError && <Text style={s.createErr}>{createError}</Text>}
              </View>
              <View style={s.modalFooter}>
                <Button title="Annuler" variant="ghost" onPress={() => { setShowCreate(false); setCreateError(null); }} style={{ flex: 1 }} />
                <Button title="Créer" onPress={handleCreateTherapist} loading={creating} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ── Mobile ───────────────────────────────────
  return (
    <>
      <View style={s.mobilePage}>
        {Platform.OS === 'android' && <View style={{ height: layout.safeAreaTop }} />}
        <View style={s.mobileHeader}>
          <View style={{ flex: 1 }}>
            <View style={s.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color={colors.warning} />
              <Text style={[font.caption, { color: colors.warning, fontWeight: '700' }]}>Admin</Text>
            </View>
            <Text style={font.title}>Administration</Text>
          </View>
          <Pressable onPress={handleSignOut} style={s.mobileLogoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={s.mobileTabs}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === activeTab;
            return (
              <Pressable key={item.key} onPress={() => setActiveTab(item.key)} style={[s.mobileTab, active && s.mobileTabActive]}>
                <Ionicons name={active ? item.iconActive : item.icon} size={18} color={active ? colors.primary : colors.textTertiary} />
                <Text style={[s.mobileTabText, active && s.mobileTabTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={s.mobileScroll}>
          {renderContent()}
        </ScrollView>
      </View>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={font.subtitle}>Nouveau thérapeute</Text>
              <HeaderIconButton icon="close" onPress={() => { setShowCreate(false); setCreateError(null); }} />
            </View>
            <ScrollView style={s.modalBody}>
              <View style={{ gap: spacing.lg }}>
                <TextField label="Nom complet" placeholder="Dr. Jean Dupont" value={newName} onChangeText={setNewName} icon="person-outline" />
                <TextField label="Email" placeholder="jean@cabinet.fr" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
                <TextField label="Mot de passe" placeholder="••••••••" value={newPassword} onChangeText={setNewPassword} secureTextEntry icon="lock-closed-outline" />
                <TextField label="Profession (optionnel)" placeholder="Psychologue..." value={newProfession} onChangeText={setNewProfession} icon="briefcase-outline" />
                {createError && <Text style={s.createErr}>{createError}</Text>}
              </View>
            </ScrollView>
            <View style={s.modalFooter}>
              <Button title="Annuler" variant="ghost" onPress={() => { setShowCreate(false); setCreateError(null); }} style={{ flex: 1 }} />
              <Button title="Créer" onPress={handleCreateTherapist} loading={creating} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  tabContent: { gap: spacing.xl },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardList: { gap: spacing.md },

  // Desktop
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgDesktop },
  sidebar: { width: 260, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.borderLight, paddingVertical: spacing['2xl'], justifyContent: 'space-between' },
  sidebarHeader: { paddingHorizontal: spacing['2xl'], marginBottom: spacing['3xl'] },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 36, height: 36 },
  brandTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, alignSelf: 'flex-start' },
  sidebarNav: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg },
  navItemActive: { backgroundColor: colors.primaryLight },
  navLabel: { ...font.bodyMedium, color: colors.textSecondary },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  sidebarFooter: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  mainArea: { flex: 1 },
  contentHeader: { paddingHorizontal: spacing['3xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.bg },
  scroll: { padding: spacing['3xl'], gap: spacing['2xl'] },

  // Mobile
  mobilePage: { flex: 1, backgroundColor: colors.bg },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.pagePadding, paddingTop: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  mobileLogoutBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  mobileTabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: layout.pagePadding, paddingBottom: spacing.md },
  mobileTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.borderLight },
  mobileTabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryMedium },
  mobileTabText: { ...font.caption, fontWeight: '600', color: colors.textTertiary },
  mobileTabTextActive: { color: colors.primary },
  mobileScroll: { paddingHorizontal: layout.pagePadding, paddingBottom: spacing['4xl'] },

  // User cards
  userCard: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userAvatar: { width: 44, height: 44, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moodDot: { width: 8, height: 8, borderRadius: 4 },
  deleteBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  statsStack: { gap: spacing.md },
  statCard: { flex: 1, minWidth: 160, backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', gap: spacing.sm, ...shadows.sm },
  statIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 32, fontWeight: '800', color: colors.text },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'] },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], width: '100%', maxWidth: 480, maxHeight: '90%', ...shadows.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg },
  modalBody: { paddingHorizontal: spacing['2xl'], gap: spacing.lg, paddingBottom: spacing.xl },
  modalFooter: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderLight },
  createErr: { color: colors.error, fontSize: 14, textAlign: 'center' },
});
