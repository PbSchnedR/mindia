import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, View, TextInput, Modal, Alert, Text,
  Pressable, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

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

const BOTTOM_TABS: TabItem[] = [
  { key: 'qr', label: 'QR Code', icon: 'qr-code-outline', iconActive: 'qr-code' },
  { key: 'reports', label: 'Constats', icon: 'document-text-outline', iconActive: 'document-text' },
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];

const DESKTOP_NAV = [
  { key: 'qr', label: 'QR Code', icon: 'qr-code-outline' as const, iconActive: 'qr-code' as const, desc: 'Code d\'accès patient' },
  { key: 'reports', label: 'Constats', icon: 'document-text-outline' as const, iconActive: 'document-text' as const, desc: 'Observations & synthèses IA' },
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const, desc: 'Échanges avec le patient' },
];

const SECTION_DESCS: Record<string, { title: string; desc: string }> = {
  qr: { title: 'QR Code d\'accès', desc: 'Générez un QR code unique pour que le patient puisse accéder à son espace sécurisé via l\'application mobile.' },
  reports: { title: 'Constats & Synthèses', desc: 'Vos observations cliniques et les synthèses automatiques de l\'IA. Les deux sont séparés pour plus de clarté.' },
  discussion: { title: 'Discussion', desc: 'Consultez l\'état émotionnel du patient, ses messages, et envoyez-lui des communications directement.' },
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
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('qr');
  const [reportsSub, setReportsSub] = useState<'therapist' | 'ai'>('therapist');
  const [conversations, setConversations] = useState<{ id: string; createdAt: string; lastMessage?: any }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const patientId = useMemo(() => { const raw = params.patientId; return Array.isArray(raw) ? raw[0] : raw; }, [params.patientId]);

  useEffect(() => {
    if (!patientId || typeof patientId !== 'string') return;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const { user } = await api.users.getById(patientId);
        setPatientEmail(user.email || '');
        setActualMood(user.actual_mood || null);

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
        const { reports: reps } = await api.reports.get(patientId);
        setReports(reps || []);
      } catch (e) { console.error(e); setError('Impossible de charger les informations du patient.'); }
      finally { setLoading(false); }
    })();
  }, [patientId, session]);

  const handleBack = () => { if (router.canGoBack()) router.back(); else router.replace('/therapist/dashboard'); };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleRegenerateQR = async () => {
    if (!patientId) return;
    try { const { magicToken: token, expiresIn } = await api.patient.generateMagicToken(patientId); setMagicToken(token || ''); setTokenExpiresIn(expiresIn || '24h'); }
    catch (e) { console.error(e); }
  };

  const handleSendMessage = async () => {
    if (!patientId || !messageText.trim() || !conversationId) return;
    setSendingMessage(true);
    try { const { messages: updated } = await api.conversations.addMessage(patientId, conversationId, 'therapist', messageText.trim()); setMessages(updated || []); setMessageText(''); setShowMessageModal(false); }
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
      if (status !== 'granted') { Alert.alert('Permission refusée'); return; }
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setOcrLoading(true);
      const { text } = await api.ai.ocr({ imageBase64: result.assets[0].base64, mimeType: result.assets[0].mimeType ?? 'image/jpeg' });
      if (!text) { Alert.alert('OCR', 'Aucun texte détecté.'); return; }
      setReportText((c) => (c ? `${c}\n\n${text}` : text));
    } catch { Alert.alert('Erreur', 'Problème lors du scan.'); }
    finally { setOcrLoading(false); }
  };

  const handleSelectConversation = async (id: string) => {
    if (!patient || id === conversationId) return;
    setConversationId(id);
    try { const { messages: msgs } = await api.conversations.getMessages(patient.id, id); setMessages(msgs || []); }
    catch { Alert.alert('Erreur', 'Impossible de charger.'); }
  };

  const aiReports = reports.filter((r) => r.from === 'ai');
  const therapistReports = reports.filter((r) => r.from === 'therapist');

  if (loading) return <View style={[s.center, { flex: 1, backgroundColor: isDesktop ? colors.bgDesktop : colors.bg }]}><Text style={font.bodySmall}>Chargement…</Text></View>;
  if (error || !patient) {
    return (
      <View style={[s.center, { flex: 1, backgroundColor: colors.bg }]}>
        <View style={s.errorCard}><Ionicons name="alert-circle" size={48} color={colors.error} /><Text style={[font.body, { color: colors.error }]}>{error || 'Patient introuvable'}</Text><Button title="Retour" onPress={handleBack} /></View>
      </View>
    );
  }

  const moodMap: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    '1': { emoji: '😊', label: 'Plutôt bien', color: colors.success, bg: colors.successLight },
    '2': { emoji: '😟', label: 'En difficulté', color: colors.warning, bg: colors.warningLight },
    '3': { emoji: '😰', label: 'Crise / Urgence', color: colors.error, bg: colors.errorLight },
  };
  const mood = actualMood ? moodMap[actualMood] : null;
  const sectionDesc = SECTION_DESCS[activeTab] || SECTION_DESCS.qr;

  // ── QR Tab ────────────────────────────────────────────
  const renderQR = () => (
    <View style={[s.tabContent, { maxWidth: 500, alignSelf: isDesktop ? 'center' as any : undefined }]}>
      <SectionCard variant="elevated" style={{ alignItems: 'center' as any }}>
        <View style={s.qrCodeWrap}>
          {magicToken ? <QRCodeDisplay value={magicToken} size={200} backgroundColor="#fff" color="#111827" />
            : <Text style={[font.bodySmall, { color: colors.error }]}>Impossible de générer le QR code</Text>}
        </View>
        <View style={s.qrInfo}>
          <View style={s.qrRow}><View style={s.qrRowIcon}><Ionicons name="shield-checkmark" size={16} color={colors.primary} /></View><Text style={font.bodyMedium}>Code à usage unique</Text></View>
          <View style={s.qrRow}><View style={s.qrRowIcon}><Ionicons name="time" size={16} color={colors.primary} /></View><Text style={font.bodyMedium}>Expire dans {tokenExpiresIn}</Text></View>
        </View>
        <Text style={[font.bodySmall, { textAlign: 'center' }]}>Le patient scanne ce QR code avec l'app mobile pour accéder à sa bulle.</Text>
        <Button title="Régénérer" variant="soft" icon="refresh" onPress={handleRegenerateQR} />
      </SectionCard>
    </View>
  );

  // ── Reports Tab (SEPARATED) ───────────────────────────
  const renderReports = () => (
    <View style={s.tabContent}>
      {/* Sub-tabs */}
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

      {/* Description */}
      <View style={s.sectionHint}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
        <Text style={[font.caption, { flex: 1 }]}>
          {reportsSub === 'therapist'
            ? 'Vos observations cliniques rédigées après les séances. Elles sont visibles par le patient.'
            : 'Synthèses générées automatiquement par l\'IA à partir des échanges du patient dans la bulle. Elles vous aident à préparer vos séances.'}
        </Text>
      </View>

      {/* Actions */}
      {reportsSub === 'therapist' && (
        <Button title="Ajouter un constat" icon="add" variant="soft" onPress={() => setShowReportModal(true)} />
      )}

      {/* Content */}
      {reportsSub === 'therapist' ? (
        therapistReports.length === 0 ? (
          <EmptyState icon="document-text-outline" title="Aucun constat" subtitle="Ajoutez vos observations après vos séances avec ce patient" />
        ) : (
          <View style={s.cardList}>{therapistReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
        )
      ) : (
        aiReports.length === 0 ? (
          <EmptyState icon="sparkles-outline" title="Aucun constat IA" subtitle="L'IA créera des synthèses après les échanges du patient dans la bulle" />
        ) : (
          <View style={s.cardList}>{aiReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
        )
      )}
    </View>
  );

  // ── Discussion Tab ────────────────────────────────────
  const renderDiscussion = () => (
    <View style={s.tabContent}>
      {/* Mood */}
      <SectionCard title="État émotionnel actuel" icon="heart-outline" iconColor={mood?.color || colors.textTertiary} variant="elevated">
        {mood ? (
          <View style={s.moodRow}>
            <View style={[s.moodAvatar, { backgroundColor: mood.bg }]}><Text style={{ fontSize: 32 }}>{mood.emoji}</Text></View>
            <View><Text style={[font.bodyMedium, { fontWeight: '700', color: mood.color }]}>{mood.label}</Text><Text style={font.caption}>Dernier état renseigné par le patient</Text></View>
          </View>
        ) : <Text style={font.caption}>Le patient n'a pas encore renseigné son humeur</Text>}
      </SectionCard>

      {/* Last message */}
      {lastPatientMessage && (
        <SectionCard variant="highlight" icon="chatbubble" iconColor={colors.primary}>
          <Text style={font.label}>Dernier message du patient</Text>
          <Text style={font.bodySmall}>{lastPatientMessage.text}</Text>
          <Text style={font.caption}>{fmtDate(lastPatientMessage.date)}</Text>
        </SectionCard>
      )}

      <Button title="Envoyer un message au patient" icon="send" variant="soft" onPress={() => setShowMessageModal(true)} />

      {/* Conversations */}
      <View>
        <Text style={font.sectionTitle}>Conversations</Text>
        <Text style={[font.caption, { marginBottom: spacing.md }]}>Sélectionnez une conversation pour voir l'historique des échanges</Text>
        <View style={s.chipWrap}>
          {conversations.length === 0 ? <Text style={font.caption}>Aucune conversation.</Text>
            : conversations.map((c) => (
              <Pressable key={c.id} onPress={() => handleSelectConversation(c.id)} style={[s.chip, c.id === conversationId && s.chipActive]}>
                <Text style={[s.chipText, c.id === conversationId && s.chipTextActive]}>
                  {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Text>
              </Pressable>
            ))}
        </View>
      </View>

      {/* Messages */}
      <View>
        <Text style={font.sectionTitle}>Historique des messages</Text>
        {messages.length === 0 ? <EmptyState icon="chatbubbles-outline" title="Aucun message" subtitle="Les échanges du patient apparaîtront ici" />
          : <View style={s.cardList}>
            {messages.map((msg, i) => {
              const isTherapist = msg.from === 'therapist';
              const isPatientMsg = msg.from === 'patient';
              const badgeColor = isPatientMsg ? colors.primary : isTherapist ? colors.success : colors.ai;
              const badgeBg = isPatientMsg ? colors.primaryLight : isTherapist ? colors.successLight : colors.aiLight;
              return (
                <View key={i} style={[s.msgCard, isTherapist && { borderColor: colors.primaryMedium }]}>
                  <View style={s.msgHeader}>
                    <View style={[s.msgBadge, { backgroundColor: badgeBg }]}>
                      <Ionicons name={isPatientMsg ? 'person' : isTherapist ? 'medkit' : 'sparkles'} size={12} color={badgeColor} />
                      <Text style={[font.caption, { color: badgeColor, fontWeight: '600' }]}>{isPatientMsg ? 'Patient' : isTherapist ? 'Vous' : 'IA'}</Text>
                    </View>
                    <Text style={font.caption}>{fmtDate(msg.createdAt || msg.date)}</Text>
                  </View>
                  <Text style={font.bodySmall}>{msg.text}</Text>
                </View>
              );
            })}
          </View>}
      </View>
    </View>
  );

  const renderContent = () => { switch (activeTab) { case 'qr': return renderQR(); case 'reports': return renderReports(); case 'discussion': return renderDiscussion(); default: return renderQR(); } };

  // ── Modals ─────────────────────────────────────────────
  const renderModals = () => (
    <>
      <Modal visible={showReportModal} animationType="fade" transparent onRequestClose={() => setShowReportModal(false)}>
        <View style={s.modalOverlay}><View style={s.modalCard}>
          <View style={s.modalHeader}><Text style={font.subtitle}>Nouveau constat</Text><HeaderIconButton icon="close" onPress={() => setShowReportModal(false)} /></View>
          <ScrollView style={s.modalBody}>
            <TextInput value={reportText} onChangeText={setReportText} placeholder="Écrivez votre constat…" placeholderTextColor={colors.textTertiary} multiline numberOfLines={8} style={s.modalInput} textAlignVertical="top" />
            <Button title="Scanner une note" icon="camera-outline" variant="secondary" onPress={handleScanReport} loading={ocrLoading} style={{ marginTop: spacing.md }} />
          </ScrollView>
          <View style={s.modalFooter}><Button title="Annuler" variant="ghost" onPress={() => setShowReportModal(false)} style={{ flex: 1 }} /><Button title="Enregistrer" onPress={handleAddReport} loading={sendingReport} disabled={!reportText.trim()} style={{ flex: 1 }} /></View>
        </View></View>
      </Modal>
      <Modal visible={showMessageModal} animationType="fade" transparent onRequestClose={() => setShowMessageModal(false)}>
        <View style={s.modalOverlay}><View style={s.modalCard}>
          <View style={s.modalHeader}><Text style={font.subtitle}>Message au patient</Text><HeaderIconButton icon="close" onPress={() => setShowMessageModal(false)} /></View>
          <ScrollView style={s.modalBody}>
            <TextInput value={messageText} onChangeText={setMessageText} placeholder="Écrivez votre message…" placeholderTextColor={colors.textTertiary} multiline numberOfLines={6} style={s.modalInput} textAlignVertical="top" />
          </ScrollView>
          <View style={s.modalFooter}><Button title="Annuler" variant="ghost" onPress={() => setShowMessageModal(false)} style={{ flex: 1 }} /><Button title="Envoyer" onPress={handleSendMessage} loading={sendingMessage} disabled={!messageText.trim()} style={{ flex: 1 }} /></View>
        </View></View>
      </Modal>
    </>
  );

  // ── Desktop layout with sidebar ─────────────────────────
  if (isDesktop) {
    return (
      <>
        <View style={s.desktopRoot}>
          <View style={s.desktopSidebar}>
            <View style={s.sidebarHeader}>
              <View style={s.sidebarLogoRow}>
                <Image source={require('@/assets/images/logo-mindia.png')} style={s.sidebarLogo} />
                <Text style={s.sidebarBrandTitle}><Text style={{ color: colors.text }}>Mind</Text><Text style={{ color: colors.primary }}>IA</Text></Text>
              </View>
              <Pressable onPress={handleBack} style={s.backLink}><Ionicons name="arrow-back" size={18} color={colors.textSecondary} /><Text style={[font.bodySmall, { fontWeight: '600' }]}>Retour aux patients</Text></Pressable>
              <Text style={font.subtitle}>{patient.firstName} {patient.lastName}</Text>
              <Text style={font.caption}>{patientEmail}</Text>
            </View>
            <View style={s.sidebarNavList}>
              {DESKTOP_NAV.map((item) => {
                const active = item.key === activeTab;
                return (
                  <Pressable key={item.key} onPress={() => setActiveTab(item.key)} style={[s.dNavItem, active && s.dNavItemActive]}>
                    <Ionicons name={active ? item.iconActive : item.icon} size={20} color={active ? colors.primary : colors.textTertiary} />
                    <View style={{ flex: 1 }}><Text style={[s.dNavLabel, active && s.dNavLabelActive]}>{item.label}</Text><Text style={s.dNavDesc}>{item.desc}</Text></View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={s.desktopMain}>
            <View style={s.desktopContentHeader}>
              <Text style={font.title}>{sectionDesc.title}</Text>
              <Text style={[font.bodySmall, { marginTop: 2, maxWidth: 600 }]}>{sectionDesc.desc}</Text>
            </View>
            <ScrollView contentContainerStyle={s.desktopScroll} showsVerticalScrollIndicator={false}>{renderContent()}</ScrollView>
          </View>
        </View>

        {renderModals()}
      </>
    );
  }

  // ── Mobile layout ───────────────────────────────────────
  return (
    <>
      <PageLayout
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={patientEmail}
        headerRight={<HeaderIconButton icon="arrow-back" onPress={handleBack} />}
        stickyContent={
          <View style={s.mobileSectionDesc}>
            <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
            <Text style={[font.caption, { flex: 1, color: colors.primary }]}>{sectionDesc.desc}</Text>
          </View>
        }
        bottomContent={<BottomTabBar tabs={BOTTOM_TABS} activeKey={activeTab} onChange={setActiveTab} />}
      >
        {renderContent()}
      </PageLayout>
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

  // Mobile section desc
  mobileSectionDesc: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.pagePadding, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, marginHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },

  // QR
  qrCodeWrap: { backgroundColor: colors.bg, padding: spacing['2xl'], borderRadius: radius['2xl'], ...shadows.md, borderWidth: 1, borderColor: colors.borderLight },
  qrInfo: { gap: spacing.md, width: '100%' },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qrRowIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

  // Reports sub-tabs
  subTabRow: { flexDirection: 'row', gap: spacing.sm },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgSecondary, borderWidth: 1.5, borderColor: colors.borderLight },
  subTabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryMedium },
  subTabText: { ...font.bodySmall, fontWeight: '600', color: colors.textTertiary },
  subTabTextActive: { color: colors.primary },
  subTabBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full, minWidth: 22, alignItems: 'center' },
  subTabBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  sectionHint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.md },

  // Discussion
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  moodAvatar: { width: 56, height: 56, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  chipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
  msgCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'] },
  modalCard: { backgroundColor: colors.bg, borderRadius: radius['2xl'], width: '100%', maxWidth: 520, maxHeight: '90%', ...shadows.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], paddingBottom: spacing.lg },
  modalBody: { paddingHorizontal: spacing['2xl'], maxHeight: 400 },
  modalInput: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.lg, fontSize: 15, color: colors.text, borderWidth: 1.5, borderColor: colors.border, minHeight: 140 },
  modalFooter: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.borderLight },
});
