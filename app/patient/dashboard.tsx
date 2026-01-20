import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/lib/session-context';
import { api } from '@/lib/api';

interface Report {
  _id: string;
  date: string;
  content: string;
  from: 'therapist' | 'ai';
}

interface PatientInfo {
  username: string;
  email: string;
  lastSessionAt?: string;
  nextSessionAt?: string;
  sessionsDone?: number;
  therapyTopic?: string;
}

export default function PatientDashboardScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;

    if (!session || session.role !== 'patient') {
      const timeout = setTimeout(() => {
        router.replace('/patient');
      }, 0);
      return () => clearTimeout(timeout);
    }

    loadData();
  }, [session, sessionLoading, router]);

  const loadData = async () => {
    if (!session || session.role !== 'patient') return;
    
    const patientId = session.patientId;
    
    setLoading(true);
    setError(null);
    
    try {
      // Charger les infos du patient
      const { user } = await api.users.getById(patientId);
      setPatientInfo(user);
      
      // Charger les constats
      const { reports: reportsData } = await api.reports.get(patientId);
      setReports(reportsData || []);
      
      // Charger les messages pour la dernière synthèse (messages IA)
      const { messages } = await api.messages.get(patientId);
      const aiMessages = messages.filter((m: any) => m.from === 'ai');
      if (aiMessages.length > 0) {
        setLastSummary(aiMessages[aiMessages.length - 1].text);
      }
    } catch (err: any) {
      console.error('Erreur chargement dashboard patient:', err);
      setError('Impossible de charger tes informations. Réessaye plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleOpenChat = () => {
    router.push('/patient/chat');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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

  if (sessionLoading || loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText>Chargement...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Card style={styles.errorCard}>
          <ThemedText type="subtitle" style={styles.errorTitle}>Oups !</ThemedText>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Button title="Réessayer" onPress={loadData} style={{ marginTop: 16 }} />
          <Button title="Se déconnecter" variant="secondary" onPress={handleSignOut} style={{ marginTop: 8 }} />
        </Card>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText type="title">Ma bulle</ThemedText>
            <ThemedText style={styles.greeting}>
              Bonjour {patientInfo?.username || 'toi'} 👋
            </ThemedText>
          </View>
          <Pressable onPress={handleSignOut} hitSlop={10}>
            <ThemedText style={styles.logoutText}>Déconnexion</ThemedText>
          </Pressable>
        </View>

        {/* Bouton chat */}
        <Card style={styles.chatCard}>
          <View style={styles.chatContent}>
            <View style={styles.chatIcon}>
              <ThemedText style={styles.chatEmoji}>💬</ThemedText>
            </View>
            <View style={styles.chatTextContainer}>
              <ThemedText type="defaultSemiBold">Besoin de parler ?</ThemedText>
              <ThemedText style={styles.chatSubtext}>
                Ta bulle est là pour toi, 24h/24
              </ThemedText>
            </View>
          </View>
          <Button title="Ouvrir ma bulle" onPress={handleOpenChat} />
        </Card>

        {/* Infos séances */}
        <Card style={styles.infoCard}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Mes séances
          </ThemedText>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>Dernière séance</ThemedText>
              <ThemedText style={styles.infoValue}>
                {formatDate(patientInfo?.lastSessionAt) || 'Pas encore'}
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>Prochain RDV</ThemedText>
              <ThemedText style={[styles.infoValue, patientInfo?.nextSessionAt && styles.nextSessionHighlight]}>
                {formatDate(patientInfo?.nextSessionAt) || 'À planifier'}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>Séances effectuées</ThemedText>
              <ThemedText style={styles.infoValue}>
                {patientInfo?.sessionsDone ?? 0}
              </ThemedText>
            </View>
            {patientInfo?.therapyTopic && (
              <View style={styles.infoItem}>
                <ThemedText style={styles.infoLabel}>Sujet</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {patientInfo.therapyTopic}
                </ThemedText>
              </View>
            )}
          </View>
        </Card>

        {/* Dernière synthèse */}
        {lastSummary && (
          <Card style={styles.summaryCard}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Dernière synthèse
            </ThemedText>
            <ThemedText style={styles.summaryText}>
              {lastSummary}
            </ThemedText>
          </Card>
        )}

        {/* Constats */}
        <Card style={styles.reportsCard}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Constats de mon thérapeute
          </ThemedText>
          
          {reports.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              Aucun constat pour le moment. Ton thérapeute peut noter ici des observations après vos séances.
            </ThemedText>
          ) : (
            reports.map((report) => (
              <View key={report._id} style={styles.reportItem}>
                <View style={styles.reportHeader}>
                  <View style={[styles.reportBadge, report.from === 'ai' && styles.reportBadgeAi]}>
                    <ThemedText style={styles.reportBadgeText}>
                      {report.from === 'therapist' ? '👤 Thérapeute' : '🤖 IA'}
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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    marginTop: 4,
    opacity: 0.8,
  },
  logoutText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  chatCard: {
    marginBottom: 16,
    gap: 16,
  },
  chatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatEmoji: {
    fontSize: 24,
  },
  chatTextContainer: {
    flex: 1,
  },
  chatSubtext: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  infoCard: {
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  nextSessionHighlight: {
    color: '#EC4899',
  },
  summaryCard: {
    marginBottom: 16,
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  reportsCard: {
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
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
  errorCard: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
  },
  errorTitle: {
    marginBottom: 8,
    color: '#EF4444',
  },
  errorText: {
    textAlign: 'center',
    opacity: 0.8,
  },
});
