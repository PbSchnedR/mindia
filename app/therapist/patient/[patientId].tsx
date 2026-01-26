import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, TextInput, Modal, Alert } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SeverityBadge } from '@/components/ui/badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const textColor = useThemeColor({}, 'text');

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
        // Charger les infos du patient via l'API
        const { user } = await api.users.getById(patientId);
        setPatientEmail(user.email || '');
        setActualMood(user.actual_mood || null);
        
        // Charger les messages pour trouver le dernier message du patient
        const { messages: messagesData } = await api.messages.get(patientId);
        setMessages(messagesData || []);
        
        // Trouver le dernier message du patient (les messages sont déjà triés par ordre chronologique)
        const patientMessages = (messagesData || []).filter((m: any) => m.from === 'patient');
        if (patientMessages.length > 0) {
          // Le dernier message est le dernier élément du tableau
          const lastMsg = patientMessages[patientMessages.length - 1];
          // Utiliser _id pour obtenir la date si createdAt n'existe pas (ObjectId contient un timestamp)
          let messageDate = lastMsg.createdAt;
          if (!messageDate && lastMsg._id) {
            // Extraire le timestamp de l'ObjectId MongoDB
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
        
        // Générer un magic token à usage unique pour le QR code (expire après 24h)
        const { magicToken: token, expiresIn } = await api.patient.generateMagicToken(patientId);
        setMagicToken(token || '');
        setTokenExpiresIn(expiresIn || '24h');
        
        // Normaliser pour la compatibilité
        const p = await getPatientById(patientId);
        setPatient(p ?? null);
        
        // Charger les constats
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

  // Le QR code contient le magic token à usage unique (expire après 24h)
  const qrCodeValue = useMemo(() => {
    return magicToken || '';
  }, [magicToken]);
  
  // Fonction pour régénérer un nouveau QR code
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
      // Recharger les messages
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
      // Recharger les reports
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

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText>Chargement de la fiche patient…</ThemedText>
      </ThemedView>
    );
  }

  if (error || !patient) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Card style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{error || 'Patient introuvable'}</ThemedText>
          <Button title="Retour" onPress={handleBack} style={{ marginTop: 16 }} />
        </Card>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Button title="Retour" variant="ghost" onPress={handleBack} />
        <ThemedText type="subtitle">
          {patient.firstName} {patient.lastName}
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Infos clés */}
        

        {/* QR Code pour inviter le patient */}
        {qrCodeValue ? (
          <Card style={styles.section}>
            <ThemedText type="defaultSemiBold">🔐 Inviter le patient dans sa bulle</ThemedText>
            <ThemedText>
              Le patient scanne ce QR code avec l'app mobile pour accéder à son espace. 
              <ThemedText style={{ fontWeight: '600' }}> Le code est à usage unique</ThemedText> et expire dans {tokenExpiresIn}.
            </ThemedText>
            <View style={styles.qrWrapper}>
              <QRCodeDisplay
                value={qrCodeValue}
                size={180}
                backgroundColor="#ffffff"
                color="#111827"
              />
            </View>
            <ThemedText style={styles.magicLinkLabel}>Email du patient</ThemedText>
            <ThemedText style={styles.magicLinkValue}>{patientEmail}</ThemedText>
            <View style={{ marginTop: 12 }}>
              <Button 
                title="🔄 Régénérer un nouveau QR code" 
                variant="secondary"
                onPress={handleRegenerateQRCode}
              />
            </View>
          </Card>
        ) : (
          <Card style={styles.section}>
            <ThemedText type="defaultSemiBold">QR Code</ThemedText>
            <ThemedText style={{ opacity: 0.7 }}>
              Génération du QR code en cours...
            </ThemedText>
          </Card>
        )}

        <View style={{ height: 12 }} />

        {/* Constats */}
        <Card style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <ThemedText type="defaultSemiBold">Constats / Observations</ThemedText>
            <Button
              title="+ Ajouter"
              variant="secondary"
              onPress={() => setShowReportModal(true)}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            />
          </View>
          {lastPatientMessage ? (
            <View style={styles.reportItem}>
              <ThemedText style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                Dernier message du patient (report IA):
              </ThemedText>
              <ThemedText style={styles.reportContent}>
                {lastPatientMessage.text}
              </ThemedText>
              <ThemedText style={styles.reportDate}>
                {formatDateTime(lastPatientMessage.date)}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>
              Aucun message du patient pour le moment.
            </ThemedText>
          )}
          {reports.length > 0 && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(156, 163, 175, 0.2)' }}>
              <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Constats précédents</ThemedText>
              {reports.map((report) => (
                <View key={report._id} style={styles.reportItem}>
                  <View style={styles.reportHeader}>
                    <View style={[styles.reportBadge, report.from === 'ai' && styles.reportBadgeAi]}>
                      <ThemedText style={styles.reportBadgeText}>
                        {report.from === 'therapist' ? 'Vous' : 'IA'}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.reportDate}>
                      {formatDateTime(report.date)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.reportContent}>
                    {report.content}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={{ height: 12 }} />

        {/* Sessions de chat */}
        <Card style={styles.section}>
          <ThemedText type="defaultSemiBold">Derniers moments déclarés</ThemedText>
          {lastPatientMessage ? (
            <View style={styles.sessionRow}>
              <ThemedText style={styles.sessionDate}>
                {formatDateTime(lastPatientMessage.date)}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>
              Aucun message du patient pour le moment.
            </ThemedText>
          )}
          {sessions.length > 0 && (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(156, 163, 175, 0.2)' }}>
              <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Sessions précédentes</ThemedText>
              {sessions.map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.sessionHeader}>
                    <SeverityBadge severity={s.severity as any} />
                    <ThemedText style={styles.sessionDate}>
                      {new Date(s.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  </View>
                  {s.summary ? (
                    <ThemedText style={styles.sessionSummary}>{s.summary}</ThemedText>
                  ) : null}
                  {s.keywords && s.keywords.length > 0 ? (
                    <ThemedText style={styles.sessionKeywords}>
                      Mots-clés: {s.keywords.join(', ')}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={{ height: 12 }} />

        {/* Discussion patient-IA */}
        <Card style={styles.section}>
          <ThemedText type="defaultSemiBold">Discussion patient-IA</ThemedText>
          {messages.length === 0 ? (
            <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>
              Aucun message dans la discussion pour le moment.
            </ThemedText>
          ) : (
            <View style={{ maxHeight: 300 }}>
              <ScrollView style={{ maxHeight: 300 }}>
                {messages.map((msg: any, idx: number) => (
                  <View key={msg._id || idx} style={[styles.messageItem, msg.from === 'patient' && styles.messagePatient, msg.from === 'therapist' && styles.messageTherapist, msg.from === 'ai' && styles.messageAI]}>
                    <ThemedText style={styles.messageAuthor} lightColor="#111827" darkColor="#ECEDEE">
                      {msg.from === 'patient' ? '👤 Patient' : msg.from === 'therapist' ? '👨‍⚕️ Vous' : '🤖 IA'}
                    </ThemedText>
                    <ThemedText style={styles.messageText} lightColor="#111827" darkColor="#ECEDEE">{msg.text}</ThemedText>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ marginTop: 12 }}>
            <Button
              title="Écrire un message"
              variant="secondary"
              onPress={() => setShowMessageModal(true)}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Modal pour écrire un message */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>
              Écrire un message
            </ThemedText>
            <TextInput
              placeholder="Votre message..."
              placeholderTextColor="#9BA1A6"
              multiline
              style={[styles.messageInput, { color: textColor }]}
              value={messageText}
              onChangeText={setMessageText}
            />
            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="ghost"
                onPress={() => {
                  setMessageText('');
                  setShowMessageModal(false);
                }}
              />
              <Button
                title={sendingMessage ? 'Envoi...' : 'Envoyer'}
                onPress={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                loading={sendingMessage}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>

      {/* Modal pour ajouter un constat */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>
              Ajouter un constat / observation
            </ThemedText>
            <ThemedText style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              Ce constat sera visible par le patient et différencié des constats générés par l'IA.
            </ThemedText>
            <TextInput
              placeholder="Votre constat ou observation..."
              placeholderTextColor="#9BA1A6"
              multiline
              style={[styles.messageInput, { color: textColor }]}
              value={reportText}
              onChangeText={setReportText}
            />
            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="ghost"
                onPress={() => {
                  setReportText('');
                  setShowReportModal(false);
                }}
              />
              <Button
                title={sendingReport ? 'Envoi...' : 'Ajouter'}
                onPress={handleAddReport}
                disabled={sendingReport || !reportText.trim()}
                loading={sendingReport}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    gap: 8,
  },
  qrWrapper: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  magicLinkLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
  magicLinkValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportItem: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.2)',
    gap: 8,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reportBadgeAi: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  reportBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reportDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  reportContent: {
    fontSize: 14,
    lineHeight: 21,
  },
  sessionRow: {
    marginTop: 10,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDate: {
    fontSize: 12,
    opacity: 0.8,
  },
  sessionSummary: {
    fontSize: 13,
  },
  sessionKeywords: {
    fontSize: 12,
    opacity: 0.85,
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 350,
  },
  errorText: {
    textAlign: 'center',
    opacity: 0.8,
  },
  messageItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
  },
  messagePatient: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  messageTherapist: {
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  messageAI: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  messageAuthor: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    // La couleur est gérée par ThemedText avec lightColor/darkColor
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.3)',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(156, 163, 175, 0.05)',
    // La couleur du texte est définie dynamiquement via le style inline
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
