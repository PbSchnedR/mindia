import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, Text, Modal, TextInput, Alert, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
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
  
  // État pour le modal de création de patient
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPatientUsername, setNewPatientUsername] = useState('');
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    
    if (!session || session.role !== 'therapist') {
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
        if (err?.status === 401 || err?.message?.toLowerCase().includes('token')) {
          await handleSignOut();
        } else {
          setError('Une erreur est survenue. Vérifiez votre connexion et réessayez.');
        }
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
      
      setNewPatientUsername('');
      setNewPatientEmail('');
      setShowCreateModal(false);
      
      await loadPatients();
      
      Alert.alert('Succès', 'Patient créé avec succès');
    } catch (error: any) {
      setCreateError(error?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const getMoodIcon = (severity?: number) => {
    if (severity === 1) return { emoji: '😊', color: '#10B981', label: 'Bien' };
    if (severity === 2) return { emoji: '😟', color: '#F59E0B', label: 'Difficile' };
    if (severity === 3) return { emoji: '😰', color: '#EF4444', label: 'Urgence' };
    return { emoji: '😐', color: '#94A3B8', label: 'Non renseigné' };
  };

  const renderPatient = ({ item }: { item: PatientRow }) => {
    const mood = getMoodIcon(item.lastSeverity);
    
    return (
      <Pressable
        onPress={() => {
          router.push(`/therapist/patient/${item.id}`);
        }}
        style={styles.patientCard}
      >
        <View style={styles.patientHeader}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={styles.patientMeta}>
              {item.therapyTopic ?? 'Sujet non renseigné'} · {item.sessionsDone ?? 0} séances
            </Text>
          </View>
          <View style={[styles.moodBadge, { backgroundColor: `${mood.color}20` }]}>
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
          </View>
        </View>
        
        {item.lastSummary ? (
          <Text style={styles.lastSummary} numberOfLines={2}>
            {item.lastSummary}
          </Text>
        ) : (
          <Text style={styles.lastSummaryEmpty}>
            Aucune remontée de la bulle pour l'instant
          </Text>
        )}
      </Pressable>
    );
  };

  if (sessionLoading || loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Oups !</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Button title="Réessayer" onPress={handleRetry} style={{ marginTop: 16 }} />
          <Button title="Se déconnecter" variant="secondary" onPress={handleSignOut} style={{ marginTop: 8 }} />
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
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Mes Patients</Text>
            <Text style={styles.headerSubtitle}>
              Bonjour {therapistName || 'Docteur'}
            </Text>
          </View>
          <Pressable onPress={() => setMenuOpen(!menuOpen)} hitSlop={10} style={styles.menuButton}>
            <Ionicons name={menuOpen ? "close" : "menu"} size={28} color="#1E293B" />
          </Pressable>
        </View>

        {menuOpen && (
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.menuItemTextDanger}>Déconnexion</Text>
            </Pressable>
          </View>
        )}

        {/* Bouton ajouter patient */}
        <View style={styles.actionButtonContainer}>
          <Pressable 
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="#2563EB" />
            <Text style={styles.addButtonText}>Ajouter un patient</Text>
          </Pressable>
        </View>

        {/* Liste des patients */}
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={renderPatient}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>Aucun patient pour l'instant</Text>
              <Text style={styles.emptySubtext}>
                Ajoutez votre premier patient pour commencer le suivi
              </Text>
            </View>
          )}
        />

        {/* Modal de création de patient */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau patient</Text>
              <Pressable onPress={() => setShowCreateModal(false)} hitSlop={10}>
                <Ionicons name="close" size={28} color="#1E293B" />
              </Pressable>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nom d'utilisateur</Text>
                <TextInput
                  placeholder="Ex: Jean Dupont"
                  placeholderTextColor="#94A3B8"
                  value={newPatientUsername}
                  onChangeText={setNewPatientUsername}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  placeholder="jean.dupont@exemple.com"
                  placeholderTextColor="#94A3B8"
                  value={newPatientEmail}
                  onChangeText={setNewPatientEmail}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {createError && (
                <Text style={styles.errorText}>{createError}</Text>
              )}
            </View>

            <View style={styles.modalFooter}>
              <Button 
                title="Annuler" 
                variant="secondary" 
                onPress={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                  setNewPatientUsername('');
                  setNewPatientEmail('');
                }}
              />
              <Button 
                title="Créer" 
                onPress={handleCreatePatient}
                loading={creating}
                disabled={!newPatientUsername.trim() || !newPatientEmail.trim()}
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
  centerContent: {
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
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
  actionButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  patientCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientInfo: {
    flex: 1,
    gap: 4,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  patientMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  moodBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 24,
  },
  lastSummary: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  lastSummaryEmpty: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
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
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1E293B',
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
});
