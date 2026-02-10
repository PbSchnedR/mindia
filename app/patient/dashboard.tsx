import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Linking, Text, StatusBar, Alert, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { PrimaryTabs } from '@/components/primary-tabs';
import { useSession } from '@/lib/session-context';
import { api } from '@/lib/api';
import { listChatSessionsForPatient, setSeverity, setSummaryAndKeywords, simpleAutoSummary, startChatSession } from '@/lib/chat';
import { getTherapistById } from '@/lib/people';
import type { Severity } from '@/lib/types';

// Chargement conditionnel de react-calendly uniquement sur le web
let InlineWidget: any | null = null;
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  InlineWidget = require('react-calendly').InlineWidget;
}

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
  bookingUrl?: string;
}

export default function PatientDashboardScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const { width } = useWindowDimensions();
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [mood, setMood] = useState<Severity | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [therapistName, setTherapistName] = useState<string>('');
  const [therapistBookingUrl, setTherapistBookingUrl] = useState<string | null>(null);
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<'bubble' | 'reports' | 'booking'>('bubble');
  const [reportsView, setReportsView] = useState<'therapist' | 'last'>('therapist');
  const [menuOpen, setMenuOpen] = useState(false);

  const isDesktop = Platform.OS === 'web' && width >= 1024;

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

      // Charger le nom complet du thérapeute pour l'onglet Rendez-vous
      if (session.therapistId) {
        try {
          const therapist = await getTherapistById(session.therapistId);
          if (therapist) {
            setTherapistName(`${therapist.firstName} ${therapist.lastName}`);
          }
        } catch (e) {
          console.warn('Erreur chargement thérapeute pour Calendly:', e);
        }
      }

      // Charger les infos du thérapeute (nom complet + lien de réservation)
      if (session.therapistId) {
        try {
          const therapist = await getTherapistById(session.therapistId);
          if (therapist) {
            setTherapistName(`${therapist.firstName} ${therapist.lastName}`.trim());
            if (therapist.bookingUrl) {
              setTherapistBookingUrl(therapist.bookingUrl);
            }
          }
        } catch (e) {
          console.warn('Erreur chargement thérapeute pour patient dashboard:', e);
        }
      }

      // Déterminer le mood initial à partir de actual_mood si présent
      let moodFromUser: Severity | undefined;
      if (user.actual_mood) {
        const parsed = parseInt(String(user.actual_mood), 10);
        if (parsed === 1 || parsed === 2 || parsed === 3) {
          moodFromUser = parsed as Severity;
          setMood(moodFromUser);
        }
      }
      
      // Charger les constats
      const { reports: reportsData } = await api.reports.get(patientId);
      setReports(reportsData || []);
      
      // Charger les messages pour la dernière synthèse (messages IA)
      const { messages } = await api.messages.get(patientId);
      const aiMessages = messages.filter((m: any) => m.from === 'ai');
      if (aiMessages.length > 0) {
        setLastSummary(aiMessages[aiMessages.length - 1].text);
      }

      // Préparer la session de bulle pour le mood
      const sessions = await listChatSessionsForPatient(patientId);
      if (sessions.length > 0) {
        const latest = sessions[0];
        setChatSessionId(latest.id);
        // Ne pas écraser le mood venant de actual_mood
        if (!moodFromUser) {
          setMood(latest.severity);
        }
      } else {
        const created = await startChatSession(patientId, session.therapistId);
        setChatSessionId(created.id);
        if (!moodFromUser) {
          setMood(created.severity);
        }
      }
    } catch (err: any) {
      console.error('Erreur chargement dashboard patient:', err);
      if (err?.status === 401 || err?.message?.toLowerCase().includes('token')) {
        await handleSignOut();
      } else {
        setError('Impossible de charger tes informations. Réessaye plus tard.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/');
  };

  const handleOpenChat = () => {
    router.push('/patient/chat');
  };

  const handleSelectMood = async (value: Severity) => {
    if (!chatSessionId || !session?.patientId) return;
    try {
      console.log('[Mood] Mise à jour actual_mood pour patient:', session.patientId, 'valeur:', value);
      await api.users.update(session.patientId, { actual_mood: String(value) });
      console.log('[Mood] actual_mood mis à jour avec succès');

      const updated = await setSeverity(chatSessionId, value);
      setMood(updated.severity);

      const { summary, keywords } = simpleAutoSummary(updated.messages);
      await setSummaryAndKeywords(chatSessionId, summary, keywords);
    } catch (e) {
      console.error('Erreur lors de la mise à jour du mood:', e);
      Alert.alert('Erreur', 'Impossible de sauvegarder votre état. Réessayez plus tard.');
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

  if (sessionLoading || loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Oups !</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Réessayer" onPress={loadData} style={{ marginTop: 16 }} />
          <Button title="Se déconnecter" variant="secondary" onPress={handleSignOut} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.safeArea} />
        {/* Header */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View style={styles.headerLeft}>
            <Text style={styles.titleText}>
              {activeTab === 'bubble' ? 'Ma Bulle' : 'Synthèses'}
            </Text>
            <Text style={styles.greeting}>
              Bonjour {patientInfo?.username || 'toi'} 👋
            </Text>
          </View>
          {isDesktop ? (
            <Pressable onPress={handleSignOut} hitSlop={10}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setMenuOpen(!menuOpen)} hitSlop={10} style={styles.menuButton}>
              <Ionicons name={menuOpen ? 'close' : 'menu'} size={28} color="#1E293B" />
            </Pressable>
          )}
        </View>

        {!isDesktop && menuOpen && (
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.menuItemTextDanger}>Déconnexion</Text>
            </Pressable>
          </View>
        )}

        {/* Onglets principaux (desktop uniquement) */}
        {isDesktop && (
          <PrimaryTabs
            tabs={[
              { key: 'bubble', label: 'Bulle' },
              { key: 'reports', label: 'Synthèses' },
              { key: 'booking', label: 'Rendez-vous' },
            ]}
            activeKey={activeTab}
            onChange={(key) =>
              setActiveTab(key as 'bubble' | 'reports' | 'booking')
            }
            style={styles.desktopTabs}
          />
        )}

        {/* Contenu (UI mobile vs UI desktop dédiée) */}
        {isDesktop ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, styles.scrollContentDesktop]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'bubble' && (
              <View
                style={[styles.bubbleLayout, styles.bubbleLayoutDesktop]}
              >
                <View
                  style={[
                    styles.bubbleLeft,
                    styles.bubbleLeftDesktop,
                  ]}
                >
                  {/* Card IA Bulle */}
                  <View style={styles.aiCard}>
                    <View style={styles.aiIllustration}>
                      <Text style={styles.aiEmoji}>🤖</Text>
                    </View>
                    <Text style={styles.aiName}>Assistant IA</Text>
                    <Text style={styles.aiSubtext}>
                      Un espace sûr pour exprimer tes émotions, disponible 24/7
                    </Text>
                    <Pressable
                      style={styles.bubbleButton}
                      onPress={handleOpenChat}
                    >
                      <Text style={styles.bubbleButtonText}>
                        Entrer dans ma bulle
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color="#FFFFFF"
                      />
                    </Pressable>
                  </View>

                  {/* Comment te sens-tu ? */}
                  <View style={styles.moodSection}>
                    <Text style={styles.sectionTitle}>
                      Comment te sens-tu ?
                    </Text>
                    <View style={styles.moodButtons}>
                      <Pressable
                        style={[
                          styles.moodButton,
                          mood === 1 && styles.moodButtonActive,
                        ]}
                        onPress={() => handleSelectMood(1)}
                      >
                        <Text style={styles.moodEmoji}>😊</Text>
                        <Text
                          style={[
                            styles.moodButtonText,
                            mood === 1 && styles.moodButtonTextActive,
                          ]}
                        >
                          Bien
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.moodButton,
                          mood === 2 && styles.moodButtonActive,
                        ]}
                        onPress={() => handleSelectMood(2)}
                      >
                        <Text style={styles.moodEmoji}>😟</Text>
                        <Text
                          style={[
                            styles.moodButtonText,
                            mood === 2 && styles.moodButtonTextActive,
                          ]}
                        >
                          Difficile
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.moodButton,
                          mood === 3 && styles.moodButtonActiveDanger,
                        ]}
                        onPress={() => handleSelectMood(3)}
                      >
                        <Text style={styles.moodEmoji}>😰</Text>
                        <Text
                          style={[
                            styles.moodButtonText,
                            mood === 3 && styles.moodButtonTextActive,
                          ]}
                        >
                          Urgence
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.bubbleRight,
                    styles.bubbleRightDesktop,
                  ]}
                >
                  {/* Carte rendez-vous (si lien dispo) */}
                  {therapistBookingUrl && (
                    <View style={styles.bookingCard}>
                      <Text style={styles.bookingTitle}>Prendre rendez-vous</Text>
                      <Text style={styles.bookingText}>
                        Planifie une prochaine séance avec {therapistName || 'ton thérapeute'} quand tu en as besoin.
                      </Text>
                      <Pressable
                        style={styles.bookingButton}
                        onPress={() =>
                          Linking.openURL(therapistBookingUrl)
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color="#2563EB"
                        />
                        <Text style={styles.bookingButtonText}>
                          Ouvrir le calendrier
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Exercices rapides */}
                  <View style={styles.exercisesSection}>
                    <Text style={styles.sectionTitle}>Exercices rapides</Text>
                    <View style={styles.exerciseItem}>
                      <View style={styles.exerciseIcon}>
                        <Ionicons name="fitness" size={24} color="#2563EB" />
                      </View>
                      <View style={styles.exerciseContent}>
                        <Text style={styles.exerciseTitle}>
                          Respiration profonde
                        </Text>
                        <Text style={styles.exerciseText}>
                          Inspire 4s, retiens 4s, expire 6s
                        </Text>
                      </View>
                    </View>
                    <View style={styles.exerciseItem}>
                      <View style={styles.exerciseIcon}>
                        <Ionicons name="walk" size={24} color="#2563EB" />
                      </View>
                      <View style={styles.exerciseContent}>
                        <Text style={styles.exerciseTitle}>
                          Marche de 5 minutes
                        </Text>
                        <Text style={styles.exerciseText}>
                          Sors prendre l'air pour apaiser ton esprit
                        </Text>
                      </View>
                    </View>
                    <View style={styles.exerciseItem}>
                      <View style={styles.exerciseIcon}>
                        <Ionicons name="call" size={24} color="#2563EB" />
                      </View>
                      <View style={styles.exerciseContent}>
                        <Text style={styles.exerciseTitle}>
                          Contacter un proche
                        </Text>
                        <Text style={styles.exerciseText}>
                          Parler peut vraiment aider à se sentir mieux
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {activeTab === 'reports' && (
              <View style={styles.reportsDesktopLayout}>
                <View style={styles.reportsDesktopColumn}>
                  <Text style={styles.reportsTitle}>
                    Constats de mon thérapeute
                  </Text>
                  {reports.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="document-text-outline"
                        size={48}
                        color="#CBD5E1"
                      />
                      <Text style={styles.emptyText}>
                        Aucun constat pour le moment
                      </Text>
                      <Text style={styles.emptySubtext}>
                        Ton thérapeute peut noter ses observations ici après
                        vos séances
                      </Text>
                    </View>
                  ) : (
                    reports.map((report) => (
                      <View key={report._id} style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                          <View
                            style={[
                              styles.reportBadge,
                              report.from === 'ai' && styles.reportBadgeAi,
                            ]}
                          >
                            <Text style={styles.reportBadgeText}>
                              {report.from === 'therapist' ? 'Thérapeute' : 'IA'}
                            </Text>
                          </View>
                          <Text style={styles.reportDate}>
                            {formatDateTime(report.date)}
                          </Text>
                        </View>
                        <Text style={styles.reportContent}>
                          {report.content}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.reportsDesktopColumn}>
                  <Text style={styles.reportsTitle}>Dernière synthèse IA</Text>
                  {lastSummary ? (
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryIcon}>
                        <Ionicons
                          name="sparkles"
                          size={24}
                          color="#2563EB"
                        />
                      </View>
                      <Text style={styles.summaryText}>{lastSummary}</Text>
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="sparkles-outline"
                        size={48}
                        color="#CBD5E1"
                      />
                      <Text style={styles.emptyText}>
                        Aucune synthèse disponible
                      </Text>
                      <Text style={styles.emptySubtext}>
                        L'IA créera une synthèse après tes échanges dans la
                        bulle
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {activeTab === 'booking' && (
              <View style={styles.bookingSection}>
                {therapistBookingUrl ? (
                  <>
                    <View style={styles.bookingHero}>
                      <View style={styles.bookingHeroIcon}>
                        <Ionicons
                          name="calendar"
                          size={28}
                          color="#2563EB"
                        />
                      </View>
                      <View style={styles.bookingHeroText}>
                        <Text style={styles.bookingHeroTitle}>
                          Prendre rendez-vous avec{' '}
                          {therapistName || 'ton thérapeute'}
                        </Text>
                        <Text style={styles.bookingHeroSubtitle}>
                          Choisis le créneau qui te convient le mieux, en toute
                          autonomie.
                        </Text>
                      </View>
                    </View>

                    {Platform.OS === 'web' && InlineWidget ? (
                      <View style={styles.calendlyContainer}>
                        <InlineWidget url={therapistBookingUrl} styles={{ height: '650px' }} />
                      </View>
                    ) : (
                      <View style={styles.bookingDesktopCard}>
                        <Text style={styles.bookingDesktopTitle}>
                          Calendrier en ligne
                        </Text>
                        <Text style={styles.bookingDesktopText}>
                          Tu seras redirigé(e) vers Calendly pour confirmer ton
                          rendez-vous avec {therapistName || 'ton thérapeute'}.
                        </Text>
                        <Pressable
                          style={styles.bookingCtaButton}
                          onPress={() =>
                            Linking.openURL(therapistBookingUrl)
                          }
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color="#FFFFFF"
                          />
                          <Text style={styles.bookingCtaButtonText}>
                            Ouvrir Calendly
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="time-outline"
                      size={48}
                      color="#CBD5E1"
                    />
                    <Text style={styles.emptyText}>
                      Prise de rendez-vous bientôt disponible
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Ton thérapeute n'a pas encore configuré la réservation en
                      ligne. N'hésite pas à lui en parler en séance.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {activeTab === 'bubble' && (
              <>
                {/* Card IA Bulle */}
                <View style={styles.aiCard}>
                  <View style={styles.aiIllustration}>
                    <Text style={styles.aiEmoji}>🤖</Text>
                  </View>
                  <Text style={styles.aiName}>Assistant IA</Text>
                  <Text style={styles.aiSubtext}>
                    Un espace sûr pour exprimer tes émotions, disponible 24/7
                  </Text>
                  <Pressable
                    style={styles.bubbleButton}
                    onPress={handleOpenChat}
                  >
                    <Text style={styles.bubbleButtonText}>
                      Entrer dans ma bulle
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>

                {/* Comment te sens-tu ? */}
                <View style={styles.moodSection}>
                  <Text style={styles.sectionTitle}>Comment te sens-tu ?</Text>
                  <View style={styles.moodButtons}>
                    <Pressable
                      style={[
                        styles.moodButton,
                        mood === 1 && styles.moodButtonActive,
                      ]}
                      onPress={() => handleSelectMood(1)}
                    >
                      <Text style={styles.moodEmoji}>😊</Text>
                      <Text
                        style={[
                          styles.moodButtonText,
                          mood === 1 && styles.moodButtonTextActive,
                        ]}
                      >
                        Bien
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.moodButton,
                        mood === 2 && styles.moodButtonActive,
                      ]}
                      onPress={() => handleSelectMood(2)}
                    >
                      <Text style={styles.moodEmoji}>😟</Text>
                      <Text
                        style={[
                          styles.moodButtonText,
                          mood === 2 && styles.moodButtonTextActive,
                        ]}
                      >
                        Difficile
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.moodButton,
                        mood === 3 && styles.moodButtonActiveDanger,
                      ]}
                      onPress={() => handleSelectMood(3)}
                    >
                      <Text style={styles.moodEmoji}>😰</Text>
                      <Text
                        style={[
                          styles.moodButtonText,
                          mood === 3 && styles.moodButtonTextActive,
                        ]}
                      >
                        Urgence
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Exercices rapides */}
                <View style={styles.exercisesSection}>
                  <Text style={styles.sectionTitle}>Exercices rapides</Text>
                  <View style={styles.exerciseItem}>
                    <View style={styles.exerciseIcon}>
                      <Ionicons name="fitness" size={24} color="#2563EB" />
                    </View>
                    <View style={styles.exerciseContent}>
                      <Text style={styles.exerciseTitle}>
                        Respiration profonde
                      </Text>
                      <Text style={styles.exerciseText}>
                        Inspire 4s, retiens 4s, expire 6s
                      </Text>
                    </View>
                  </View>
                  <View style={styles.exerciseItem}>
                    <View style={styles.exerciseIcon}>
                      <Ionicons name="walk" size={24} color="#2563EB" />
                    </View>
                    <View style={styles.exerciseContent}>
                      <Text style={styles.exerciseTitle}>
                        Marche de 5 minutes
                      </Text>
                      <Text style={styles.exerciseText}>
                        Sors prendre l'air pour apaiser ton esprit
                      </Text>
                    </View>
                  </View>
                  <View style={styles.exerciseItem}>
                    <View style={styles.exerciseIcon}>
                      <Ionicons name="call" size={24} color="#2563EB" />
                    </View>
                    <View style={styles.exerciseContent}>
                      <Text style={styles.exerciseTitle}>
                        Contacter un proche
                      </Text>
                      <Text style={styles.exerciseText}>
                        Parler peut vraiment aider à se sentir mieux
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {activeTab === 'reports' && (
              <>
                {/* Toggle Synthèses */}
                <View style={styles.reportsToggle}>
                  <Pressable
                    style={[
                      styles.reportsToggleButton,
                      reportsView === 'therapist' &&
                        styles.reportsToggleButtonActive,
                    ]}
                    onPress={() => setReportsView('therapist')}
                  >
                    <Text
                      style={[
                        styles.reportsToggleText,
                        reportsView === 'therapist' &&
                          styles.reportsToggleTextActive,
                      ]}
                    >
                      Thérapeute
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.reportsToggleButton,
                      reportsView === 'last' &&
                        styles.reportsToggleButtonActive,
                    ]}
                    onPress={() => setReportsView('last')}
                  >
                    <Text
                      style={[
                        styles.reportsToggleText,
                        reportsView === 'last' &&
                          styles.reportsToggleTextActive,
                      ]}
                    >
                      Dernière synthèse
                    </Text>
                  </Pressable>
                </View>

                {/* Contenu synthèses */}
                {reportsView === 'therapist' ? (
                  <View style={styles.reportsContent}>
                    <Text style={styles.reportsTitle}>
                      Constats de mon thérapeute
                    </Text>
                    {reports.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Ionicons
                          name="document-text-outline"
                          size={48}
                          color="#CBD5E1"
                        />
                        <Text style={styles.emptyText}>
                          Aucun constat pour le moment
                        </Text>
                        <Text style={styles.emptySubtext}>
                          Ton thérapeute peut noter ses observations ici après
                          vos séances
                        </Text>
                      </View>
                    ) : (
                      reports.map((report) => (
                        <View key={report._id} style={styles.reportCard}>
                          <View style={styles.reportHeader}>
                            <View
                              style={[
                                styles.reportBadge,
                                report.from === 'ai' &&
                                  styles.reportBadgeAi,
                              ]}
                            >
                              <Text style={styles.reportBadgeText}>
                                {report.from === 'therapist'
                                  ? 'Thérapeute'
                                  : 'IA'}
                              </Text>
                            </View>
                            <Text style={styles.reportDate}>
                              {formatDateTime(report.date)}
                            </Text>
                          </View>
                          <Text style={styles.reportContent}>
                            {report.content}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ) : (
                  <View style={styles.reportsContent}>
                    <Text style={styles.reportsTitle}>
                      Dernière synthèse IA
                    </Text>
                    {lastSummary ? (
                      <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                          <Ionicons
                            name="sparkles"
                            size={24}
                            color="#2563EB"
                          />
                        </View>
                        <Text style={styles.summaryText}>{lastSummary}</Text>
                      </View>
                    ) : (
                      <View style={styles.emptyState}>
                        <Ionicons
                          name="sparkles-outline"
                          size={48}
                          color="#CBD5E1"
                        />
                        <Text style={styles.emptyText}>
                          Aucune synthèse disponible
                        </Text>
                        <Text style={styles.emptySubtext}>
                          L'IA créera une synthèse après tes échanges dans la
                          bulle
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {activeTab === 'booking' && (
              <View style={styles.bookingSection}>
                {therapistBookingUrl ? (
                  <>
                    <View style={styles.bookingHero}>
                      <View style={styles.bookingHeroIcon}>
                        <Ionicons
                          name="calendar"
                          size={28}
                          color="#2563EB"
                        />
                      </View>
                      <View style={styles.bookingHeroText}>
                        <Text style={styles.bookingHeroTitle}>
                          Prendre rendez-vous avec{' '}
                          {therapistName || 'ton thérapeute'}
                        </Text>
                        <Text style={styles.bookingHeroSubtitle}>
                          Réserve facilement un créneau depuis ton téléphone.
                        </Text>
                      </View>
                    </View>

                    {Platform.OS === 'web' && InlineWidget ? (
                      <View style={styles.calendlyContainer}>
                        <InlineWidget url={therapistBookingUrl} styles={{ height: '650px' }} />
                      </View>
                    ) : (
                      <View style={styles.bookingMobileCard}>
                        <Text style={styles.bookingDesktopTitle}>
                          Calendrier en ligne
                        </Text>
                        <Text style={styles.bookingDesktopText}>
                          Tu seras redirigé(e) vers Calendly pour confirmer ton
                          rendez-vous avec {therapistName || 'ton thérapeute'}.
                        </Text>
                        <Pressable
                          style={styles.bookingCtaButton}
                          onPress={() =>
                            Linking.openURL(therapistBookingUrl)
                          }
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color="#FFFFFF"
                          />
                          <Text style={styles.bookingCtaButtonText}>
                            Ouvrir Calendly
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="time-outline"
                      size={48}
                      color="#CBD5E1"
                    />
                    <Text style={styles.emptyText}>
                      Prise de rendez-vous bientôt disponible
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Ton thérapeute n'a pas encore configuré la réservation en
                      ligne. N'hésite pas à lui en parler en séance.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Bottom Tab Menu (mobile uniquement) */}
        {!isDesktop && (
          <View style={styles.bottomTab}>
            <Pressable
              style={[
                styles.tabButton,
                activeTab === 'bubble' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('bubble')}
            >
              <Ionicons
                name={
                  activeTab === 'bubble'
                    ? 'chatbubbles'
                    : 'chatbubbles-outline'
                }
                size={24}
                color={activeTab === 'bubble' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'bubble' && styles.tabTextActive,
                ]}
              >
                Bulle
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === 'reports' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('reports')}
            >
              <Ionicons
                name={
                  activeTab === 'reports' ? 'reader' : 'reader-outline'
                }
                size={24}
                color={activeTab === 'reports' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'reports' && styles.tabTextActive,
                ]}
              >
                Synthèses
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === 'booking' && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab('booking')}
            >
              <Ionicons
                name={
                  activeTab === 'booking'
                    ? 'calendar'
                    : 'calendar-outline'
                }
                size={24}
                color={activeTab === 'booking' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'booking' && styles.tabTextActive,
                ]}
              >
                Rendez-vous
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDesktop: {
    alignItems: 'center',
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
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Pour le bottom tab
  },
  scrollContentDesktop: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerDesktop: {
    maxWidth: 960,
    width: '100%',
  },
  headerLeft: {
    flex: 1,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  greeting: {
    marginTop: 4,
    fontSize: 15,
    color: '#64748B',
  },
  logoutText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  menuButton: {
    padding: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  menuItemTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Onglets desktop (Bulle / Synthèses)
  desktopTabs: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  
  // Card IA Bulle
  aiCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  aiIllustration: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiEmoji: {
    fontSize: 48,
  },
  aiName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  aiSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  // Layout desktop pour l'onglet Bulle
  bubbleLayout: {
    flexDirection: 'column',
    gap: 24,
  },
  bubbleLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  bubbleLeft: {
  },
  bubbleRight: {
  },
  bubbleLeftDesktop: {
    flex: 3,
  },
  bubbleRightDesktop: {
    flex: 2,
  },
  bubbleButton: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
    width: '100%',
  },
  bubbleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Mood Section
  moodSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  moodButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  moodButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  moodButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  moodButtonActiveDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  moodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  moodButtonTextActive: {
    color: '#2563EB',
  },
  
  // Exercices
  exercisesSection: {
    marginBottom: 24,
  },
  bookingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  bookingText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  bookingButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  bookingButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  exerciseItem: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  exerciseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  exerciseText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  
  // Synthèses Toggle
  reportsToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
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
  
  // Reports Content
  reportsContent: {
    gap: 16,
  },
  reportsDesktopLayout: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  reportsDesktopColumn: {
    flex: 1,
  },

  // Booking (Rendez-vous)
  bookingSection: {
    gap: 24,
  },
  calendlyContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  bookingHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
  },
  bookingHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingHeroText: {
    flex: 1,
  },
  bookingHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  bookingHeroSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  bookingDesktopCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  bookingMobileCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  bookingDesktopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  bookingDesktopText: {
    fontSize: 14,
    color: '#CBD5F5',
    lineHeight: 20,
  },
  bookingCtaButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  bookingCtaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
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
  reportDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  reportContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
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
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomTabDesktop: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    left: 'auto',
    right: 'auto',
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
});
