import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/session-context';
import { getTherapistById } from '@/lib/people';
import { api } from '@/lib/api';

export default function TherapistSettingsScreen() {
  const router = useRouter();
  const { session, signOut, loading: sessionLoading } = useSession();
  const { width } = useWindowDimensions();

  const [therapistName, setTherapistName] = useState<string>('');
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const [savingBookingUrl, setSavingBookingUrl] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= 1024;

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
          setTherapistName(`${therapist.firstName} ${therapist.lastName}`.trim());
          if (therapist.bookingUrl) {
            setBookingUrl(therapist.bookingUrl);
          }
        }
      } catch (e: any) {
        console.error('Erreur chargement paramètres thérapeute:', e);
        setError("Impossible de charger vos paramètres. Réessayez plus tard.");
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

  if (sessionLoading || loading) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={[styles.container, styles.centerContent]}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={[styles.container, styles.centerContent]}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Oups !</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Button
              title="Revenir à mes patients"
              onPress={() => router.replace('/therapist/dashboard')}
              style={{ marginTop: 16 }}
            />
            <Button
              title="Se déconnecter"
              variant="secondary"
              onPress={handleSignOut}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.safeArea} />
        {/* Header */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <Pressable onPress={() => router.push('/therapist/dashboard')} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Paramètres du compte</Text>
            <Text style={styles.headerSubtitle}>
              Connecté en tant que {therapistName || session?.email}
            </Text>
          </View>
          {isDesktop ? (
            <Pressable onPress={handleSignOut} hitSlop={10}>
              <Text style={styles.headerLogoutDesktop}>Déconnexion</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setMenuOpen(!menuOpen)}
              hitSlop={10}
              style={styles.menuButton}
            >
              <Ionicons
                name={menuOpen ? 'close' : 'menu'}
                size={28}
                color="#1E293B"
              />
            </Pressable>
          )}
        </View>

        {!isDesktop && menuOpen && (
          <View style={[styles.menuCard, isDesktop && styles.menuCardDesktop]}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push('/therapist/dashboard');
              }}
            >
              <Ionicons name="people-outline" size={20} color="#1E293B" />
              <Text style={styles.menuItemText}>Mes patients</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.menuItemTextDanger}>Déconnexion</Text>
            </Pressable>
          </View>
        )}

        <View
          style={[
            styles.settingsContainer,
            isDesktop && styles.settingsContainerDesktop,
          ]}
        >
          {/* Carte prise de rendez-vous en ligne */}
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <View style={styles.settingsHeaderIcon}>
                <Ionicons name="calendar" size={20} color="#2563EB" />
              </View>
              <View style={styles.settingsHeaderText}>
                <Text style={styles.settingsTitle}>Prise de rendez-vous en ligne</Text>
                <Text style={styles.settingsSubtitle}>
                  Ajoutez votre lien Calendly, Doctolib ou tout autre agenda pour permettre à vos patients de réserver un créneau.
                </Text>
              </View>
            </View>

            <View style={styles.settingsInputRow}>
              <Text style={styles.inputLabel}>Lien Calendly / Doctolib</Text>
              <TextInput
                placeholder="https://calendly.com/mon-cabinet"
                placeholderTextColor="#94A3B8"
                value={bookingUrl}
                onChangeText={setBookingUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
            </View>

            <View style={styles.settingsFooter}>
              <Text style={styles.settingsHint}>
                Ce lien sera affiché dans l’espace patient pour prendre rendez-vous avec vous.
              </Text>
              <Button
                title="Enregistrer"
                onPress={async () => {
                  if (!session || session.role !== 'therapist') return;
                  try {
                    setSavingBookingUrl(true);
                    await api.users.update(session.therapistId, {
                      bookingUrl: bookingUrl.trim() || null,
                    });
                    Alert.alert('Succès', 'Lien de rendez-vous mis à jour.');
                  } catch (e: any) {
                    console.error('Erreur mise à jour bookingUrl:', e);
                    Alert.alert(
                      'Erreur',
                      e?.message ||
                        'Impossible de mettre à jour le lien. Réessayez plus tard.'
                    );
                  } finally {
                    setSavingBookingUrl(false);
                  }
                }}
                loading={savingBookingUrl}
                disabled={savingBookingUrl}
              />
            </View>
          </View>

          {/* Placeholder pour futurs paramètres du compte */}
          <View style={styles.futureSettingsCard}>
            <Text style={styles.futureSettingsTitle}>Autres paramètres à venir</Text>
            <Text style={styles.futureSettingsText}>
              Ici vous pourrez bientôt configurer d’autres éléments de votre compte (profil, notifications, etc.).
            </Text>
          </View>
        </View>
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
    backgroundColor: '#F8FAFC',
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 16,
  },
  headerDesktop: {
    maxWidth: 960,
    width: '100%',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  headerLogoutDesktop: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
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
  menuCardDesktop: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: '#1E293B',
  },
  menuItemTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
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
    elevation: 3,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  settingsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingsContainerDesktop: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  settingsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  settingsHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsHeaderText: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  settingsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  settingsInputRow: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  settingsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  settingsHint: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
  },
  futureSettingsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  futureSettingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  futureSettingsText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});

