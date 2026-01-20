import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, Text, Modal, TextInput, Alert } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SeverityBadge } from '@/components/ui/badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { listChatSessionsForTherapist } from '@/lib/chat';
import { useSession } from '@/lib/session-context';
import { getTherapistById, listPatientsForTherapist } from '@/lib/people';
import { api } from '@/lib/api';
import type { ChatSession, Patient } from '@/lib/types';

type PatientRow = Patient & {
  lastSeverity?: number;
  lastSummary?: string;
  lastDate?: string;
};

export default function TherapistDashboardScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const [therapistName, setTherapistName] = useState<string>('');
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const burgerColor = useThemeColor({}, 'text');
  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  
  // État pour le modal de création de patient
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPatientUsername, setNewPatientUsername] = useState('');
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    // Attendre que la session soit chargée
    if (sessionLoading) return;
    
    // Rediriger si pas de session (mais seulement après le chargement)
    if (!session || session.role !== 'therapist') {
      // Utiliser setTimeout pour éviter l'erreur de navigation avant le montage
      const timeout = setTimeout(() => {
        router.replace('/therapist');
      }, 0);
      return () => clearTimeout(timeout);
    }
    
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const therapist = await getTherapistById(session.therapistId);
        if (therapist) {
          setTherapistName(`${therapist.firstName} ${therapist.lastName}`);
        }
        await loadPatients();
      } catch (err: any) {
        console.error('Erreur chargement dashboard:', err);
        setError('Une erreur est survenue. Vérifiez votre connexion et réessayez.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, sessionLoading, router]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/');
  };

  const loadPatients = async () => {
    if (!session || session.role !== 'therapist') return;
    
    try {
      const p = await listPatientsForTherapist(session.therapistId);
      const sessions = await listChatSessionsForTherapist(session.therapistId);

      const byPatient: Record<string, ChatSession | undefined> = {};
      for (const s of sessions) {
        const existing = byPatient[s.patientId];
        if (!existing || existing.createdAt < s.createdAt) {
          byPatient[s.patientId] = s;
        }
      }

      const rows: PatientRow[] = p.map((pt) => {
        const last = byPatient[pt.id];
        return {
          ...pt,
          lastSeverity: last?.severity,
          lastSummary: last?.summary,
          lastDate: last?.createdAt,
        };
      });
      setPatients(rows);
      setError(null);
    } catch (err: any) {
      console.error('Erreur chargement patients:', err);
      setError('Impossible de charger les patients. Réessayez plus tard.');
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPatients();
    } catch (err) {
      setError('Une erreur est survenue. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!session || session.role !== 'therapist') return;
    
    setCreateError(null);
    
    if (!newPatientUsername.trim() || !newPatientEmail.trim()) {
      setCreateError('Nom d\'utilisateur et email requis');
      return;
    }

    setCreating(true);
    try {
      await api.users.createPatient(session.therapistId, {
        username: newPatientUsername.trim(),
        email: newPatientEmail.trim().toLowerCase(),
      });
      
      // Réinitialiser le formulaire
      setNewPatientUsername('');
      setNewPatientEmail('');
      setShowCreateModal(false);
      
      // Recharger la liste des patients
      await loadPatients();
      
      Alert.alert('Succès', 'Patient créé avec succès');
    } catch (error: any) {
      setCreateError(error?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const renderPatient = ({ item }: { item: PatientRow }) => {
    return (
      <Pressable
        onPress={() => {
          router.push(`/therapist/patient/${item.id}`);
        }}>
        <Card style={styles.patientCard}>
          <View style={styles.patientHeader}>
            <ThemedText type="defaultSemiBold">
              {item.firstName} {item.lastName}
            </ThemedText>
            <SeverityBadge severity={item.lastSeverity as any} />
          </View>
          <ThemedText style={styles.patientMeta}>
            {item.therapyTopic ?? 'Sujet non renseigné'} · {item.sessionsDone ?? 0} séances suivies
          </ThemedText>
          {item.lastSummary ? (
            <ThemedText style={styles.lastSummary}>
              Dernière remontée: {item.lastSummary}
            </ThemedText>
          ) : (
            <ThemedText style={styles.lastSummaryEmpty}>Aucune remontée via la bulle pour l’instant.</ThemedText>
          )}
        </Card>
      </Pressable>
    );
  };

  // Afficher un loader pendant le chargement de la session
  if (sessionLoading || loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText>Chargement...</ThemedText>
      </ThemedView>
    );
  }

  // Afficher une erreur si l'API n'est pas accessible
  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Card style={styles.errorCard}>
          <ThemedText type="subtitle" style={styles.errorTitle}>Oups !</ThemedText>
          <ThemedText style={styles.errorMessage}>{error}</ThemedText>
          <Button title="Réessayer" onPress={handleRetry} style={{ marginTop: 16 }} />
          <Button title="Se déconnecter" variant="secondary" onPress={handleSignOut} style={{ marginTop: 8 }} />
        </Card>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 6 }}>
          <ThemedText type="subtitle">Espace thérapeute</ThemedText>
          <ThemedText>
            {therapistName ? `Bonjour ${therapistName}` : 'Bonjour'} — voici les patients liés à votre bulle.
          </ThemedText>
        </View>
        <View style={styles.menuWrapper}>
          <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={10}>
            <Text style={[styles.burger, { color: burgerColor }]}>☰</Text>
          </Pressable>
          {menuOpen && (
            <Card style={styles.menuCard}>
              <ThemedText type="defaultSemiBold">Menu</ThemedText>
              <Button title="Mes infos (bientôt)" variant="ghost" onPress={() => setMenuOpen(false)} />
              <Button title="Paramètres (bientôt)" variant="ghost" onPress={() => setMenuOpen(false)} />
              <Button title="Déconnexion" variant="danger" onPress={handleSignOut} />
            </Card>
          )}
        </View>
      </View>

      <Button 
        title="+ Ajouter un patient" 
        onPress={() => setShowCreateModal(true)}
        style={{ marginTop: 8 }}
      />

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={renderPatient}
        ListEmptyComponent={() => (
          <Card style={styles.emptyCard}>
            <ThemedText style={styles.emptyText}>
              Aucun patient pour l'instant. Ajoutez votre premier patient !
            </ThemedText>
          </Card>
        )}
      />

      {/* Modal de création de patient */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: bg }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Nouveau patient
            </ThemedText>
            
            <TextInput
              placeholder="Nom d'utilisateur"
              placeholderTextColor="#9BA1A6"
              value={newPatientUsername}
              onChangeText={setNewPatientUsername}
              style={[styles.input, { color: '#11181C' }]}
              autoCapitalize="none"
            />
            
            <TextInput
              placeholder="Email"
              placeholderTextColor="#9BA1A6"
              value={newPatientEmail}
              onChangeText={setNewPatientEmail}
              style={[styles.input, { color: '#11181C' }]}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {createError && (
              <ThemedText style={styles.errorText}>{createError}</ThemedText>
            )}

            <View style={styles.modalButtons}>
              <Button 
                title="Annuler" 
                variant="secondary" 
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
              />
              <Button 
                title="Créer" 
                onPress={handleCreatePatient}
                loading={creating}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
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
  errorMessage: {
    textAlign: 'center',
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  menuWrapper: {
    position: 'relative',
  },
  burger: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuCard: {
    position: 'absolute',
    top: 32,
    right: 0,
    width: 200,
    gap: 6,
    zIndex: 30,
    elevation: 8,
  },
  patientCard: {
    gap: 6,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientMeta: {
    fontSize: 13,
    opacity: 0.9,
  },
  lastSummary: {
    fontSize: 13,
    opacity: 0.9,
  },
  lastSummaryEmpty: {
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
});

