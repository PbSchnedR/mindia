import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientEmail, setPatientEmail] = useState<string>('');
  const [magicToken, setMagicToken] = useState<string>('');
  const [tokenExpiresIn, setTokenExpiresIn] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Card style={styles.section}>
          <ThemedText type="defaultSemiBold">Infos clés</ThemedText>
          <ThemedText>
            Sujet de la thérapie: {patient.therapyTopic ?? 'Non renseigné'}
          </ThemedText>
          <ThemedText>
            Profession: {patient.profession ?? '—'} · Situation familiale: {patient.familySituation ?? '—'}
          </ThemedText>
          <ThemedText>
            Séances effectuées: {patient.sessionsDone ?? 0} · Score global: {patient.score ?? '—'}
          </ThemedText>
          {patient.nextSessionAt ? (
            <ThemedText>Prochaine séance programmée.</ThemedText>
          ) : (
            <ThemedText style={{ opacity: 0.7 }}>Aucune séance programmée (proposer un RDV).</ThemedText>
          )}
          {patient.bookingUrl ? (
            <View style={{ marginTop: 8 }}>
              <Button
                title="Ouvrir la page de prise de RDV"
                variant="secondary"
                onPress={() => {
                  // eslint-disable-next-line no-alert
                  alert(`Lien Doctolib / Médoucine simulé: ${patient.bookingUrl}`);
                }}
              />
            </View>
          ) : null}
        </Card>

        <View style={{ height: 12 }} />

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
          <ThemedText type="defaultSemiBold">Constats / Observations</ThemedText>
          {reports.length === 0 ? (
            <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>
              Aucun constat pour ce patient.
            </ThemedText>
          ) : (
            reports.map((report) => (
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
            ))
          )}
        </Card>

        <View style={{ height: 12 }} />

        {/* Sessions de chat */}
        <Card style={styles.section}>
          <ThemedText type="defaultSemiBold">Dernières crises / moments déclarés</ThemedText>
          {sessions.length === 0 ? (
            <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>
              Aucune conversation issue de la bulle pour ce patient.
            </ThemedText>
          ) : (
            sessions.map((s) => (
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
            ))
          )}
        </Card>
      </ScrollView>
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
});
