import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SeverityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  appendMessage,
  listChatSessionsForPatient,
  setSeverity,
  setSummaryAndKeywords,
  simpleAutoSummary,
  startChatSession,
} from '@/lib/chat';
import { useSession } from '@/lib/session-context';
import type { ChatMessage, Severity } from '@/lib/types';

export default function PatientChatScreen() {
  const { session } = useSession();
  const router = useRouter();
  const bg = useThemeColor({}, 'background');

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [severity, setSeverityLocal] = useState<Severity | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.role !== 'patient') {
      router.replace('/patient');
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const sessions = await listChatSessionsForPatient(session.patientId);
        if (sessions.length > 0) {
          const latest = sessions[0];
          setChatId(latest.id);
          setMessages(latest.messages);
          setSeverityLocal(latest.severity);
        } else {
          const created = await startChatSession(session.patientId, session.therapistId);
          setChatId(created.id);
          setMessages(created.messages);
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Erreur', 'Impossible de charger la conversation.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, router]);

  const handleSend = async () => {
    if (!chatId || !session || session.role !== 'patient') return;
    if (!currentText.trim()) return;
    setSending(true);
    try {
      const updated = await appendMessage(chatId, 'patient', currentText);
      setMessages(updated.messages);
      setCurrentText('');

      // Réponse très simple simulée côté IA
      const auto = await appendMessage(
        chatId,
        'ai',
        "Merci de l’avoir formulé. Regarde les actions proposées juste en dessous et choisis ce qui te semble possible maintenant."
      );
      setMessages(auto.messages);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Le message n’a pas pu être envoyé.');
    } finally {
      setSending(false);
    }
  };

  const handleSelectSeverity = async (value: Severity) => {
    if (!chatId) return;
    try {
      const updated = await setSeverity(chatId, value);
      setSeverityLocal(updated.severity);

      const { summary, keywords } = simpleAutoSummary(updated.messages);
      await setSummaryAndKeywords(chatId, summary, keywords);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de sauvegarder ton ressenti.');
    }
  };

  const quickActions = useMemo(
    () => [
      {
        id: 'walk',
        title: 'Sortir marcher 5–10 min',
        text: "Je choisis d’essayer de sortir marcher quelques minutes pour faire redescendre la pression.",
      },
      {
        id: 'breath',
        title: 'Exercice de respiration',
        text: "Je vais prendre 3 minutes pour faire un exercice de respiration (inspiration 4s, pause 4s, expiration 6s).",
      },
      {
        id: 'friend',
        title: 'Appeler un proche',
        text: "Je choisis d’écrire / d’appeler un ami ou un proche pour ne pas rester seul·e avec ça.",
      },
    ],
    []
  );

  const handleQuickAction = async (text: string) => {
    setCurrentText(text);
    await handleSend();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return <Bubble message={item} />;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1, backgroundColor: bg }}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Bulle de parole</ThemedText>
          <ThemedText type="title">Entre deux séances</ThemedText>
          <ThemedText>
            Tu peux écrire librement. Ce que tu partages est synthétisé pour ton thérapeute, pour vos
            prochaines séances.
          </ThemedText>
        </View>

        <Card style={styles.severityCard}>
          <View style={styles.severityHeader}>
            <ThemedText type="subtitle">Comment tu te situes là, tout de suite ?</ThemedText>
            <SeverityBadge severity={severity} />
          </View>
          <View style={styles.severityRow}>
            <Button
              title="Plutôt gérable"
              variant={severity === 1 ? 'primary' : 'secondary'}
              onPress={() => handleSelectSeverity(1)}
            />
            <Button
              title="En difficulté"
              variant={severity === 2 ? 'primary' : 'secondary'}
              onPress={() => handleSelectSeverity(2)}
            />
            <Button
              title="Crise / urgence"
              variant={severity === 3 ? 'danger' : 'secondary'}
              onPress={() => handleSelectSeverity(3)}
            />
          </View>
        </Card>

        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          style={{ flex: 1 }}
          inverted
        />

        <View style={styles.quickActions}>
          {quickActions.map((a) => (
            <Button key={a.id} title={a.title} variant="ghost" onPress={() => handleQuickAction(a.text)} />
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            placeholder="Écris ici ce qui se passe pour toi…"
            placeholderTextColor="#9BA1A6"
            multiline
            style={styles.input}
            value={currentText}
            onChangeText={setCurrentText}
          />
          <Button title="Envoyer" onPress={handleSend} loading={sending} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            En cas de danger immédiat, appelle le 15 / 112 ou les services d’urgence de ton pays.
          </Text>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isPatient = message.author === 'patient';
  const isAi = message.author === 'ai';
  const isTherapist = message.author === 'therapist';

  const bgColor = isPatient ? '#DBEAFE' : isAi ? '#EEF2FF' : '#DCFCE7';
  const align = isPatient ? 'flex-end' : 'flex-start';
  const label = isPatient ? 'Toi' : isAi ? 'IA' : 'Psy';

  return (
    <View style={[styles.bubbleContainer, { alignItems: align }]}>
      <View style={[styles.bubble, { backgroundColor: bgColor }]}>
        <Text style={styles.bubbleLabel}>{label}</Text>
        <Text style={styles.bubbleText}>{message.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  severityCard: {
    gap: 12,
  },
  severityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  messages: {
    gap: 6,
    paddingVertical: 8,
  },
  bubbleContainer: {
    width: '100%',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.7,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 15,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
  },
  footer: {
    marginTop: 6,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

