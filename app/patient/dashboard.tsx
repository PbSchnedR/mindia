import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Pressable, Linking, Text, Alert, Platform, TextInput, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { PageLayout, HeaderIconButton } from '@/components/ui/page-layout';
import { BottomTabBar, type TabItem } from '@/components/ui/bottom-tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportCard } from '@/components/ui/report-card';
import { MoodSelector } from '@/components/ui/mood-selector';
import { SectionCard } from '@/components/ui/section-card';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { useSession } from '@/lib/session-context';
import { api } from '@/lib/api';
import {
  listChatSessionsForPatient, setSeverity, setSummaryAndKeywords,
  simpleAutoSummary, startChatSession,
} from '@/lib/chat';
import { getTherapistById } from '@/lib/people';
import type { Severity } from '@/lib/types';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

// Calendly (web only)
let InlineWidget: any | null = null;
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  InlineWidget = require('react-calendly').InlineWidget;
}

interface Report { _id: string; date: string; content: string; from: 'therapist' | 'ai'; }

const BOTTOM_TABS: TabItem[] = [
  { key: 'bubble', label: 'Bulle', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { key: 'journal', label: 'Journal', icon: 'book-outline', iconActive: 'book' },
  { key: 'reports', label: 'Constats', icon: 'reader-outline', iconActive: 'reader' },
  { key: 'booking', label: 'RDV', icon: 'calendar-outline', iconActive: 'calendar' },
];

const DESKTOP_NAV = [
  { key: 'bubble', label: 'Ma Bulle', icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const, desc: 'Parler à ton assistant IA' },
  { key: 'journal', label: 'Journal', icon: 'book-outline' as const, iconActive: 'book' as const, desc: 'Écrire ton ressenti au quotidien' },
  { key: 'reports', label: 'Constats', icon: 'reader-outline' as const, iconActive: 'reader' as const, desc: 'Observations de ton thérapeute' },
  { key: 'booking', label: 'Rendez-vous', icon: 'calendar-outline' as const, iconActive: 'calendar' as const, desc: 'Prendre RDV en ligne' },
];

export default function PatientDashboardScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const isDesktop = useIsDesktop();
  const hasRedirected = useRef(false);

  const [patientName, setPatientName] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [mood, setMood] = useState<Severity | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [therapistName, setTherapistName] = useState('');
  const [therapistBookingUrl, setTherapistBookingUrl] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('bubble');
  // (no dropdown menu on mobile – direct buttons instead)

  // Journaling
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [newJournalText, setNewJournalText] = useState('');
  const [newJournalMood, setNewJournalMood] = useState(3);
  const [savingJournal, setSavingJournal] = useState(false);

  // Reports sub-tab: 'therapist' or 'ai'
  const [reportsSub, setReportsSub] = useState<'therapist' | 'ai'>('therapist');

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || session.role !== 'patient') {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.replace('/');
      }
      return;
    }
    loadData();
  }, [session, sessionLoading]);

  const loadData = async () => {
    if (!session || session.role !== 'patient') return;
    const patientId = session.patientId;
    setLoading(true);
    setError(null);
    try {
      const { user } = await api.users.getById(patientId);
      setPatientName(user.username || '');

      if (session.therapistId) {
        try {
          const t = await getTherapistById(session.therapistId);
          if (t) {
            setTherapistName(`${t.firstName} ${t.lastName}`.trim());
            if (t.bookingUrl) setTherapistBookingUrl(t.bookingUrl);
          }
        } catch { /* silent */ }
      }

      let moodFromUser: Severity | undefined;
      if (user.actual_mood) {
        const p = parseInt(String(user.actual_mood), 10);
        if (p === 1 || p === 2 || p === 3) { moodFromUser = p as Severity; setMood(moodFromUser); }
      }

      const { reports: reps } = await api.reports.get(patientId);
      setReports(reps || []);

      const { messages } = await api.messages.get(patientId);
      const aiMsgs = messages.filter((m: any) => m.from === 'ai');
      if (aiMsgs.length > 0) setLastSummary(aiMsgs[aiMsgs.length - 1].text);

      try {
        const { entries } = await api.journal.get(patientId);
        setJournalEntries(entries || []);
      } catch { /* silent */ }

      const sessions = await listChatSessionsForPatient(patientId);
      if (sessions.length > 0) {
        setChatSessionId(sessions[0].id);
        if (!moodFromUser) setMood(sessions[0].severity);
      } else {
        const created = await startChatSession(patientId, session.therapistId);
        setChatSessionId(created.id);
        if (!moodFromUser) setMood(created.severity);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.toLowerCase().includes('token')) {
        await handleSignOut();
      } else {
        setError('Impossible de charger tes informations.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleSelectMood = async (value: Severity) => {
    if (!chatSessionId || !session || session.role !== 'patient') return;
    try {
      await api.users.update(session.patientId, { actual_mood: String(value) } as any);
      const updated = await setSeverity(chatSessionId, value);
      setMood(updated.severity);
      const { summary, keywords } = simpleAutoSummary(updated.messages);
      await setSummaryAndKeywords(chatSessionId, summary, keywords);
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
  };

  const handleSaveJournal = async () => {
    if (!session || session.role !== 'patient' || !newJournalText.trim()) return;
    setSavingJournal(true);
    try {
      const { entry } = await api.journal.add(session.patientId, { text: newJournalText.trim(), mood: newJournalMood });
      setJournalEntries((prev) => [entry, ...prev]);
      setNewJournalText('');
      setNewJournalMood(3);
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
    finally { setSavingJournal(false); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Loading / Error states ──────────────────────────────
  if (sessionLoading || loading) {
    return <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}><Text style={font.bodySmall}>Chargement…</Text></View>;
  }
  if (error) {
    return (
      <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}>
        <SectionCard variant="elevated" style={{ maxWidth: 360, alignItems: 'center' as any }}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[font.subtitle, { color: colors.error }]}>Oups !</Text>
          <Text style={[font.bodySmall, { textAlign: 'center' }]}>{error}</Text>
          <Button title="Réessayer" onPress={loadData} />
          <Button title="Déconnexion" variant="ghost" onPress={handleSignOut} />
        </SectionCard>
      </View>
    );
  }

  const therapistReports = reports.filter((r) => r.from === 'therapist');
  const aiReports = reports.filter((r) => r.from === 'ai');

  // ── Section descriptions ────────────────────────────────
  const sectionDescs: Record<string, { title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }> = {
    bubble: { title: 'Ma Bulle', desc: 'Un espace confidentiel pour échanger avec ton assistant IA, disponible 24h/24. Il t\'aide à explorer tes émotions entre les séances.', icon: 'chatbubbles' },
    journal: { title: 'Mon Journal', desc: 'Garde une trace de tes ressentis au quotidien. Cela t\'aide, toi et ton thérapeute, à identifier des tendances.', icon: 'book' },
    reports: { title: 'Constats & Synthèses', desc: 'Retrouve ici les observations de ton thérapeute et les synthèses générées par l\'IA après tes échanges.', icon: 'reader' },
    booking: { title: 'Rendez-vous', desc: 'Réserve un créneau avec ton thérapeute directement en ligne.', icon: 'calendar' },
  };
  const currentSection = sectionDescs[activeTab] || sectionDescs.bubble;

  // ── Header ──────────────────────────────────────────────
  const headerRight = isDesktop ? (
    <Pressable onPress={handleSignOut} style={s.signOutBtn}>
      <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
      <Text style={[font.bodySmall, { fontWeight: '600' }]}>Déconnexion</Text>
    </Pressable>
  ) : (
    <Pressable onPress={handleSignOut} style={s.mobileLogoutBtn}>
      <Ionicons name="log-out-outline" size={20} color={colors.error} />
    </Pressable>
  );

  // ── Tab: Bulle ──────────────────────────────────────────
  const renderBubble = () => (
    <View style={s.tabContent}>
      {/* Hero card */}
      <View style={s.heroCard}>
        <View style={s.heroGlow} />
        <View style={s.heroAvatar}><Text style={{ fontSize: 44 }}>🤖</Text></View>
        <Text style={s.heroTitle}>Assistant IA</Text>
        <Text style={s.heroDesc}>Un espace sûr pour exprimer tes émotions, disponible 24/7</Text>
        <Button title="Entrer dans ma bulle" icon="arrow-forward" onPress={() => router.push('/patient/chat')} size="lg" style={{ width: '100%', maxWidth: 300 }} />
      </View>

      {/* Mood */}
      <MoodSelector value={mood} onChange={handleSelectMood} />

      {/* Quick exercises */}
      <SectionCard title="Exercices rapides" icon="fitness-outline" variant="elevated">
        <Text style={font.bodySmall}>Des exercices simples pour t'apaiser en quelques minutes.</Text>
        {[
          { icon: 'fitness' as const, title: 'Respiration profonde', desc: 'Inspire 4s, retiens 4s, expire 6s', color: colors.primary },
          { icon: 'walk' as const, title: 'Marche de 5 min', desc: "Sors prendre l'air", color: colors.success },
          { icon: 'call' as const, title: 'Contacter un proche', desc: 'Parler peut aider', color: colors.warning },
        ].map((ex, i) => (
          <View key={i} style={s.exerciseRow}>
            <View style={[s.exerciseIcon, { backgroundColor: ex.color + '14' }]}>
              <Ionicons name={ex.icon} size={20} color={ex.color} />
            </View>
            <View style={{ flex: 1 }}><Text style={font.bodyMedium}>{ex.title}</Text><Text style={font.caption}>{ex.desc}</Text></View>
          </View>
        ))}
      </SectionCard>

      {/* Booking shortcut */}
      {therapistBookingUrl && (
        <SectionCard title="Prochain RDV" icon="calendar-outline" variant="elevated">
          <Text style={font.bodySmall}>Planifie une séance avec {therapistName || 'ton thérapeute'}.</Text>
          <Button title="Voir les créneaux" icon="calendar-outline" variant="soft" size="sm" onPress={() => setActiveTab('booking')} />
        </SectionCard>
      )}
    </View>
  );

  // ── Tab: Journal ────────────────────────────────────────
  const MOOD_LABELS = ['', 'Très mal', 'Mal', 'Moyen', 'Bien', 'Très bien'];
  const MOOD_EMOJI = ['', '😢', '😕', '😐', '🙂', '😄'];
  const renderJournal = () => (
    <View style={s.tabContent}>
      <SectionCard title="Nouvelle entrée" icon="create-outline" variant="elevated">
        <TextInput
          placeholder="Comment te sens-tu aujourd'hui ?"
          placeholderTextColor={colors.textTertiary}
          multiline numberOfLines={4} value={newJournalText} onChangeText={setNewJournalText}
          style={s.journalInput} textAlignVertical="top"
        />
        <View style={s.moodChipRow}>
          <Text style={font.label}>Humeur :</Text>
          {[1, 2, 3, 4, 5].map((v) => (
            <Pressable key={v} onPress={() => setNewJournalMood(v)} style={[s.moodChip, newJournalMood === v && s.moodChipActive]}>
              <Text style={{ fontSize: 16 }}>{MOOD_EMOJI[v]}</Text>
              <Text style={[s.moodChipLabel, newJournalMood === v && { color: colors.textOnPrimary }]}>{MOOD_LABELS[v]}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Enregistrer" icon="checkmark" onPress={handleSaveJournal} loading={savingJournal} disabled={!newJournalText.trim()} size="sm" />
      </SectionCard>

      {journalEntries.length === 0 ? (
        <EmptyState icon="book-outline" title="Aucune entrée" subtitle="Commence à écrire ton journal pour garder une trace de tes ressentis" />
      ) : (
        <View style={s.cardList}>
          {journalEntries.map((entry: any) => (
            <SectionCard key={entry._id} variant="elevated" style={{ gap: spacing.sm }}>
              <View style={s.journalEntryHeader}>
                <View style={s.journalMoodBadge}>
                  <Text style={{ fontSize: 16 }}>{MOOD_EMOJI[entry.mood || 3]}</Text>
                  <Text style={font.caption}>{MOOD_LABELS[entry.mood || 3]}</Text>
                </View>
                <Text style={font.caption}>{fmtDate(entry.date)}</Text>
              </View>
              <Text style={font.bodySmall}>{entry.text}</Text>
            </SectionCard>
          ))}
        </View>
      )}
    </View>
  );

  // ── Tab: Reports (SEPARATED) ────────────────────────────
  const renderReports = () => (
    <View style={s.tabContent}>
      {/* Sub-tabs: Thérapeute / IA */}
      <View style={s.subTabRow}>
        <Pressable onPress={() => setReportsSub('therapist')} style={[s.subTab, reportsSub === 'therapist' && s.subTabActive]}>
          <Ionicons name="person" size={16} color={reportsSub === 'therapist' ? colors.primary : colors.textTertiary} />
          <Text style={[s.subTabText, reportsSub === 'therapist' && s.subTabTextActive]}>Constats du thérapeute</Text>
          {therapistReports.length > 0 && <View style={s.subTabBadge}><Text style={s.subTabBadgeText}>{therapistReports.length}</Text></View>}
        </Pressable>
        <Pressable onPress={() => setReportsSub('ai')} style={[s.subTab, reportsSub === 'ai' && s.subTabActive]}>
          <Ionicons name="sparkles" size={16} color={reportsSub === 'ai' ? colors.ai : colors.textTertiary} />
          <Text style={[s.subTabText, reportsSub === 'ai' && s.subTabTextActive]}>Synthèses IA</Text>
          {aiReports.length > 0 && <View style={[s.subTabBadge, { backgroundColor: colors.aiLight }]}><Text style={[s.subTabBadgeText, { color: colors.ai }]}>{aiReports.length}</Text></View>}
        </Pressable>
      </View>

      {/* Description */}
      <View style={s.sectionHint}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
        <Text style={[font.caption, { flex: 1 }]}>
          {reportsSub === 'therapist'
            ? 'Observations rédigées par ton thérapeute après vos séances. Elles t\'aident à suivre ta progression.'
            : 'Synthèses automatiques générées par l\'IA à partir de tes échanges dans la bulle. Elles ne remplacent pas l\'avis de ton thérapeute.'}
        </Text>
      </View>

      {/* Content */}
      {reportsSub === 'therapist' ? (
        therapistReports.length === 0 ? (
          <EmptyState icon="document-text-outline" title="Aucun constat" subtitle="Ton thérapeute notera ses observations après vos séances" />
        ) : (
          <View style={s.cardList}>{therapistReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
        )
      ) : (
        <>
          {lastSummary && (
            <SectionCard icon="sparkles" iconColor={colors.ai} variant="elevated">
              <Text style={[font.label, { color: colors.ai }]}>Dernière synthèse</Text>
              <Text style={font.bodySmall}>{lastSummary}</Text>
            </SectionCard>
          )}
          {aiReports.length === 0 && !lastSummary ? (
            <EmptyState icon="sparkles-outline" title="Aucune synthèse IA" subtitle="L'IA créera une synthèse après tes échanges dans la bulle" />
          ) : (
            <View style={s.cardList}>{aiReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
          )}
        </>
      )}
    </View>
  );

  // ── Tab: Booking ────────────────────────────────────────
  const renderBooking = () => (
    <View style={s.tabContent}>
      {therapistBookingUrl ? (
        <>
          <SectionCard variant="highlight" icon="calendar" iconColor={colors.primary}>
            <Text style={font.subtitle}>Prendre rendez-vous avec {therapistName || 'ton thérapeute'}</Text>
            <Text style={font.bodySmall}>Choisis le créneau qui te convient le mieux.</Text>
          </SectionCard>
          {Platform.OS === 'web' && InlineWidget ? (
            <View style={s.calendlyWrap}><InlineWidget url={therapistBookingUrl} styles={{ height: '650px' }} /></View>
          ) : (
            <SectionCard variant="dark">
              <Text style={[font.body, { color: colors.textOnDark }]}>Calendrier en ligne</Text>
              <Text style={[font.bodySmall, { color: colors.textTertiary }]}>Tu seras redirigé(e) vers la page de réservation.</Text>
              <Button title="Ouvrir Calendly" icon="calendar-outline" onPress={() => Linking.openURL(therapistBookingUrl)} />
            </SectionCard>
          )}
        </>
      ) : (
        <EmptyState icon="time-outline" title="Bientôt disponible" subtitle="Ton thérapeute n'a pas encore configuré la réservation en ligne." />
      )}
    </View>
  );

  // ── Render ──────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'bubble': return renderBubble();
      case 'journal': return renderJournal();
      case 'reports': return renderReports();
      case 'booking': return renderBooking();
      default: return renderBubble();
    }
  };

  if (isDesktop) {
    return (
      <View style={s.desktopRoot}>
        {/* Sidebar */}
        <View style={s.desktopSidebar}>
          <View style={s.sidebarHeader}>
            <View style={s.sidebarLogoRow}>
              <Image source={require('@/assets/images/logo-mindia.png')} style={s.sidebarLogo} />
              <Text style={s.sidebarTitle}>
                <Text style={{ color: colors.text }}>Mind</Text>
                <Text style={{ color: colors.primary }}>IA</Text>
              </Text>
            </View>
            <Text style={[font.caption, { marginTop: spacing.sm }]}>Bonjour {patientName || 'toi'} 👋</Text>
          </View>

          <View style={s.sidebarNav}>
            {DESKTOP_NAV.map((item) => {
              const active = item.key === activeTab;
              return (
                <Pressable key={item.key} onPress={() => setActiveTab(item.key)} style={[s.navItem, active && s.navItemActive]}>
                  <Ionicons name={active ? item.iconActive : item.icon} size={20} color={active ? colors.primary : colors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
                    <Text style={s.navDesc}>{item.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
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
          <View style={s.desktopContentHeader}>
            <View>
              <Text style={font.title}>{currentSection.title}</Text>
              <Text style={[font.bodySmall, { marginTop: 2, maxWidth: 600 }]}>{currentSection.desc}</Text>
            </View>
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
      title={currentSection.title}
      subtitle={`Bonjour ${patientName || 'toi'} 👋`}
      headerRight={headerRight}
      stickyContent={
        <View style={s.mobileDesc}>
          <Ionicons name={currentSection.icon} size={16} color={colors.primary} />
          <Text style={[font.caption, { flex: 1 }]}>{currentSection.desc}</Text>
        </View>
      }
      bottomContent={<BottomTabBar tabs={BOTTOM_TABS} activeKey={activeTab} onChange={setActiveTab} />}
    >
      {renderContent()}
    </PageLayout>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.bgSecondary },
  mobileLogoutBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  tabContent: { gap: spacing['2xl'] },
  cardList: { gap: spacing.md },

  // Desktop layout
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgDesktop },
  desktopSidebar: { width: 280, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.borderLight, paddingVertical: spacing['2xl'], justifyContent: 'space-between' },
  sidebarHeader: { paddingHorizontal: spacing['2xl'], marginBottom: spacing['2xl'] },
  sidebarLogoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sidebarLogo: { width: 36, height: 36 },
  sidebarTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sidebarNav: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md },
  navItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg },
  navItemActive: { backgroundColor: colors.primaryLight },
  navLabel: { ...font.bodyMedium, color: colors.textSecondary },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  navDesc: { ...font.caption, fontSize: 11, marginTop: 1 },
  sidebarFooter: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight },
  sidebarSignOut: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  desktopMain: { flex: 1 },
  desktopContentHeader: { paddingHorizontal: spacing['3xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.bg },
  desktopScroll: { padding: spacing['3xl'], gap: spacing['2xl'] },

  // Mobile description
  mobileDesc: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.pagePadding, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, marginHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },

  // Hero
  heroCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], padding: spacing['3xl'], alignItems: 'center', gap: spacing.lg, borderWidth: 1, borderColor: colors.primaryMedium, overflow: 'hidden', ...shadows.lg },
  heroGlow: { position: 'absolute', top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.primaryLight, opacity: 0.6 },
  heroAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { ...font.subtitle },
  heroDesc: { ...font.bodySmall, textAlign: 'center', maxWidth: 280 },

  // Exercises
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  exerciseIcon: { width: 44, height: 44, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },

  // Journal
  journalInput: { backgroundColor: colors.bgTertiary, borderRadius: radius.md, padding: spacing.lg, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 100 },
  moodChipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radius.full, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.border },
  moodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodChipLabel: { ...font.caption, color: colors.textSecondary },
  journalEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  journalMoodBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  // Reports sub-tabs
  subTabRow: { flexDirection: 'row', gap: spacing.sm },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderLight },
  subTabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryMedium },
  subTabText: { ...font.bodySmall, fontWeight: '600', color: colors.textTertiary },
  subTabTextActive: { color: colors.primary },
  subTabBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full, minWidth: 22, alignItems: 'center' },
  subTabBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  sectionHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md },

  // Calendly
  calendlyWrap: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.bg, ...shadows.md },
});
