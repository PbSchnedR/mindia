import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView, StyleSheet, View, TextInput, Modal, Alert, Text,
  Pressable, Platform, FlatList,
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

// Updated tabs: Apercu instead of QR
const BOTTOM_TABS: TabItem[] = [
  { key: 'overview', label: 'Apercu', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'reports', label: 'Constats', icon: 'document-text-outline', iconActive: 'document-text' },
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];
const DESKTOP_NAV = [
  { key: 'overview', label: 'Apercu', icon: 'grid-outline' as const, iconActive: 'grid' as const, desc: 'Vue d\'ensemble du patient' },
  { key: 'reports', label: 'Constats', icon: 'document-text-outline' as const, iconActive: 'document-text' as const, desc: 'Observations & syntheses IA' },
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const, desc: 'Echanger avec le patient' },
];
const SECTION_DESCS: Record<string, { title: string; desc: string }> = {
  overview: { title: 'Apercu', desc: 'QR code, humeur actuelle, dernier message et informations du patient.' },
  reports: { title: 'Constats & Syntheses', desc: 'Vos observations cliniques et les syntheses automatiques de l\'IA.' },
  discussion: { title: 'Discussion', desc: 'Echangez en direct avec votre patient.' },
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
  const [conversations, setConversations] = useState<{ id: string; createdAt: string; lastMessage?: any }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

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
        const { reports: reps } = await api.reports.get(patientId);
        setReports(reps || []);
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

  const handleSelectConversation = async (id: string) => {
    if (!patient || id === conversationId) return;
    setConversationId(id);
    try { const { messages: msgs } = await api.conversations.getMessages(patient.id, id); setMessages(msgs || []); } catch { Alert.alert('Erreur', 'Impossible de charger.'); }
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

      {/* Patient info */}
      <View style={s.overviewCard}>
        <View style={s.overviewCardHeader}>
          <Ionicons name="person" size={18} color={colors.primary} />
          <Text style={font.sectionTitle}>Informations patient</Text>
                      </View>
        <View style={s.infoGrid}>
          <View style={s.infoItem}><Ionicons name="mail-outline" size={16} color={colors.textTertiary} /><View><Text style={font.caption}>Email</Text><Text style={font.bodyMedium}>{patientEmail || '--'}</Text></View></View>
          <View style={s.infoItem}><Ionicons name="bookmark-outline" size={16} color={colors.textTertiary} /><View><Text style={font.caption}>Sujet</Text><Text style={font.bodyMedium}>{patient.reason || 'Non precise'}</Text></View></View>
          <View style={s.infoItem}><Ionicons name="calendar-outline" size={16} color={colors.textTertiary} /><View><Text style={font.caption}>Seances</Text><Text style={font.bodyMedium}>{patient.sessionCount ?? '--'}</Text></View></View>
                            </View>
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
        aiReports.length === 0 ? <EmptyState icon="sparkles-outline" title="Aucun constat IA" subtitle="Apres les echanges du patient" /> : <View style={s.cardList}>{aiReports.map((r) => <ReportCard key={r._id} content={r.content} date={fmtDate(r.date)} from={r.from} />)}</View>
                    )}
                  </View>
  );

  // ── Discussion Tab (Chat-like interface) ───────────────
  const renderDiscussion = () => (
    <View style={s.chatContainer}>
      {/* Conversation selector */}
      {conversations.length > 1 && (
        <View style={s.convSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
            {conversations.map((c) => (
              <Pressable key={c.id} onPress={() => handleSelectConversation(c.id)} style={[s.convChip, c.id === conversationId && s.convChipActive]}>
                <Text style={[s.convChipText, c.id === conversationId && s.convChipTextActive]}>
                  {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                </Pressable>
            ))}
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
          return (
            <View key={i} style={[s.chatBubbleRow, isTherapist && s.chatBubbleRowRight]}>
              {!isTherapist && (
                <View style={[s.chatAvatar, { backgroundColor: isPatientMsg ? colors.primaryLight : colors.aiLight }]}>
                  <Ionicons name={isPatientMsg ? 'person' : 'sparkles'} size={14} color={isPatientMsg ? colors.primary : colors.ai} />
                        </View>
              )}
              <View style={[s.chatBubble, isTherapist ? s.chatBubbleTherapist : isAI ? s.chatBubbleAI : s.chatBubblePatient]}>
                <Text style={[s.chatSender, { color: isTherapist ? '#FFFFFF' : isAI ? colors.ai : colors.primary }]}>
                  {isTherapist ? 'Vous' : isAI ? 'IA' : 'Patient'}
                          </Text>
                <Text style={[font.bodySmall, isTherapist && { color: colors.textOnPrimary }]}>{msg.text}</Text>
                <Text style={[s.chatTime, isTherapist && { color: 'rgba(255,255,255,0.7)' }]}>{fmtDate(msg.createdAt || msg.date)}</Text>
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

  const renderContent = () => { switch (activeTab) { case 'overview': return renderOverview(); case 'reports': return renderReports(); case 'discussion': return renderDiscussion(); default: return renderOverview(); } };

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
  convChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
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
});
