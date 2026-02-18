import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, View, TextInput, Modal, Alert, Text,
  Pressable, Platform, FlatList, Dimensions, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

import { Button } from '@/components/ui/button';
import { PageLayout, HeaderIconButton } from '@/components/ui/page-layout';
import { BottomTabBar, type TabItem } from '@/components/ui/bottom-tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportCard } from '@/components/ui/report-card';
import { SectionCard } from '@/components/ui/section-card';
import { QRCodeDisplay } from '@/components/qr-code-display';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { useSession } from '@/lib/session-context';
import { getPatientById } from '@/lib/people';
import { api } from '@/lib/api';
import type { Patient } from '@/lib/types';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

interface Report { _id: string; date: string; content: string; from: 'therapist' | 'ai'; }

// Updated tabs: Apercu instead of QR
const BOTTOM_TABS: TabItem[] = [
  { key: 'overview', label: 'Apercu', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'reports', label: 'Constats', icon: 'document-text-outline', iconActive: 'document-text' },
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { key: 'progress', label: 'Progression', icon: 'trending-up-outline', iconActive: 'trending-up' },
];
const DESKTOP_NAV = [
  { key: 'overview', label: 'Apercu', icon: 'grid-outline' as const, iconActive: 'grid' as const, desc: 'Vue d\'ensemble du patient' },
  { key: 'reports', label: 'Constats', icon: 'document-text-outline' as const, iconActive: 'document-text' as const, desc: 'Observations & syntheses IA' },
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const, desc: 'Echanger avec le patient' },
  { key: 'progress', label: 'Progression', icon: 'trending-up-outline' as const, iconActive: 'trending-up' as const, desc: 'Evolution et statistiques du patient' },
];
const SECTION_DESCS: Record<string, { title: string; desc: string }> = {
  overview: { title: 'Apercu', desc: 'QR code, humeur actuelle, dernier message et informations du patient.' },
  reports: { title: 'Constats & Syntheses', desc: 'Vos observations cliniques et les syntheses automatiques de l\'IA.' },
  discussion: { title: 'Discussion', desc: 'Echangez en direct avec votre patient.' },
  progress: { title: 'Progression', desc: 'Evolution de l\'humeur et statistiques du patient.' },
};

const MOOD_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string }> = {
  '1': { icon: 'happy', label: 'Plutot bien', color: colors.success, bg: colors.successLight },
  '2': { icon: 'sad', label: 'En difficulte', color: colors.warning, bg: colors.warningLight },
  '3': { icon: 'warning', label: 'Crise / Urgence', color: colors.error, bg: colors.errorLight },
};

