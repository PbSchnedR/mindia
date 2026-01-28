import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, TextInput, Modal, Alert, Text, Pressable, StatusBar, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { QRCodeDisplay } from '@/components/qr-code-display';
import { listChatSessionsForTherapist } from '@/lib/chat';
import { useSession } from '@/lib/session-context';
import { getPatientById } from '@/lib/people';
import { api } from '@/lib/api';
import type { ChatSession, Patient } from '@/lib/types';

interface Report {
  _id: string;
  date: string;
  content: string;
  from: 'therapist' | 'ai';
}

export default function TherapistPatientDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useSession();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientEmail, setPatientEmail] = useState<string>('');
  const [magicToken, setMagicToken] = useState<string>('');
  const [tokenExpiresIn, setTokenExpiresIn] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [actualMood, setActualMood] = useState<string | null>(null);
  const [lastPatientMessage, setLastPatientMessage] = useState<{ text: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Navigation state
  const [activeTab, setActiveTab] = useState<'qr' | 'reports' | 'discussion'>('qr');
  const [reportsView, setReportsView] = useState<'ai' | 'therapist'>('therapist');

  useEffect(() => {
    const raw = params.patientId;
    const patientId = Array.isArray(raw) ? raw[0] : raw;
    if (!patientId || typeof patientId !== 'string') {
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { user } = await api.users.getById(patientId);
        setPatientEmail(user.email || '');
        setActualMood(user.actual_mood || null);
        
        const { messages: messagesData } = await api.messages.get(patientId);
        setMessages(messagesData || []);
        
        const patientMessages = (messagesData || []).filter((m: any) => m.from === 'patient');
        if (patientMessages.length > 0) {
          const lastMsg = patientMessages[patientMessages.length - 1];
          let messageDate = lastMsg.createdAt;
          if (!messageDate && lastMsg._id) {
            const objectIdTimestamp = typeof lastMsg._id === 'string' 
              ? parseInt(lastMsg._id.substring(0, 8), 16) * 1000
              : lastMsg._id.getTimestamp ? lastMsg._id.getTimestamp().toISOString() : new Date().toISOString();
            messageDate = typeof objectIdTimestamp === 'number' 
              ? new Date(objectIdTimestamp).toISOString()
              : objectIdTimestamp;
          }
          setLastPatientMessage({
            text: lastMsg.text,
            date: messageDate || new Date().toISOString(),
          });
        } else {
          setLastPatientMessage(null);
        }
        
        const { magicToken: token, expiresIn } = await api.patient.generateMagicToken(patientId);
        setMagicToken(token || '');
        setTokenExpiresIn(expiresIn || '24h');
        
        const p = await getPatientById(patientId);
        setPatient(p ?? null);
        
        const { reports: reportsData } = await api.reports.get(patientId);
        setReports(reportsData || []);
        
        if (session && session.role === 'therapist') {
          const all = await listChatSessionsForTherapist(session.therapistId);
          const forPatient = all.filter((s) => s.patientId === patientId);
          setSessions(forPatient);
        } else {
          setSessions([]);
        }
      } catch (e) {
        console.error('Erreur chargement fiche patient', e);
        setError('Impossible de charger les informations du patient.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.patientId, session]);

  const handleBack = () => {
    router.back();
  };

  const qrCodeValue = useMemo(() => {
    return magicToken || '';
  }, [magicToken]);
  
  const handleRegenerateQRCode = async () => {
    try {
      const raw = params.patientId;
      const patientId = Array.isArray(raw) ? raw[0] : raw;
      if (!patientId || typeof patientId !== 'string') return;
      
      const { magicToken: token, expiresIn } = await api.patient.generateMagicToken(patientId);
      setMagicToken(token || '');
      setTokenExpiresIn(expiresIn || '24h');
    } catch (e) {
      console.error('Erreur régénération QR code', e);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSendMessage = async () => {
    const raw = params.patientId;
    const patientId = Array.isArray(raw) ? raw[0] : raw;
    if (!patientId || typeof patientId !== 'string' || !messageText.trim()) {
      return;
    }

    setSendingMessage(true);
    try {
      await api.messages.add(patientId, 'therapist', messageText.trim());
      const { messages: updatedMessages } = await api.messages.get(patientId);
      setMessages(updatedMessages || []);
      setMessageText('');
      setShowMessageModal(false);
    } catch (e) {
      console.error('Erreur envoi message:', e);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Réessayez plus tard.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAddReport = async () => {
    const raw = params.patientId;
    const patientId = Array.isArray(raw) ? raw[0] : raw;
    if (!patientId || typeof patientId !== 'string' || !reportText.trim()) {
      return;
    }

    setSendingReport(true);
    try {
      await api.reports.add(patientId, reportText.trim(), 'therapist');
      const { reports: updatedReports } = await api.reports.get(patientId);
      setReports(updatedReports || []);
      setReportText('');
      setShowReportModal(false);
    } catch (e) {
      console.error('Erreur ajout report:', e);
      Alert.alert('Erreur', 'Impossible d\'ajouter le constat. Réessayez plus tard.');
    } finally {
      setSendingReport(false);
    }
  };

  const handleScanReportWithGemini = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La caméra est nécessaire pour scanner une note.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.6,
      });

      if (result.canceled || !result.assets || !result.assets[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      setOcrLoading(true);

      try {
        const { text } = await api.ai.ocr({
          imageBase64: asset.base64 ?? '',
          mimeType: asset.mimeType ?? 'image/jpeg',
        });

        if (!text) {
          Alert.alert('Gemini', 'Aucun texte lisible n\'a été détecté.');
          return;
        }

        setReportText((current) => (current ? `${current}\n\n${text}` : text));
      } catch (error) {
        console.error('Erreur OCR Gemini:', error);
        Alert.alert(
          'Erreur',
          'Impossible de lire la photo avec Gemini. Vérifiez votre connexion et réessayez.'
        );
      } finally {
        setOcrLoading(false);
      }
    } catch (e) {
      console.error('Erreur ImagePicker / Gemini:', e);
      Alert.alert('Erreur', 'Un problème est survenu lors de la prise de photo.');
    }
  };

  const aiReports = reports.filter(r => r.from === 'ai');
  const therapistReports = reports.filter(r => r.from === 'therapist');

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error || !patient) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error || 'Patient introuvable'}</Text>
          <Button title="Retour" onPress={handleBack} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.safeArea} />
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.patientName}>
              {patient.firstName} {patient.lastName}
            </Text>
            <Text style={styles.patientEmail}>{patientEmail}</Text>
          </View>
        </View>

        {/* Content selon le tab actif */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'qr' && (
            <View style={styles.qrSection}>
              <Text style={styles.sectionTitle}>QR Code d'accès</Text>
              <View style={styles.qrCard}>
                <View style={styles.qrCodeWrapper}>
                  {qrCodeValue ? (
                    <QRCodeDisplay
                      value={qrCodeValue}
                      size={200}
                      backgroundColor="#ffffff"
                      color="#111827"
                    />
                  ) : (
                    <Text style={styles.qrErrorText}>Impossible de générer le QR code</Text>
                  )}
                </View>
                <View style={styles.qrInfo}>
                  <View style={styles.qrInfoRow}>
                    <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                    <Text style={styles.qrInfoText}>Code à usage unique</Text>
                  </View>
                  <View style={styles.qrInfoRow}>
                    <Ionicons name="time" size={20} color="#2563EB" />
                    <Text style={styles.qrInfoText}>Expire dans {tokenExpiresIn}</Text>
                  </View>
                </View>
                <Text style={styles.qrDescription}>
                  Le patient scanne ce QR code avec l'app mobile pour accéder à sa bulle de manière sécurisée.
                </Text>
                <Button 
                  title="Régénérer un nouveau code" 
                  variant="secondary" 
                  onPress={handleRegenerateQRCode} 
                />
              </View>
            </View>
          )}

          {activeTab === 'reports' && (
            <>
              {/* Toggle Constats */}
              <View style={styles.reportsToggle}>
                <Pressable
                  style={[
                    styles.reportsToggleButton,
                    reportsView === 'therapist' && styles.reportsToggleButtonActive
                  ]}
                  onPress={() => setReportsView('therapist')}
                >
                  <Text style={[
                    styles.reportsToggleText,
                    reportsView === 'therapist' && styles.reportsToggleTextActive
                  ]}>
                    Mes constats
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.reportsToggleButton,
                    reportsView === 'ai' && styles.reportsToggleButtonActive
                  ]}
                  onPress={() => setReportsView('ai')}
                >
                  <Text style={[
                    styles.reportsToggleText,
                    reportsView === 'ai' && styles.reportsToggleTextActive
                  ]}>
                    Constats IA
                  </Text>
                </Pressable>
              </View>

              {/* Bouton ajouter constat (uniquement pour "Mes constats") */}
              {reportsView === 'therapist' && (
                <Button 
                  title="+ Ajouter un constat" 
                  onPress={() => setShowReportModal(true)}
                  style={{ marginBottom: 16 }}
                />
              )}

              {/* Liste des constats */}
              <View style={styles.reportsContent}>
                {reportsView === 'therapist' ? (
                  therapistReports.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                      <Text style={styles.emptyText}>Aucun constat pour le moment</Text>
                      <Text style={styles.emptySubtext}>
                        Ajoutez vos observations après vos séances
                      </Text>
                    </View>
                  ) : (
                    therapistReports.map((report) => (
                      <View key={report._id} style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                          <View style={styles.reportBadge}>
                            <Ionicons name="person" size={14} color="#2563EB" />
                            <Text style={styles.reportBadgeText}>Thérapeute</Text>
                          </View>
                          <Text style={styles.reportDate}>
                            {formatDateTime(report.date)}
                          </Text>
                        </View>
                        <Text style={styles.reportContent}>{report.content}</Text>
                      </View>
                    ))
                  )
                ) : (
                  aiReports.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="sparkles-outline" size={48} color="#CBD5E1" />
                      <Text style={styles.emptyText}>Aucun constat IA disponible</Text>
                      <Text style={styles.emptySubtext}>
                        L'IA créera des constats basés sur les échanges du patient
                      </Text>
                    </View>
                  ) : (
                    aiReports.map((report) => (
                      <View key={report._id} style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                          <View style={[styles.reportBadge, styles.reportBadgeAi]}>
                            <Ionicons name="sparkles" size={14} color="#8B5CF6" />
                            <Text style={[styles.reportBadgeText, styles.reportBadgeTextAi]}>IA</Text>
                          </View>
                          <Text style={styles.reportDate}>
                            {formatDateTime(report.date)}
                          </Text>
                        </View>
                        <Text style={styles.reportContent}>{report.content}</Text>
                      </View>
                    ))
                  )
                )}
              </View>
            </>
          )}

          {activeTab === 'discussion' && (
            <View style={styles.discussionSection}>
              <View style={styles.moodCard}>
                <Text style={styles.moodTitle}>État actuel du patient</Text>
                <View style={styles.moodIndicator}>
                  {actualMood === '1' && (
                    <>
                      <Text style={styles.moodEmoji}>😊</Text>
                      <Text style={styles.moodText}>Plutôt bien</Text>
                    </>
                  )}
                  {actualMood === '2' && (
                    <>
                      <Text style={styles.moodEmoji}>😟</Text>
                      <Text style={styles.moodText}>En difficulté</Text>
                    </>
                  )}
                  {actualMood === '3' && (
                    <>
                      <Text style={styles.moodEmoji}>😰</Text>
                      <Text style={[styles.moodText, styles.moodTextDanger]}>Crise / Urgence</Text>
                    </>
                  )}
                  {!actualMood && (
                    <Text style={styles.moodTextEmpty}>Non renseigné</Text>
                  )}
                </View>
              </View>

              {lastPatientMessage && (
                <View style={styles.lastMessageCard}>
                  <View style={styles.lastMessageHeader}>
                    <Ionicons name="chatbubble" size={20} color="#2563EB" />
                    <Text style={styles.lastMessageTitle}>Dernier message du patient</Text>
                  </View>
                  <Text style={styles.lastMessageText}>{lastPatientMessage.text}</Text>
                  <Text style={styles.lastMessageDate}>
                    {formatDateTime(lastPatientMessage.date)}
                  </Text>
                </View>
              )}

              <Button 
                title="+ Envoyer un message" 
                onPress={() => setShowMessageModal(true)}
                style={{ marginTop: 16 }}
              />

              <View style={styles.messagesContent}>
                <Text style={styles.messagesTitle}>Historique des échanges</Text>
                {messages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Aucun message</Text>
                  </View>
                ) : (
                  messages.map((msg, idx) => (
                    <View 
                      key={idx} 
                      style={[
                        styles.messageCard,
                        msg.from === 'therapist' && styles.messageCardTherapist
                      ]}
                    >
                      <View style={styles.messageHeader}>
                        <View style={styles.messageBadge}>
                          <Ionicons 
                            name={msg.from === 'patient' ? 'person' : 'medkit'} 
                            size={12} 
                            color={msg.from === 'patient' ? '#2563EB' : '#8B5CF6'} 
                          />
                          <Text style={styles.messageBadgeText}>
                            {msg.from === 'patient' ? 'Patient' : msg.from === 'therapist' ? 'Thérapeute' : 'IA'}
                          </Text>
                        </View>
                        <Text style={styles.messageDate}>
                          {formatDateTime(msg.createdAt || msg.date)}
                        </Text>
                      </View>
                      <Text style={styles.messageText}>{msg.text}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Tab Menu */}
        <View style={styles.bottomTab}>
          <Pressable
            style={[styles.tabButton, activeTab === 'qr' && styles.tabButtonActive]}
            onPress={() => setActiveTab('qr')}
          >
            <Ionicons
              name={activeTab === 'qr' ? 'qr-code' : 'qr-code-outline'}
              size={24}
              color={activeTab === 'qr' ? '#2563EB' : '#64748B'}
            />
            <Text style={[
              styles.tabText,
              activeTab === 'qr' && styles.tabTextActive
            ]}>
              QR Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'reports' && styles.tabButtonActive]}
            onPress={() => setActiveTab('reports')}
          >
            <Ionicons
              name={activeTab === 'reports' ? 'document-text' : 'document-text-outline'}
              size={24}
              color={activeTab === 'reports' ? '#2563EB' : '#64748B'}
            />
            <Text style={[
              styles.tabText,
              activeTab === 'reports' && styles.tabTextActive
            ]}>
              Constats
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'discussion' && styles.tabButtonActive]}
            onPress={() => setActiveTab('discussion')}
          >
            <Ionicons
              name={activeTab === 'discussion' ? 'chatbubbles' : 'chatbubbles-outline'}
              size={24}
              color={activeTab === 'discussion' ? '#2563EB' : '#64748B'}
            />
            <Text style={[
              styles.tabText,
              activeTab === 'discussion' && styles.tabTextActive
            ]}>
              Discussion
            </Text>
          </Pressable>
        </View>

        {/* Modal Ajouter un constat */}
        <Modal
          visible={showReportModal}
          animationType="slide"
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau constat</Text>
              <Pressable onPress={() => setShowReportModal(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color="#1E293B" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalContent}>
              <TextInput
                value={reportText}
                onChangeText={setReportText}
                placeholder="Écrivez votre constat ici..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={8}
                style={styles.modalTextInput}
                textAlignVertical="top"
              />
              <Button
                title="📷 Scanner une note manuscrite"
                variant="secondary"
                onPress={handleScanReportWithGemini}
                loading={ocrLoading}
                style={{ marginTop: 12 }}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button
                title="Annuler"
                variant="secondary"
                onPress={() => setShowReportModal(false)}
              />
              <Button
                title="Enregistrer"
                onPress={handleAddReport}
                loading={sendingReport}
                disabled={!reportText.trim()}
              />
            </View>
          </View>
        </Modal>

        {/* Modal Envoyer un message */}
        <Modal
          visible={showMessageModal}
          animationType="slide"
          onRequestClose={() => setShowMessageModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau message</Text>
              <Pressable onPress={() => setShowMessageModal(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color="#1E293B" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalContent}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Écrivez votre message..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={6}
                style={styles.modalTextInput}
                textAlignVertical="top"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button
                title="Annuler"
                variant="secondary"
                onPress={() => setShowMessageModal(false)}
              />
              <Button
                title="Envoyer"
                onPress={handleSendMessage}
                loading={sendingMessage}
                disabled={!messageText.trim()}
              />
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 16,
  },
  headerContent: {
    flex: 1,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  patientEmail: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  
  // QR Section
  qrSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  qrCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  qrCodeWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  qrErrorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  qrInfo: {
    gap: 12,
    width: '100%',
  },
  qrInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrInfoText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  qrDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Reports Section
  reportsToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  reportsToggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportsToggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reportsToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  reportsToggleTextActive: {
    color: '#2563EB',
  },
  reportsContent: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportBadgeAi: {
    backgroundColor: '#F5F3FF',
  },
  reportBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  reportBadgeTextAi: {
    color: '#8B5CF6',
  },
  reportDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  reportContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  
  // Discussion Section
  discussionSection: {
    gap: 16,
  },
  moodCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  moodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  moodIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  moodTextDanger: {
    color: '#EF4444',
  },
  moodTextEmpty: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  lastMessageCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  lastMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  lastMessageText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  lastMessageDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  messagesContent: {
    gap: 12,
    marginTop: 16,
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  messageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  messageCardTherapist: {
    backgroundColor: '#F5F3FF',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  messageDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  messageText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Bottom Tab
  bottomTab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabButtonActive: {
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 120,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  
  // Error
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
});
