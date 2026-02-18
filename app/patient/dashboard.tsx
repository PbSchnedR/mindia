import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Pressable, Linking, Text, Alert, Platform, TextInput, ScrollView, Animated, Modal, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

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

let InlineWidget: any | null = null;
if (Platform.OS === 'web') { InlineWidget = require('react-calendly').InlineWidget; }

interface Report { _id: string; date: string; content: string; from: 'therapist' | 'ai'; }

const BOTTOM_TABS: TabItem[] = [
  { key: 'bubble', label: 'Bulle', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { key: 'journal', label: 'Journal', icon: 'book-outline', iconActive: 'book' },
  { key: 'reports', label: 'Constats', icon: 'reader-outline', iconActive: 'reader' },
  { key: 'booking', label: 'RDV', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'progress', label: 'Progression', icon: 'trending-up-outline', iconActive: 'trending-up' },
];
const DESKTOP_NAV = [
  { key: 'bubble', label: 'Ma Bulle', icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const, desc: 'Parler a ton assistant IA' },
  { key: 'journal', label: 'Journal', icon: 'book-outline' as const, iconActive: 'book' as const, desc: 'Ecrire ton ressenti au quotidien' },
  { key: 'reports', label: 'Constats', icon: 'reader-outline' as const, iconActive: 'reader' as const, desc: 'Observations de ton therapeute' },
  { key: 'booking', label: 'Rendez-vous', icon: 'calendar-outline' as const, iconActive: 'calendar' as const, desc: 'Prendre RDV en ligne' },
  { key: 'progress', label: 'Progression', icon: 'trending-up-outline' as const, iconActive: 'trending-up' as const, desc: 'Suivre ton evolution' },
];

const JOURNAL_MOODS: { value: number; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { value: 1, icon: 'thunderstorm-outline', label: 'Tres mal', color: colors.error },
  { value: 2, icon: 'rainy-outline', label: 'Mal', color: colors.warning },
  { value: 3, icon: 'cloudy-outline', label: 'Moyen', color: colors.textTertiary },
  { value: 4, icon: 'partly-sunny-outline', label: 'Bien', color: colors.success },
  { value: 5, icon: 'sunny-outline', label: 'Tres bien', color: '#F59E0B' },
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
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [newJournalText, setNewJournalText] = useState('');
  const [newJournalMood, setNewJournalMood] = useState(3);
  const [savingJournal, setSavingJournal] = useState(false);
  const [reportsSub, setReportsSub] = useState<'therapist' | 'ai'>('therapist');
  const [crisisEvals, setCrisisEvals] = useState<any[]>([]);
  const [recommendedActions, setRecommendedActions] = useState<any[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showMoodReminder, setShowMoodReminder] = useState(false);
  const [reminderMood, setReminderMood] = useState(3);
  const [reminderText, setReminderText] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [conversationsCount, setConversationsCount] = useState(0);

  // Bubble animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || session.role !== 'patient') { if (!hasRedirected.current) { hasRedirected.current = true; router.replace('/'); } return; }
    loadData();
  }, [session, sessionLoading]);

  const loadData = async () => {
    if (!session || session.role !== 'patient') return;
    const patientId = session.patientId;
    setLoading(true); setError(null);
    try {
      const { user } = await api.users.getById(patientId);
      setPatientName(user.username || '');
      if (session.therapistId) { try { const t = await getTherapistById(session.therapistId); if (t) { setTherapistName(`${t.firstName} ${t.lastName}`.trim()); if (t.bookingUrl) setTherapistBookingUrl(t.bookingUrl); } } catch {} }
      let moodFromUser: Severity | undefined;
      if (user.actual_mood) { const p = parseInt(String(user.actual_mood), 10); if (p === 1 || p === 2 || p === 3) { moodFromUser = p as Severity; setMood(moodFromUser); } }
      const { reports: reps } = await api.reports.get(patientId);
      setReports(reps || []);
      const { messages } = await api.messages.get(patientId);
      const aiMsgs = messages.filter((m: any) => m.from === 'ai');
      if (aiMsgs.length > 0) setLastSummary(aiMsgs[aiMsgs.length - 1].text);
      try {
        const { entries } = await api.journal.get(patientId);
        setJournalEntries(entries || []);
        // Vérifier si le patient a rempli son journal aujourd'hui
        const today = new Date().toDateString();
        const hasEntryToday = (entries || []).some((e: any) => new Date(e.date).toDateString() === today);
        if (!hasEntryToday && (entries || []).length > 0) {
          // Ne montrer le rappel que si le patient a déjà utilisé le journal au moins une fois
          setShowMoodReminder(true);
        }
      } catch {}
      try { const { evaluations } = await api.crisisEval.get(patientId); setCrisisEvals(evaluations || []); } catch {}
      try { const { actions } = await api.actions.get(patientId); setRecommendedActions(actions || []); } catch {}
      try { const { conversations } = await api.conversations.listForUser(patientId); setConversationsCount(conversations?.length || 0); } catch {}
      if (!user.dataConsent?.accepted) setShowConsentModal(true);
      const sessions = await listChatSessionsForPatient(patientId);
      if (sessions.length > 0) { setChatSessionId(sessions[0].id); if (!moodFromUser) setMood(sessions[0].severity); }
      else { const created = await startChatSession(patientId, session.therapistId); setChatSessionId(created.id); if (!moodFromUser) setMood(created.severity); }
    } catch (err: any) { if (err?.status === 401 || err?.message?.toLowerCase().includes('token')) await handleSignOut(); else setError('Impossible de charger tes informations.'); }
    finally { setLoading(false); }
  };

  const handleSignOut = async () => { await signOut(); router.replace('/'); };
  const handleSelectMood = async (value: Severity) => {
    if (!chatSessionId || !session || session.role !== 'patient') return;
    try { await api.users.update(session.patientId, { actual_mood: String(value) } as any); const updated = await setSeverity(chatSessionId, value); setMood(updated.severity); const { summary, keywords } = simpleAutoSummary(updated.messages); await setSummaryAndKeywords(chatSessionId, summary, keywords); }
    catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
  };
  const handleSaveJournal = async () => {
    if (!session || session.role !== 'patient' || !newJournalText.trim()) return;
    setSavingJournal(true);
    try { const { entry } = await api.journal.add(session.patientId, { text: newJournalText.trim(), mood: newJournalMood }); setJournalEntries((prev) => [entry, ...prev]); setNewJournalText(''); setNewJournalMood(3); }
    catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
    finally { setSavingJournal(false); }
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleAcceptConsent = async () => {
    if (!session || session.role !== 'patient') return;
    try { await api.consent.accept(session.patientId); setShowConsentModal(false); }
    catch { Alert.alert('Erreur', 'Impossible d\'enregistrer le consentement.'); }
  };

  if (sessionLoading || loading) return <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}><Text style={font.bodySmall}>Chargement...</Text></View>;
  if (error) return (
    <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}>
      <SectionCard variant="elevated" style={{ maxWidth: 360, alignItems: 'center' as any }}><Ionicons name="alert-circle" size={48} color={colors.error} /><Text style={[font.subtitle, { color: colors.error }]}>Oups !</Text><Text style={[font.bodySmall, { textAlign: 'center' }]}>{error}</Text><Button title="Reessayer" onPress={loadData} /><Button title="Deconnexion" variant="ghost" onPress={handleSignOut} /></SectionCard>
    </View>
  );

  const therapistReports = reports.filter((r) => r.from === 'therapist');
  const aiReports = reports.filter((r) => r.from === 'ai');
  const sectionDescs: Record<string, { title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }> = {
    bubble: { title: 'Ma Bulle', desc: 'Un espace confidentiel pour echanger avec ton assistant IA, disponible 24h/24.', icon: 'chatbubbles' },
    journal: { title: 'Mon Journal', desc: 'Garde une trace de tes ressentis au quotidien.', icon: 'book' },
    reports: { title: 'Constats', desc: 'Observations de ton therapeute et syntheses IA.', icon: 'reader' },
    booking: { title: 'Rendez-vous', desc: 'Reserve un creneau avec ton therapeute.', icon: 'calendar' },
    progress: { title: 'Progression', desc: 'Suis ton evolution au fil du temps.', icon: 'trending-up' },
  };
  const currentSection = sectionDescs[activeTab] || sectionDescs.bubble;

  const headerRight = isDesktop ? (
    <Pressable onPress={handleSignOut} style={s.signOutBtn}><Ionicons name="log-out-outline" size={18} color={colors.textSecondary} /><Text style={[font.bodySmall, { fontWeight: '600' }]}>Deconnexion</Text></Pressable>
  ) : (
    <Pressable onPress={handleSignOut} style={s.mobileLogoutBtn}><Ionicons name="log-out-outline" size={20} color={colors.error} /></Pressable>
  );

  // ── Bulle (innovative bubble design) ──────────────────
  const renderBubble = () => (
    <View style={s.tabContent}>
      {/* Floating bubble */}
      <Pressable onPress={() => router.push('/patient/chat')} style={s.bubbleHero}>
        <View style={s.bubbleOuter}>
          <View style={s.bubbleDecor1} />
          <View style={s.bubbleDecor2} />
          <View style={s.bubbleDecor3} />
          <Animated.View style={[s.bubbleCenter, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="sparkles" size={40} color={colors.textOnPrimary} />
          </Animated.View>
        </View>
        <Text style={s.bubbleTitle}>Entrer dans ma bulle</Text>
        <Text style={s.bubbleDesc}>Ton assistant IA, confidentiel et disponible 24/7</Text>
        <View style={s.bubbleCta}>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          <Text style={[font.bodyMedium, { color: colors.primary }]}>Commencer une discussion</Text>
        </View>
      </Pressable>

      <MoodSelector value={mood} onChange={handleSelectMood} />

      {/* Exercises + RDV side by side on desktop */}
      <View style={isDesktop ? s.twoColRow : s.colStack}>
        <SectionCard title="Exercices rapides" icon="fitness-outline" variant="elevated" style={isDesktop ? { flex: 1 } : undefined}>
          <Text style={font.bodySmall}>Des exercices simples pour t'apaiser.</Text>
          {[
            { icon: 'fitness' as const, title: 'Respiration profonde', desc: 'Inspire 4s, retiens 4s, expire 6s', color: colors.primary },
            { icon: 'walk' as const, title: 'Marche de 5 min', desc: "Sors prendre l'air", color: colors.success },
            { icon: 'call' as const, title: 'Contacter un proche', desc: 'Parler peut aider', color: colors.warning },
          ].map((ex, i) => (
            <View key={i} style={s.exerciseRow}>
              <View style={[s.exerciseIcon, { backgroundColor: ex.color + '14' }]}><Ionicons name={ex.icon} size={20} color={ex.color} /></View>
              <View style={{ flex: 1 }}><Text style={font.bodyMedium}>{ex.title}</Text><Text style={font.caption}>{ex.desc}</Text></View>
            </View>
          ))}
        </SectionCard>
        {therapistBookingUrl && (
          <SectionCard title="Prochain RDV" icon="calendar-outline" variant="elevated" style={isDesktop ? { flex: 1 } : undefined}>
            <Ionicons name="calendar" size={36} color={colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={[font.bodySmall, { textAlign: 'center' }]}>Planifie ta prochaine seance avec {therapistName || 'ton therapeute'}.</Text>
            <Button title="Voir les creneaux" icon="calendar-outline" variant="soft" size="sm" onPress={() => setActiveTab('booking')} />
          </SectionCard>
        )}
      </View>

      {/* Recommended actions from therapist */}
      {recommendedActions.length > 0 && (
        <SectionCard title="Actions recommandees par ton therapeute" icon="bulb-outline" variant="elevated">
          {recommendedActions.map((action: any, i: number) => (
            <Pressable key={i} onPress={() => action.url ? Linking.openURL(action.url) : undefined} style={s.exerciseRow}>
              <View style={[s.exerciseIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={action.type === 'exercise' ? 'fitness' : action.type === 'contact' ? 'call' : action.type === 'media' ? 'musical-notes' : 'bulb'} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={font.bodyMedium}>{action.title}</Text>
                {action.description ? <Text style={font.caption}>{action.description}</Text> : null}
              </View>
              {action.url && <Ionicons name="open-outline" size={16} color={colors.textTertiary} />}
            </Pressable>
          ))}
        </SectionCard>
      )}
    </View>
  );

  // ── Journal (redesigned - timeline + compact form) ────
  const renderJournal = () => (
    <View style={s.tabContent}>
      <View style={isDesktop ? s.journalDesktop : undefined}>
        {/* Form */}
        <View style={[s.journalForm, isDesktop && { flex: 1 }]}>
          <Text style={font.sectionTitle}>Nouvelle entree</Text>
          <TextInput
            placeholder="Comment te sens-tu aujourd'hui ?"
            placeholderTextColor={colors.textTertiary}
            multiline value={newJournalText} onChangeText={setNewJournalText}
            style={s.journalInput} textAlignVertical="top"
          />
          <View style={s.moodChipRow}>
            {JOURNAL_MOODS.map((m) => (
              <Pressable key={m.value} onPress={() => setNewJournalMood(m.value)} style={[s.moodChip, newJournalMood === m.value && { backgroundColor: m.color, borderColor: m.color }]}>
                <Ionicons name={m.icon} size={16} color={newJournalMood === m.value ? '#fff' : m.color} />
                <Text style={[s.moodChipLabel, newJournalMood === m.value && { color: '#fff' }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="Enregistrer" icon="checkmark" onPress={handleSaveJournal} loading={savingJournal} disabled={!newJournalText.trim()} size="sm" />
        </View>

        {/* Timeline */}
        <View style={[s.journalTimeline, isDesktop && { flex: 1 }]}>
          <Text style={font.sectionTitle}>Historique</Text>
          {journalEntries.length === 0 ? (
            <EmptyState icon="book-outline" title="Aucune entree" subtitle="Ecris ton premier ressenti" />
          ) : (
            <View style={s.timelineList}>
              {journalEntries.map((entry: any, idx: number) => {
                const m = JOURNAL_MOODS.find((jm) => jm.value === (entry.mood || 3)) || JOURNAL_MOODS[2];
                return (
                  <View key={entry._id || idx} style={s.timelineItem}>
                    <View style={s.timelineLeft}>
                      <View style={[s.timelineDot, { backgroundColor: m.color }]}><Ionicons name={m.icon} size={14} color="#fff" /></View>
                      {idx < journalEntries.length - 1 && <View style={s.timelineLine} />}
                    </View>
                    <View style={s.timelineContent}>
                      <View style={s.timelineHeader}>
                        <Text style={[font.caption, { color: m.color, fontWeight: '600' }]}>{m.label}</Text>
                        <Text style={font.caption}>{fmtDate(entry.date)}</Text>
                      </View>
                      <Text style={font.bodySmall} numberOfLines={4}>{entry.text}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // ── Reports ───────────────────────────────────────────
  const renderReportsStickyHeader = () => (
    <View style={s.reportsStickyHeader}>
      <View style={s.subTabRow}>
        <Pressable onPress={() => setReportsSub('therapist')} style={[s.subTab, reportsSub === 'therapist' && s.subTabActive]}>
          <Ionicons name="person" size={16} color={reportsSub === 'therapist' ? colors.primary : colors.textTertiary} />
          <Text style={[s.subTabText, reportsSub === 'therapist' && s.subTabTextActive]}>Constats therapeute</Text>
          {therapistReports.length > 0 && <View style={s.subTabBadge}><Text style={s.subTabBadgeText}>{therapistReports.length}</Text></View>}
        </Pressable>
        <Pressable onPress={() => setReportsSub('ai')} style={[s.subTab, reportsSub === 'ai' && s.subTabActive]}>
          <Ionicons name="sparkles" size={16} color={reportsSub === 'ai' ? colors.ai : colors.textTertiary} />
          <Text style={[s.subTabText, reportsSub === 'ai' && s.subTabTextActive]}>Syntheses IA</Text>
          {aiReports.length > 0 && <View style={[s.subTabBadge, { backgroundColor: colors.aiLight }]}><Text style={[s.subTabBadgeText, { color: colors.ai }]}>{aiReports.length}</Text></View>}
        </Pressable>
      </View>
      <View style={s.sectionHint}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
        <Text style={[font.caption, { flex: 1 }]}>{reportsSub === 'therapist' ? 'Observations redigees par ton therapeute.' : 'Syntheses generees automatiquement par l\'IA.'}</Text>
      </View>
    </View>
  );

  const renderReports = () => (
    <View style={s.tabContent}>
      {reportsSub === 'therapist' ? (
        therapistReports.length === 0 ? (
          <EmptyState icon="document-text-outline" title="Aucun constat" subtitle="Apres vos seances" />
        ) : (
          <View style={s.cardList}>
            {therapistReports.map((r) => (
              <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />
            ))}
          </View>
        )
      ) : (
        <>
          {aiReports.length === 0 ? (
            <EmptyState icon="sparkles-outline" title="Aucun constat IA" subtitle="Ton thérapeute peut en générer à partir de tes discussions" />
          ) : (
            <View style={s.cardList}>
              {aiReports.map((r) => (
                <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );

  // ── Booking ───────────────────────────────────────────
  const renderBooking = () => (
    <View style={s.tabContent}>
      {therapistBookingUrl ? (
        <>
          <SectionCard variant="highlight" icon="calendar" iconColor={colors.primary}>
            <Text style={font.subtitle}>Prendre rendez-vous avec {therapistName || 'ton therapeute'}</Text>
            <Text style={font.bodySmall}>Choisis le creneau qui te convient le mieux.</Text>
          </SectionCard>
          {Platform.OS === 'web' && InlineWidget ? <View style={s.calendlyWrap}><InlineWidget url={therapistBookingUrl} styles={{ height: '650px' }} /></View>
            : <SectionCard variant="dark"><Text style={[font.body, { color: colors.textOnDark }]}>Calendrier en ligne</Text><Button title="Ouvrir Calendly" icon="calendar-outline" onPress={() => Linking.openURL(therapistBookingUrl)} /></SectionCard>}
        </>
      ) : <EmptyState icon="time-outline" title="Bientot disponible" subtitle="Pas encore configure par ton therapeute." />}
    </View>
  );

  // ── Progression ────────────────────────────────────────
  const renderProgress = () => {
    const recentMoods = journalEntries.slice(0, 14).reverse();
    const chartWidth = isDesktop ? 500 : Dimensions.get('window').width - 80;

    return (
      <View style={s.tabContent}>
        {/* Stats */}
        <View style={isDesktop ? s.twoColRow : s.colStack}>
          <SectionCard variant="elevated" style={isDesktop ? { flex: 1 } : undefined}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="book" size={28} color={colors.primary} />
              <Text style={font.subtitle}>{journalEntries.length}</Text>
              <Text style={font.caption}>Entrees journal</Text>
            </View>
          </SectionCard>
          <SectionCard variant="elevated" style={isDesktop ? { flex: 1 } : undefined}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="chatbubbles" size={28} color={colors.ai} />
              <Text style={font.subtitle}>{conversationsCount}</Text>
              <Text style={font.caption}>Conversations</Text>
            </View>
          </SectionCard>
        </View>

        {/* Mood chart with LineChart */}
        <SectionCard title="Evolution de l'humeur" icon="analytics-outline" variant="elevated">
          {recentMoods.length < 2 ? (
            <Text style={font.caption}>Pas assez de donnees (min. 2 entrees journal)</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              <LineChart
                data={{
                  labels: recentMoods.map((e: any) => {
                    const d = new Date(e.date);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }),
                  datasets: [{
                    data: recentMoods.map((e: any) => e.mood || 3),
                    color: () => colors.primary,
                    strokeWidth: 2.5,
                  }],
                }}
                width={chartWidth}
                height={200}
                yAxisSuffix=""
                yAxisInterval={1}
                fromZero={false}
                segments={4}
                chartConfig={{
                  backgroundColor: colors.bg,
                  backgroundGradientFrom: colors.bg,
                  backgroundGradientTo: colors.bg,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                  labelColor: () => colors.textTertiary,
                  propsForDots: {
                    r: '5',
                    strokeWidth: '2',
                    stroke: colors.primaryDark,
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: '4 4',
                    stroke: colors.borderLight,
                  },
                  style: { borderRadius: radius.lg },
                }}
                bezier
                style={{ borderRadius: radius.lg, marginLeft: -spacing.lg }}
                withInnerLines
                withOuterLines={false}
                yLabelsOffset={8}
                xLabelsOffset={-4}
              />
              <View style={s.moodLegend}>
                {JOURNAL_MOODS.map((m) => (
                  <View key={m.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </SectionCard>

        {/* Crisis evaluations history */}
        <SectionCard title="Evaluations de crise" icon="alert-circle-outline" variant="elevated">
          {crisisEvals.length === 0 ? (
            <Text style={font.caption}>Aucune evaluation</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {crisisEvals.slice(0, 10).map((ev: any, i: number) => (
                <View key={i} style={s.exerciseRow}>
                  <View style={[s.exerciseIcon, { backgroundColor: ev.level >= 2 ? colors.errorLight : ev.level >= 1 ? colors.warningLight : colors.successLight }]}>
                    <Ionicons name={ev.level >= 2 ? 'warning' : ev.level >= 1 ? 'alert-circle' : 'checkmark-circle'} size={20} color={ev.level >= 2 ? colors.error : ev.level >= 1 ? colors.warning : colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={font.bodyMedium}>Niveau {ev.level}/3{ev.flagged ? ' — Signale' : ''}</Text>
                    {ev.summary ? <Text style={font.caption} numberOfLines={2}>{ev.summary}</Text> : null}
                    <Text style={font.caption}>{fmtDate(ev.date)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      </View>
    );
  };

  const renderContent = () => { switch (activeTab) { case 'bubble': return renderBubble(); case 'journal': return renderJournal(); case 'reports': return renderReports(); case 'booking': return renderBooking(); case 'progress': return renderProgress(); default: return renderBubble(); } };

  const handleSaveMoodReminder = async () => {
    if (!session || session.role !== 'patient') return;
    setSavingReminder(true);
    try {
      const { entry } = await api.journal.add(session.patientId, { text: reminderText.trim() || 'Rappel quotidien', mood: reminderMood });
      setJournalEntries((prev) => [entry, ...prev]);
      setShowMoodReminder(false);
      setReminderText('');
      setReminderMood(3);
    } catch {}
    finally { setSavingReminder(false); }
  };

  const moodReminderModal = (
    <Modal visible={showMoodReminder && !showConsentModal} animationType="fade" transparent onRequestClose={() => setShowMoodReminder(false)}>
      <View style={s.consentOverlay}>
        <View style={[s.consentCard, { gap: spacing.lg }]}>
          <Ionicons name="sunny-outline" size={48} color={colors.warning} style={{ alignSelf: 'center' }} />
          <Text style={[font.subtitle, { textAlign: 'center' }]}>Comment tu te sens aujourd'hui ?</Text>
          <Text style={[font.bodySmall, { textAlign: 'center' }]}>Prends un moment pour noter ton humeur. Ca aide a suivre ta progression.</Text>
          <View style={s.moodChipRow}>
            {JOURNAL_MOODS.map((m) => (
              <Pressable key={m.value} onPress={() => setReminderMood(m.value)} style={[s.moodChip, reminderMood === m.value && { backgroundColor: m.color, borderColor: m.color }]}>
                <Ionicons name={m.icon} size={16} color={reminderMood === m.value ? '#fff' : m.color} />
                <Text style={[s.moodChipLabel, reminderMood === m.value && { color: '#fff' }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            placeholder="Un mot sur ta journee ? (optionnel)"
            placeholderTextColor={colors.textTertiary}
            value={reminderText}
            onChangeText={setReminderText}
            multiline
            style={s.journalInput}
            textAlignVertical="top"
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Plus tard" variant="ghost" onPress={() => setShowMoodReminder(false)} style={{ flex: 1 }} />
            <Button title="Enregistrer" icon="checkmark" onPress={handleSaveMoodReminder} loading={savingReminder} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );

  const consentModal = (
    <Modal visible={showConsentModal} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={s.consentOverlay}>
        <View style={s.consentCard}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
          <Text style={[font.subtitle, { textAlign: 'center' }]}>Protection de tes donnees</Text>
          <Text style={[font.bodySmall, { textAlign: 'center' }]}>Pour utiliser MindIA, tu dois accepter que tes donnees soient traitees de maniere securisee et confidentielle, conformement au RGPD.</Text>
          <Button title="J'accepte" icon="checkmark" onPress={handleAcceptConsent} />
        </View>
      </View>
    </Modal>
  );

  if (isDesktop) {
    return (
      <>{consentModal}{moodReminderModal}<View style={s.desktopRoot}>
        <View style={s.desktopSidebar}>
          <View style={s.sidebarHeader}>
            <View style={s.sidebarLogoRow}><Image source={require('@/assets/images/logo-mindia.png')} style={s.sidebarLogo} /><Text style={s.sidebarTitle}><Text style={{ color: colors.text }}>Mind</Text><Text style={{ color: colors.primary }}>IA</Text></Text></View>
            <Text style={[font.caption, { marginTop: spacing.sm }]}>Bonjour {patientName || 'toi'}</Text>
          </View>
          <View style={s.sidebarNav}>
            {DESKTOP_NAV.map((item) => { const active = item.key === activeTab; return (
              <Pressable key={item.key} onPress={() => setActiveTab(item.key)} style={[s.navItem, active && s.navItemActive]}>
                <Ionicons name={active ? item.iconActive : item.icon} size={20} color={active ? colors.primary : colors.textTertiary} />
                <View style={{ flex: 1 }}><Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text><Text style={s.navDesc}>{item.desc}</Text></View>
              </Pressable>); })}
          </View>
          <View style={s.sidebarFooter}><Pressable onPress={handleSignOut} style={s.sidebarSignOut}><Ionicons name="log-out-outline" size={18} color={colors.error} /><Text style={[font.bodySmall, { color: colors.error, fontWeight: '600' }]}>Deconnexion</Text></Pressable></View>
        </View>
        <View style={s.desktopMain}>
          <View style={s.desktopContentHeader}><Text style={font.title}>{currentSection.title}</Text><Text style={[font.bodySmall, { marginTop: 2 }]}>{currentSection.desc}</Text></View>
          {activeTab === 'reports' && renderReportsStickyHeader()}
          <ScrollView contentContainerStyle={s.desktopScroll} showsVerticalScrollIndicator={false}>{renderContent()}</ScrollView>
        </View>
      </View></>
    );
  }

  return (
    <>
      {consentModal}
      {moodReminderModal}
      <PageLayout
        title={currentSection.title}
        subtitle={`Bonjour ${patientName || 'toi'}`}
        headerRight={headerRight}
        stickyContent={(
          <View>
            <View style={s.mobileDesc}>
              <Ionicons name={currentSection.icon} size={16} color={colors.primary} />
              <Text style={[font.caption, { flex: 1 }]}>{currentSection.desc}</Text>
            </View>
            {activeTab === 'reports' && renderReportsStickyHeader()}
          </View>
        )}
        bottomContent={<BottomTabBar tabs={BOTTOM_TABS} activeKey={activeTab} onChange={setActiveTab} />}
      >
        {renderContent()}
      </PageLayout>
    </>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.bgSecondary },
  mobileLogoutBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  tabContent: { gap: spacing['2xl'] },
  cardList: { gap: spacing.md },

  // Desktop
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
  mobileDesc: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.pagePadding, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, marginHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },

  // Bubble hero (innovative organic design)
  bubbleHero: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing['3xl'] },
  bubbleOuter: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  bubbleCenter: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.glow },
  bubbleDecor1: { position: 'absolute', top: 0, left: 10, width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primaryLight, opacity: 0.6 },
  bubbleDecor2: { position: 'absolute', bottom: 10, right: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryMedium, opacity: 0.5 },
  bubbleDecor3: { position: 'absolute', top: 30, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.aiLight, opacity: 0.7 },
  bubbleTitle: { ...font.subtitle, textAlign: 'center' },
  bubbleDesc: { ...font.bodySmall, textAlign: 'center', maxWidth: 280 },
  bubbleCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.full, backgroundColor: colors.primaryLight },

  // Two-col
  twoColRow: { flexDirection: 'row', gap: spacing.xl },
  colStack: { gap: spacing.xl },

  // Exercises
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  exerciseIcon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },

  // Journal
  journalDesktop: { flexDirection: 'row', gap: spacing['2xl'] },
  journalForm: { gap: spacing.lg },
  journalInput: { backgroundColor: colors.bgTertiary, borderRadius: radius.md, padding: spacing.lg, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 90 },
  moodChipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.border },
  moodChipLabel: { ...font.caption, color: colors.textSecondary },
  journalTimeline: { gap: spacing.lg },
  timelineList: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: spacing.md },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.borderLight, marginVertical: spacing.xs },
  timelineContent: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderLight, marginBottom: spacing.md, gap: spacing.xs },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Reports
  reportsStickyHeader: { paddingHorizontal: layout.pagePadding, paddingTop: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bg, gap: spacing.sm },
  subTabRow: { flexDirection: 'row', gap: spacing.sm },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderLight },
  subTabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryMedium },
  subTabText: { ...font.bodySmall, fontWeight: '600', color: colors.textTertiary },
  subTabTextActive: { color: colors.primary },
  subTabBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full, minWidth: 22, alignItems: 'center' },
  subTabBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  sectionHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md },
  calendlyWrap: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.bg, ...shadows.md },

  // Mood chart
  moodChart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 100, paddingTop: spacing.lg },
  moodBarCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  moodBar: { width: '100%', maxWidth: 24, borderRadius: radius.sm, minHeight: 4 },
  moodLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },

  // Consent modal
  consentOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'] },
  consentCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], padding: spacing['3xl'], maxWidth: 420, width: '100%', gap: spacing.xl, ...shadows.lg },
});