export default function TherapistPatientDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useSession();
  const isDesktop = useIsDesktop();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientEmail, setPatientEmail] = useState('');
  const [magicToken, setMagicToken] = useState('');
  const [tokenExpiresIn, setTokenExpiresIn] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [actualMood, setActualMood] = useState<string | null>(null);
  const [lastPatientMessage, setLastPatientMessage] = useState<{ text: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [reportsSub, setReportsSub] = useState<'therapist' | 'ai'>('therapist');
  const [generatingAiReport, setGeneratingAiReport] = useState(false);
  const [conversations, setConversations] = useState<{ id: string; createdAt: string; lastMessage?: any }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  // Feature 3: Recommended actions
  const [actions, setActions] = useState<any[]>([]);
  const [showActionForm, setShowActionForm] = useState(false);
  const [newAction, setNewAction] = useState({ title: '', description: '', type: 'custom', url: '' });
  const [savingAction, setSavingAction] = useState(false);

  // Progression tab data
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [crisisEvals, setCrisisEvals] = useState<any[]>([]);

  // Feature 7: Editable therapy info
  const [editingInfo, setEditingInfo] = useState(false);
  const [editTherapyTopic, setEditTherapyTopic] = useState('');
  const [editSessionsDone, setEditSessionsDone] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const patientId = useMemo(() => { const raw = params.patientId; return Array.isArray(raw) ? raw[0] : raw; }, [params.patientId]);

  useEffect(() => {
    if (!patientId || typeof patientId !== 'string') return;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const { user } = await api.users.getById(patientId);
        setPatientEmail(user.email || ''); setActualMood(user.actual_mood || null);
        const { conversations: convs } = await api.conversations.listForUser(patientId);
        if (convs.length > 0) {
          setConversations(convs); setConversationId(convs[0].id);
          const { messages: msgs } = await api.conversations.getMessages(patientId, convs[0].id);
          setMessages(msgs || []);
          const patientMsgs = (msgs || []).filter((m: any) => m.from === 'patient');
          if (patientMsgs.length > 0) { const last = patientMsgs[patientMsgs.length - 1]; setLastPatientMessage({ text: last.text, date: last.createdAt || new Date().toISOString() }); }
        }
        const { magicToken: token, expiresIn } = await api.patient.generateMagicToken(patientId);
        setMagicToken(token || ''); setTokenExpiresIn(expiresIn || '24h');
        const p = await getPatientById(patientId);
        setPatient(p ?? null);
        setEditTherapyTopic(user.therapyTopic || p?.reason || '');
        setEditSessionsDone(String(user.sessionsDone ?? p?.sessionCount ?? 0));
        const { reports: reps } = await api.reports.get(patientId);
        setReports(reps || []);
        try { const { actions: acts } = await api.actions.get(patientId); setActions(acts || []); } catch {}
        try { const { entries } = await api.journal.get(patientId); setJournalEntries(entries || []); } catch {}
        try { const { evaluations } = await api.crisisEval.get(patientId); setCrisisEvals(evaluations || []); } catch {}
      } catch (e) { console.error(e); setError('Impossible de charger les informations du patient.'); }
      finally { setLoading(false); }
    })();
  }, [patientId, session]);

  const handleBack = () => { if (router.canGoBack()) router.back(); else router.replace('/therapist/dashboard'); };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const handleRegenerateQR = async () => { if (!patientId) return; try { const { magicToken: token, expiresIn } = await api.patient.generateMagicToken(patientId); setMagicToken(token || ''); setTokenExpiresIn(expiresIn || '24h'); } catch {} };

  const handleSendChatMessage = async () => {
    if (!patientId || !messageText.trim() || !conversationId) return;
    setSendingMessage(true);
    try { const { messages: updated } = await api.conversations.addMessage(patientId, conversationId, 'therapist', messageText.trim()); setMessages(updated || []); setMessageText(''); setTimeout(() => chatScrollRef.current?.scrollToEnd?.({ animated: true }), 100); }
    catch { Alert.alert('Erreur', "Impossible d'envoyer."); }
    finally { setSendingMessage(false); }
  };

  const handleAddReport = async () => {
    if (!patientId || !reportText.trim()) return;
    setSendingReport(true);
    try { await api.reports.add(patientId, reportText.trim(), 'therapist'); const { reports: updated } = await api.reports.get(patientId); setReports(updated || []); setReportText(''); setShowReportModal(false); }
    catch { Alert.alert('Erreur', "Impossible d'ajouter."); }
    finally { setSendingReport(false); }
  };

  const handleScanReport = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusee'); return; }
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setOcrLoading(true);
      const { text } = await api.ai.ocr({ imageBase64: result.assets[0].base64, mimeType: result.assets[0].mimeType ?? 'image/jpeg' });
      if (!text) { Alert.alert('OCR', 'Aucun texte detecte.'); return; }
      setReportText((c) => (c ? `${c}\n\n${text}` : text));
    } catch { Alert.alert('Erreur', 'Probleme lors du scan.'); }
    finally { setOcrLoading(false); }
  };

  const [aiReportError, setAiReportError] = useState<string | null>(null);
  const [aiReportSuccess, setAiReportSuccess] = useState(false);

  const handleGenerateAiReport = async () => {
    if (!patientId) return;
    setGeneratingAiReport(true);
    setAiReportError(null);
    setAiReportSuccess(false);
    try {
      const { report } = await api.ai.generateReport(patientId);
      setReports((prev) => [report, ...prev]);
      setReportsSub('ai');
      setAiReportSuccess(true);
      setTimeout(() => setAiReportSuccess(false), 4000);
    } catch (e: any) {
      setAiReportError(e?.message || 'Impossible de générer le constat IA');
      setTimeout(() => setAiReportError(null), 5000);
    } finally { setGeneratingAiReport(false); }
  };

  const handleSelectConversation = async (id: string) => {
    if (!patient || id === conversationId) return;
    setConversationId(id);
    try { const { messages: msgs } = await api.conversations.getMessages(patient.id, id); setMessages(msgs || []); } catch { Alert.alert('Erreur', 'Impossible de charger.'); }
  };

  const handleAddAction = async () => {
    if (!patientId || !newAction.title.trim()) return;
    setSavingAction(true);
    try {
      const updated = [...actions, { title: newAction.title.trim(), description: newAction.description.trim(), type: newAction.type, url: newAction.url.trim() || null }];
      await api.actions.set(patientId, updated);
      setActions(updated);
      setNewAction({ title: '', description: '', type: 'custom', url: '' });
      setShowActionForm(false);
    } catch { Alert.alert('Erreur', 'Impossible d\'ajouter.'); }
    finally { setSavingAction(false); }
  };

  const handleDeleteAction = async (index: number) => {
    if (!patientId) return;
    const updated = actions.filter((_, i) => i !== index);
    try { await api.actions.set(patientId, updated); setActions(updated); }
    catch { Alert.alert('Erreur', 'Impossible de supprimer.'); }
  };

  const handleSaveTherapyInfo = async () => {
    if (!patientId) return;
    setSavingInfo(true);
    try {
      await api.users.update(patientId, { therapyTopic: editTherapyTopic.trim(), sessionsDone: parseInt(editSessionsDone) || 0 } as any);
      setEditingInfo(false);
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.'); }
    finally { setSavingInfo(false); }
  };

  const aiReports = reports.filter((r) => r.from === 'ai');
  const therapistReports = reports.filter((r) => r.from === 'therapist');

  if (loading) return <View style={[s.center, { flex: 1, backgroundColor: isDesktop ? colors.bgDesktop : colors.bg }]}><Text style={font.bodySmall}>Chargement...</Text></View>;
  if (error || !patient) return (
    <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}><View style={s.errorCard}><Ionicons name="alert-circle" size={48} color={colors.error} /><Text style={[font.body, { color: colors.error }]}>{error || 'Patient introuvable'}</Text><Button title="Retour" onPress={handleBack} /></View></View>
  );

  const mood = actualMood ? MOOD_MAP[actualMood] : null;
  const sectionDesc = SECTION_DESCS[activeTab] || SECTION_DESCS.overview;

  // ── Apercu (Overview) Tab ──────────────────────────────
  const renderOverview = () => (
    <View style={s.tabContent}>
      {/* Top row: mood + last message side by side on desktop */}
      <View style={isDesktop ? s.overviewGrid : s.overviewStack}>
        {/* Mood card */}
        <View style={[s.overviewCard, isDesktop && { flex: 1 }]}>
          <View style={s.overviewCardHeader}>
            <Ionicons name="heart" size={18} color={mood?.color || colors.textTertiary} />
            <Text style={font.sectionTitle}>Humeur actuelle</Text>
      </View>
          {mood ? (
            <View style={s.moodDisplay}>
              <View style={[s.moodIcon, { backgroundColor: mood.bg }]}>
                <Ionicons name={mood.icon} size={32} color={mood.color} />
        </View>
              <Text style={[font.bodyMedium, { color: mood.color, fontWeight: '700' }]}>{mood.label}</Text>
              <Text style={font.caption}>Dernier etat renseigne</Text>
      </View>
          ) : <Text style={font.caption}>Non renseigne</Text>}
        </View>

        {/* Last message card */}
        <View style={[s.overviewCard, isDesktop && { flex: 1 }]}>
          <View style={s.overviewCardHeader}>
            <Ionicons name="chatbubble" size={18} color={colors.primary} />
            <Text style={font.sectionTitle}>Dernier message</Text>
                  </View>
          {lastPatientMessage ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={font.bodySmall} numberOfLines={3}>{lastPatientMessage.text}</Text>
              <Text style={font.caption}>{fmtDate(lastPatientMessage.date)}</Text>
                    </View>
          ) : <Text style={font.caption}>Aucun message recu</Text>}
          <Pressable onPress={() => setActiveTab('discussion')} style={s.quickAction}>
            <Ionicons name="send" size={14} color={colors.primary} />
            <Text style={[font.bodySmall, { color: colors.primary, fontWeight: '600' }]}>Envoyer un message</Text>
                  </Pressable>
                </View>
                  </View>

      {/* Patient info (editable) */}
      <View style={s.overviewCard}>
        <View style={[s.overviewCardHeader, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="person" size={18} color={colors.primary} />
            <Text style={font.sectionTitle}>Informations patient</Text>
          </View>
          {!editingInfo ? (
            <Pressable onPress={() => setEditingInfo(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryLight }}>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
              <Text style={[font.caption, { color: colors.primary }]}>Modifier</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={s.infoGrid}>
          <View style={s.infoItem}><Ionicons name="mail-outline" size={16} color={colors.textTertiary} /><View><Text style={font.caption}>Email</Text><Text style={font.bodyMedium}>{patientEmail || '--'}</Text></View></View>
          {editingInfo ? (
            <>
              <View style={s.infoItem}><Ionicons name="bookmark-outline" size={16} color={colors.textTertiary} />
                <View style={{ flex: 1 }}><Text style={font.caption}>Sujet de therapie</Text>
                  <TextInput value={editTherapyTopic} onChangeText={setEditTherapyTopic} placeholder="Sujet..." placeholderTextColor={colors.textTertiary} style={[s.editInput]} />
                </View>
              </View>
              <View style={s.infoItem}><Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
                <View style={{ flex: 1 }}><Text style={font.caption}>Nombre de seances</Text>
                  <TextInput value={editSessionsDone} onChangeText={setEditSessionsDone} placeholder="0" placeholderTextColor={colors.textTertiary} keyboardType="numeric" style={[s.editInput]} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button title="Annuler" variant="ghost" size="sm" onPress={() => setEditingInfo(false)} />
                <Button title="Enregistrer" size="sm" onPress={handleSaveTherapyInfo} loading={savingInfo} />
              </View>
            </>
          ) : (
            <>
              <View style={s.infoItem}><Ionicons name="bookmark-outline" size={16} color={colors.textTertiary} /><View><Text style={font.caption}>Sujet</Text><Text style={font.bodyMedium}>{editTherapyTopic || 'Non precise'}</Text></View></View>
              <View style={s.infoItem}><Ionicons name="calendar-outline" size={16} color={colors.textTertiary} /><View><Text style={font.caption}>Seances</Text><Text style={font.bodyMedium}>{editSessionsDone || '--'}</Text></View></View>
            </>
          )}
        </View>
      </View>

      {/* Recommended Actions */}
      <View style={s.overviewCard}>
        <View style={[s.overviewCardHeader, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="bulb" size={18} color={colors.warning} />
            <Text style={font.sectionTitle}>Actions recommandees</Text>
          </View>
          <Pressable onPress={() => setShowActionForm(!showActionForm)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryLight }}>
            <Ionicons name={showActionForm ? 'close' : 'add'} size={14} color={colors.primary} />
            <Text style={[font.caption, { color: colors.primary }]}>{showActionForm ? 'Annuler' : 'Ajouter'}</Text>
          </Pressable>
        </View>

        {showActionForm && (
          <View style={{ gap: spacing.md, padding: spacing.lg, backgroundColor: colors.bgSecondary, borderRadius: radius.lg }}>
            <TextInput placeholder="Titre *" placeholderTextColor={colors.textTertiary} value={newAction.title} onChangeText={(t) => setNewAction(a => ({ ...a, title: t }))} style={s.editInput} />
            <TextInput placeholder="Description" placeholderTextColor={colors.textTertiary} value={newAction.description} onChangeText={(t) => setNewAction(a => ({ ...a, description: t }))} style={s.editInput} multiline />
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {(['exercise', 'contact', 'media', 'custom'] as const).map((t) => (
                <Pressable key={t} onPress={() => setNewAction(a => ({ ...a, type: t }))} style={[s.typeChip, newAction.type === t && s.typeChipActive]}>
                  <Text style={[font.caption, newAction.type === t && { color: colors.textOnPrimary }]}>{t === 'exercise' ? 'Exercice' : t === 'contact' ? 'Contact' : t === 'media' ? 'Media' : 'Autre'}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput placeholder="URL (optionnel)" placeholderTextColor={colors.textTertiary} value={newAction.url} onChangeText={(t) => setNewAction(a => ({ ...a, url: t }))} style={s.editInput} autoCapitalize="none" keyboardType="url" />
            <Button title="Ajouter l'action" size="sm" onPress={handleAddAction} loading={savingAction} disabled={!newAction.title.trim()} />
          </View>
        )}

        {actions.length === 0 && !showActionForm ? (
          <Text style={font.caption}>Aucune action recommandee</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {actions.map((action: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                <Ionicons name={action.type === 'exercise' ? 'fitness' : action.type === 'contact' ? 'call' : action.type === 'media' ? 'musical-notes' : 'bulb'} size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={font.bodyMedium}>{action.title}</Text>
                  {action.description ? <Text style={font.caption}>{action.description}</Text> : null}
                </View>
                <Pressable onPress={() => handleDeleteAction(i)} style={{ padding: spacing.sm }}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* QR Code - compact */}
      <View style={[s.overviewCard, { alignItems: 'center' }]}>
        <View style={s.overviewCardHeader}>
          <Ionicons name="qr-code" size={18} color={colors.primary} />
          <Text style={font.sectionTitle}>QR Code d'acces</Text>
                    </View>
        <View style={s.qrCodeCompact}>
          {magicToken ? <QRCodeDisplay value={magicToken} size={140} backgroundColor="#fff" color="#111827" /> : <Text style={[font.caption, { color: colors.error }]}>Indisponible</Text>}
                  </View>
        <View style={s.qrMeta}>
          <View style={s.qrMetaItem}><Ionicons name="shield-checkmark" size={14} color={colors.primary} /><Text style={font.caption}>Usage unique</Text></View>
          <View style={s.qrMetaItem}><Ionicons name="time" size={14} color={colors.primary} /><Text style={font.caption}>Expire dans {tokenExpiresIn}</Text></View>
                      </View>
        <Button title="Regenerer" variant="soft" icon="refresh" size="sm" onPress={handleRegenerateQR} />
                    </View>
                </View>
  );

  // ── Reports: sticky header (sub-tabs) + scrollable content ──
  const renderReportsStickyHeader = () => (
    <View style={s.reportsStickyHeader}>
      <View style={s.subTabRow}>
        <Pressable onPress={() => setReportsSub('therapist')} style={[s.subTab, reportsSub === 'therapist' && s.subTabActive]}>
          <Ionicons name="person" size={16} color={reportsSub === 'therapist' ? colors.primary : colors.textTertiary} />
          <Text style={[s.subTabText, reportsSub === 'therapist' && s.subTabTextActive]}>Mes constats</Text>
          {therapistReports.length > 0 && <View style={s.subTabBadge}><Text style={s.subTabBadgeText}>{therapistReports.length}</Text></View>}
                          </Pressable>
        <Pressable onPress={() => setReportsSub('ai')} style={[s.subTab, reportsSub === 'ai' && s.subTabActive]}>
          <Ionicons name="sparkles" size={16} color={reportsSub === 'ai' ? colors.ai : colors.textTertiary} />
          <Text style={[s.subTabText, reportsSub === 'ai' && s.subTabTextActive]}>Constats IA</Text>
          {aiReports.length > 0 && <View style={[s.subTabBadge, { backgroundColor: colors.aiLight }]}><Text style={[s.subTabBadgeText, { color: colors.ai }]}>{aiReports.length}</Text></View>}
        </Pressable>
      </View>
      <View style={s.reportsHeaderActions}>
        <View style={s.sectionHint}><Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} /><Text style={[font.caption, { flex: 1 }]}>{reportsSub === 'therapist' ? 'Vos observations cliniques. Visibles par le patient.' : 'Syntheses generees par l\'IA.'}</Text></View>
        {reportsSub === 'therapist' && (
          <Pressable onPress={() => setShowReportModal(true)} style={s.addReportBtn}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={[font.bodySmall, { color: colors.primary, fontWeight: '600' }]}>Ajouter</Text>
          </Pressable>
                      )}
                    </View>
                  </View>
  );

  const renderReports = () => (
    <View style={s.tabContent}>
      {reportsSub === 'therapist' ? (
        therapistReports.length === 0 ? <EmptyState icon="document-text-outline" title="Aucun constat" subtitle="Ajoutez vos observations" /> : <View style={s.cardList}>{therapistReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Button
            title={generatingAiReport ? 'Analyse en cours...' : 'Générer un constat IA'}
            icon="sparkles"
            variant="soft"
            onPress={handleGenerateAiReport}
            loading={generatingAiReport}
            disabled={conversations.length === 0 || generatingAiReport}
          />
          {generatingAiReport && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.aiLight, borderRadius: radius.lg }}>
              <ActivityIndicator size="small" color={colors.ai} />
              <Text style={[font.bodySmall, { color: colors.ai, flex: 1 }]}>L'IA analyse l'ensemble des conversations du patient... Cela peut prendre quelques secondes.</Text>
            </View>
          )}
          {aiReportSuccess && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.successLight, borderRadius: radius.lg }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[font.bodySmall, { color: colors.success }]}>Constat IA genere avec succes</Text>
            </View>
          )}
          {aiReportError && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.errorLight, borderRadius: radius.lg }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[font.bodySmall, { color: colors.error }]}>{aiReportError}</Text>
            </View>
          )}
          {conversations.length === 0 && <Text style={font.caption}>Aucune conversation à analyser</Text>}
          {aiReports.length === 0 && !generatingAiReport ? (
            <EmptyState icon="sparkles-outline" title="Aucun constat IA" subtitle="Générez un constat à partir des discussions du patient" />
          ) : (
            <View style={s.cardList}>{aiReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
          )}
        </View>
      )}
    </View>
  );

  // ── Discussion Tab (Chat-like interface) ───────────────
  const renderDiscussion = () => (
    <View style={s.chatContainer}>
      {/* Conversation selector with mood indicators */}
      {conversations.length > 1 && (
        <View style={s.convSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
            {conversations.map((c: any) => {
              const maxCrisis = c.maxCrisisLevel || 0;
              const moodIcon = maxCrisis >= 3 ? 'alert-circle' : maxCrisis >= 2 ? 'warning' : maxCrisis >= 1 ? 'information-circle' : 'happy';
              const moodColor = maxCrisis >= 3 ? colors.error : maxCrisis >= 2 ? colors.warning : maxCrisis >= 1 ? '#F59E0B' : colors.success;
              const isActive = c.id === conversationId;
              return (
                <Pressable key={c.id} onPress={() => handleSelectConversation(c.id)} style={[s.convChip, isActive && s.convChipActive]}>
                  <Ionicons name={moodIcon as any} size={14} color={isActive ? colors.textOnPrimary : moodColor} />
                  <Text style={[s.convChipText, isActive && s.convChipTextActive]}>
                    {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                  {c.messageCount > 0 && (
                    <Text style={[{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.7)' : colors.textTertiary }]}>
                      ({c.messageCount})
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Messages area */}
      <ScrollView
        ref={chatScrollRef}
        style={s.chatMessages}
        contentContainerStyle={s.chatMessagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd?.({ animated: false })}
      >
        {messages.length === 0 ? (
          <View style={s.chatEmpty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
            <Text style={[font.bodySmall, { textAlign: 'center' }]}>Aucun message dans cette conversation</Text>
                          </View>
        ) : messages.map((msg, i) => {
          const isTherapist = msg.from === 'therapist';
          const isPatientMsg = msg.from === 'patient';
          const isAI = msg.from === 'ai';
          const crisis = msg.crisisLevel;
          const crisisData = crisis === 3 ? { icon: 'alert-circle' as const, color: colors.error, bg: colors.errorLight, label: 'Critique' }
            : crisis === 2 ? { icon: 'warning' as const, color: colors.warning, bg: colors.warningLight, label: 'Modéré' }
            : crisis === 1 ? { icon: 'information-circle' as const, color: '#F59E0B', bg: '#FFFBEB', label: 'Léger' }
            : null;
          return (
            <View key={i} style={[s.chatBubbleRow, isTherapist && s.chatBubbleRowRight]}>
              {!isTherapist && (
                <View style={[s.chatAvatar, { backgroundColor: isPatientMsg ? colors.primaryLight : colors.aiLight }]}>
                  <Ionicons name={isPatientMsg ? 'person' : 'sparkles'} size={14} color={isPatientMsg ? colors.primary : colors.ai} />
                </View>
              )}
              <View style={{ flex: 1, maxWidth: '75%' }}>
                <View style={[s.chatBubble, isTherapist ? s.chatBubbleTherapist : isAI ? s.chatBubbleAI : s.chatBubblePatient]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[s.chatSender, { color: isTherapist ? '#FFFFFF' : isAI ? colors.ai : colors.primary }]}>
                      {isTherapist ? 'Vous' : isAI ? 'IA' : 'Patient'}
                    </Text>
                    {crisisData && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: crisisData.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                        <Ionicons name={crisisData.icon} size={12} color={crisisData.color} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: crisisData.color }}>{crisisData.label}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[font.bodySmall, isTherapist && { color: colors.textOnPrimary }]}>{msg.text}</Text>
                  {crisisData && msg.crisisReason ? (
                    <Text style={{ fontSize: 11, color: crisisData.color, fontStyle: 'italic', marginTop: 2 }}>{msg.crisisReason}</Text>
                  ) : null}
                  <Text style={[s.chatTime, isTherapist && { color: 'rgba(255,255,255,0.7)' }]}>{fmtDate(msg.createdAt || msg.date)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Chat input */}
      <View style={s.chatInputBar}>
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Ecrire un message..."
          placeholderTextColor={colors.textTertiary}
          style={s.chatInput}
          multiline
          onSubmitEditing={handleSendChatMessage}
        />
        <Pressable onPress={handleSendChatMessage} disabled={sendingMessage || !messageText.trim()} style={[s.chatSendBtn, (!messageText.trim()) && { opacity: 0.4 }]}>
          <Ionicons name="send" size={18} color={colors.textOnPrimary} />
        </Pressable>
                  </View>
                </View>
  );

  // ── Progression Tab ────────────────────────────────────
  const PROGRESS_MOODS = [
    { value: 1, label: 'Tres mal', color: colors.error },
    { value: 2, label: 'Mal', color: colors.warning },
    { value: 3, label: 'Moyen', color: colors.textTertiary },
    { value: 4, label: 'Bien', color: colors.success },
    { value: 5, label: 'Tres bien', color: '#F59E0B' },
  ];

  const renderProgress = () => {
    const recentMoods = journalEntries.slice(0, 14).reverse();
    const chartWidth = isDesktop ? 500 : Dimensions.get('window').width - 80;

    return (
      <View style={s.tabContent}>
        {/* Stats */}
        <View style={isDesktop ? { flexDirection: 'row', gap: spacing.xl } : { gap: spacing.xl }}>
          <View style={[s.overviewCard, isDesktop && { flex: 1 }]}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="book" size={28} color={colors.primary} />
              <Text style={font.subtitle}>{journalEntries.length}</Text>
              <Text style={font.caption}>Entrees journal</Text>
            </View>
          </View>
          <View style={[s.overviewCard, isDesktop && { flex: 1 }]}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="chatbubbles" size={28} color={colors.ai} />
              <Text style={font.subtitle}>{conversations.length}</Text>
              <Text style={font.caption}>Conversations</Text>
            </View>
          </View>
          <View style={[s.overviewCard, isDesktop && { flex: 1 }]}>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="document-text" size={28} color={colors.warning} />
              <Text style={font.subtitle}>{reports.length}</Text>
              <Text style={font.caption}>Constats</Text>
            </View>
          </View>
        </View>

        {/* Mood chart */}
        <View style={s.overviewCard}>
          <View style={s.overviewCardHeader}>
            <Ionicons name="analytics" size={18} color={colors.primary} />
            <Text style={font.sectionTitle}>Evolution de l'humeur</Text>
          </View>
          {recentMoods.length < 2 ? (
            <Text style={font.caption}>Pas assez de donnees journal (min. 2 entrees)</Text>
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
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' }}>
                {PROGRESS_MOODS.map((m) => (
                  <View key={m.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 10, color: colors.textTertiary }}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Crisis history */}
        <View style={s.overviewCard}>
          <View style={s.overviewCardHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={font.sectionTitle}>Historique des crises</Text>
          </View>
          {crisisEvals.length === 0 ? (
            <Text style={font.caption}>Aucune evaluation de crise</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {crisisEvals.slice(0, 10).map((ev: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                  <View style={{ width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: ev.level >= 2 ? colors.errorLight : ev.level >= 1 ? colors.warningLight : colors.successLight }}>
                    <Ionicons name={ev.level >= 2 ? 'warning' : ev.level >= 1 ? 'alert-circle' : 'checkmark-circle'} size={18} color={ev.level >= 2 ? colors.error : ev.level >= 1 ? colors.warning : colors.success} />
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
        </View>
      </View>
    );
  };

  const renderContent = () => { switch (activeTab) { case 'overview': return renderOverview(); case 'reports': return renderReports(); case 'discussion': return renderDiscussion(); case 'progress': return renderProgress(); default: return renderOverview(); } };

  // ── Modals ────────────────────────────────────────────
  const renderModals = () => (
    <Modal visible={showReportModal} animationType="fade" transparent onRequestClose={() => setShowReportModal(false)}>
      <View style={s.modalOverlay}><View style={s.modalCard}>
        <View style={s.modalHeader}><Text style={font.subtitle}>Nouveau constat</Text><HeaderIconButton icon="close" onPress={() => setShowReportModal(false)} /></View>
        <ScrollView style={s.modalBody}>
          <TextInput value={reportText} onChangeText={setReportText} placeholder="Ecrivez votre constat..." placeholderTextColor={colors.textTertiary} multiline numberOfLines={8} style={s.modalInput} textAlignVertical="top" />
          <Button title="Scanner une note" icon="camera-outline" variant="secondary" onPress={handleScanReport} loading={ocrLoading} style={{ marginTop: spacing.md }} />
        </ScrollView>
        <View style={s.modalFooter}><Button title="Annuler" variant="ghost" onPress={() => setShowReportModal(false)} style={{ flex: 1 }} /><Button title="Enregistrer" onPress={handleAddReport} loading={sendingReport} disabled={!reportText.trim()} style={{ flex: 1 }} /></View>
      </View></View>
    </Modal>
  );

  // ── Desktop ───────────────────────────────────────────
  if (isDesktop) {
    return (
      <>
        <View style={s.desktopRoot}>
          <View style={s.desktopSidebar}>
            <View style={s.sidebarHeader}>
              <View style={s.sidebarLogoRow}><Image source={require('@/assets/images/logo-mindia.png')} style={s.sidebarLogo} /><Text style={s.sidebarBrandTitle}><Text style={{ color: colors.text }}>Mind</Text><Text style={{ color: colors.primary }}>IA</Text></Text></View>
              <Pressable onPress={handleBack} style={s.backLink}><Ionicons name="arrow-back" size={18} color={colors.textSecondary} /><Text style={[font.bodySmall, { fontWeight: '600' }]}>Retour aux patients</Text></Pressable>
              <Text style={font.subtitle}>{patient.firstName} {patient.lastName}</Text>
              <Text style={font.caption}>{patientEmail}</Text>
                  </View>
            <View style={s.sidebarNavList}>
              {DESKTOP_NAV.map((item) => { const active = item.key === activeTab; return (
                <Pressable key={item.key} onPress={() => setActiveTab(item.key)} style={[s.dNavItem, active && s.dNavItemActive]}>
                  <Ionicons name={active ? item.iconActive : item.icon} size={20} color={active ? colors.primary : colors.textTertiary} />
                  <View style={{ flex: 1 }}><Text style={[s.dNavLabel, active && s.dNavLabelActive]}>{item.label}</Text><Text style={s.dNavDesc}>{item.desc}</Text></View>
                </Pressable>); })}
                        </View>
                      </View>
          <View style={s.desktopMain}>
            <View style={s.desktopContentHeader}><Text style={font.title}>{sectionDesc.title}</Text><Text style={[font.bodySmall, { marginTop: 2 }]}>{sectionDesc.desc}</Text></View>
            {activeTab === 'reports' && renderReportsStickyHeader()}
            {activeTab === 'discussion' ? (
              <View style={{ flex: 1 }}>{renderContent()}</View>
            ) : (
              <ScrollView contentContainerStyle={s.desktopScroll} showsVerticalScrollIndicator={false}>{renderContent()}</ScrollView>
                )}
                  </View>
              </View>
        {renderModals()}
      </>
    );
  }

  // ── Mobile ────────────────────────────────────────────
  return (
    <>
      {activeTab === 'discussion' ? (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.mobileDiscHeader}>
            <Pressable onPress={handleBack} style={s.mobileBackBtn}><Ionicons name="arrow-back" size={20} color={colors.text} /></Pressable>
            <View style={{ flex: 1 }}><Text style={font.bodyMedium}>{patient.firstName} {patient.lastName}</Text><Text style={font.caption}>Discussion</Text></View>
            </View>
          {renderContent()}
          <View style={{ paddingBottom: Platform.OS === 'android' ? spacing.lg : 0 }}>
            <BottomTabBar tabs={BOTTOM_TABS} activeKey={activeTab} onChange={setActiveTab} />
            </View>
          </View>
      ) : (
        <PageLayout
          title={`${patient.firstName} ${patient.lastName}`}
          subtitle={patientEmail}
          headerRight={<HeaderIconButton icon="arrow-back" onPress={handleBack} />}
          stickyContent={
            <View>
              <View style={s.mobileSectionDesc}><Ionicons name="information-circle-outline" size={14} color={colors.primary} /><Text style={[font.caption, { flex: 1, color: colors.primary }]}>{sectionDesc.desc}</Text></View>
              {activeTab === 'reports' && renderReportsStickyHeader()}
            </View>
          }
          bottomContent={<BottomTabBar tabs={BOTTOM_TABS} activeKey={activeTab} onChange={setActiveTab} />}
        >{renderContent()}</PageLayout>
      )}
      {renderModals()}
    </>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], padding: spacing['3xl'], alignItems: 'center', maxWidth: 380, width: '100%', gap: spacing.lg, ...shadows.lg },
  tabContent: { gap: spacing['2xl'] },
  cardList: { gap: spacing.md },

  // Desktop
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgDesktop },
  desktopSidebar: { width: 280, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.borderLight, paddingVertical: spacing['2xl'] },
  sidebarHeader: { paddingHorizontal: spacing['2xl'], marginBottom: spacing['2xl'], gap: spacing.xs },
  sidebarLogoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  sidebarLogo: { width: 36, height: 36 },
  sidebarBrandTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sidebarNavList: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md },
  dNavItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg },
  dNavItemActive: { backgroundColor: colors.primaryLight },
  dNavLabel: { ...font.bodyMedium, color: colors.textSecondary },
  dNavLabelActive: { color: colors.primary, fontWeight: '700' },
  dNavDesc: { ...font.caption, fontSize: 11, marginTop: 1 },
  desktopMain: { flex: 1 },
  desktopContentHeader: { paddingHorizontal: spacing['3xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.bg },
  desktopScroll: { padding: spacing['3xl'], gap: spacing['2xl'] },
  mobileSectionDesc: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.pagePadding, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, marginHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },

  // Overview
  overviewGrid: { flexDirection: 'row', gap: spacing.xl },
  overviewStack: { gap: spacing.xl },
  overviewCard: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderLight, gap: spacing.lg, ...shadows.sm },
  overviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moodDisplay: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  moodIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  infoGrid: { gap: spacing.lg },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignSelf: 'flex-start' },
  qrCodeCompact: { backgroundColor: colors.bg, padding: spacing.lg, borderRadius: radius.xl, ...shadows.sm, borderWidth: 1, borderColor: colors.borderLight },
  qrMeta: { flexDirection: 'row', gap: spacing.xl },
  qrMetaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  // Reports
  reportsStickyHeader: { paddingHorizontal: spacing['3xl'], paddingTop: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: spacing.md },
  reportsHeaderActions: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  addReportBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primaryMedium },
  subTabRow: { flexDirection: 'row', gap: spacing.sm },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderLight },
  subTabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryMedium },
  subTabText: { ...font.bodySmall, fontWeight: '600', color: colors.textTertiary },
  subTabTextActive: { color: colors.primary },
  subTabBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full, minWidth: 22, alignItems: 'center' },
  subTabBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  sectionHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md },

  // Chat interface
  chatContainer: { flex: 1, backgroundColor: colors.bgSecondary },
  convSelector: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.bg },
  convChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  convChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  convChipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  convChipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  chatMessages: { flex: 1 },
  chatMessagesContent: { padding: spacing.lg, gap: spacing.md },
  chatEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
  chatBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  chatBubbleRowRight: { flexDirection: 'row-reverse' },
  chatAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chatBubble: { maxWidth: '75%', borderRadius: radius.xl, padding: spacing.lg, gap: spacing.xs },
  chatBubblePatient: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, borderBottomLeftRadius: radius.xs },
  chatBubbleTherapist: { backgroundColor: colors.primary, borderBottomRightRadius: radius.xs },
  chatBubbleAI: { backgroundColor: colors.aiLight, borderBottomLeftRadius: radius.xs },
  chatSender: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  chatTime: { fontSize: 10, color: colors.textTertiary, alignSelf: 'flex-end' },
  chatInputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.borderLight },
  chatInput: { flex: 1, backgroundColor: colors.bgTertiary, borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, color: colors.text, maxHeight: 100, borderWidth: 1, borderColor: colors.border },
  chatSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  // Mobile discussion header
  mobileDiscHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing['3xl'], paddingBottom: spacing.md, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  mobileBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'] },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], width: '100%', maxWidth: 520, maxHeight: '90%', ...shadows.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg },
  modalBody: { paddingHorizontal: spacing['2xl'], maxHeight: 400 },
  modalInput: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.lg, fontSize: 15, color: colors.text, borderWidth: 1.5, borderColor: colors.border, minHeight: 140 },
  modalFooter: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderLight },

  // Editable info & actions
  editInput: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  typeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
