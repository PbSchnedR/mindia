import { useRouter, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  appendMessage,
  listChatSessionsForPatient,
  startChatSession,
} from '@/lib/chat';
import { useSession } from '@/lib/session-context';
import type { ChatMessage } from '@/lib/types';

export default function PatientChatScreen() {
  const { session, signOut, loading: sessionLoading } = useSession();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const bg = useThemeColor({}, 'background');

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!rootNavState?.key) return;
    if (!session || session.role !== 'patient') {
      const timeout = setTimeout(() => router.replace('/patient'), 0);
      return () => clearTimeout(timeout);
    }

    (async () => {
      setLoading(true);
      try {
        const sessions = await listChatSessionsForPatient(session.patientId);
        if (sessions.length > 0) {
          const latest = sessions[0];
          setChatId(latest.id);
          setMessages(latest.messages);
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

  // Réponses mockées de l'IA (sera remplacé par vraie IA plus tard)
  const getMockAIResponse = (userMessage: string): string => {
    const lowercaseMessage = userMessage.toLowerCase();
    
    // Détection de mots-clés pour des réponses contextuelles
    if (lowercaseMessage.includes('stress') || lowercaseMessage.includes('stressé')) {
      return "Je comprends que tu te sentes stressé·e. Le stress peut être difficile à gérer. As-tu essayé des techniques de respiration ou une courte pause ? Parfois, prendre quelques minutes pour soi peut vraiment aider.";
    }
    
    if (lowercaseMessage.includes('anxieux') || lowercaseMessage.includes('angoisse') || lowercaseMessage.includes('peur')) {
      return "L'anxiété peut être envahissante. Ce que tu ressens est valide. Prendre le temps de mettre des mots sur ce qui t'angoisse peut déjà aider. Y a-t-il quelque chose de précis qui déclenche cette sensation ?";
    }
    
    if (lowercaseMessage.includes('triste') || lowercaseMessage.includes('tristesse') || lowercaseMessage.includes('déprim')) {
      return "Merci d'avoir partagé ce que tu ressens. La tristesse fait partie de l'expérience humaine. As-tu pu identifier ce qui a pu déclencher ce sentiment ? Parfois, en parler à quelqu'un de confiance peut soulager.";
    }
    
    if (lowercaseMessage.includes('colère') || lowercaseMessage.includes('énervé') || lowercaseMessage.includes('furieux')) {
      return "Je vois que tu ressens de la colère. C'est une émotion intense mais normale. Essaie de respirer profondément quelques instants. Qu'est-ce qui a provoqué cette colère ? L'identifier peut aider à la canaliser.";
    }
    
    if (lowercaseMessage.includes('fatigue') || lowercaseMessage.includes('fatigué') || lowercaseMessage.includes('épuis')) {
      return "La fatigue peut être à la fois physique et mentale. Ton corps et ton esprit te demandent peut-être de ralentir. As-tu pu prendre des moments de repos récemment ?";
    }
    
    if (lowercaseMessage.includes('dormir') || lowercaseMessage.includes('sommeil') || lowercaseMessage.includes('insomnie')) {
      return "Le sommeil est essentiel pour ton bien-être. Si tu as des difficultés à dormir, essaie d'établir une routine apaisante le soir : pas d'écrans, lumière tamisée, lecture... En parles-tu avec ton thérapeute ?";
    }
    
    if (lowercaseMessage.includes('mieux') || lowercaseMessage.includes('bien') || lowercaseMessage.includes('content')) {
      return "C'est vraiment positif de te sentir mieux ! Continue à prendre soin de toi et à identifier ce qui te fait du bien. Ces moments sont précieux.";
    }
    
    if (lowercaseMessage.includes('merci')) {
      return "De rien, je suis là pour ça. N'hésite pas à revenir quand tu en as besoin. Ta démarche de prendre soin de toi est courageuse.";
    }
    
    // Réponses génériques variées
    const genericResponses = [
      "Merci d'avoir partagé ça. Ce que tu ressens est important. Peux-tu m'en dire un peu plus sur ce qui se passe pour toi en ce moment ?",
      "Je t'écoute. Prends ton temps pour mettre des mots sur ce que tu vis. Les actions proposées ci-dessous peuvent aussi t'aider.",
      "C'est courageux de ta part d'exprimer ce que tu ressens. As-tu identifié ce qui pourrait t'aider à te sentir mieux là, maintenant ?",
      "Merci de te confier. Ton ressenti est légitime. N'hésite pas à essayer l'une des actions proposées juste en dessous si tu t'en sens capable.",
      "Je comprends. Chaque émotion a sa place. Regarde les suggestions ci-dessous et choisis ce qui te semble faisable maintenant.",
    ];
    
    return genericResponses[Math.floor(Math.random() * genericResponses.length)];
  };

  const handleSend = async () => {
    if (!chatId || !session || session.role !== 'patient') return;
    if (!currentText.trim()) return;
    setSending(true);
    try {
      // Envoyer le message du patient
      const updated = await appendMessage(chatId, 'patient', currentText);
      setMessages(updated.messages);
      
      const userMessage = currentText;
      setCurrentText('');

      // Attendre un peu pour simuler le "typing" de l'IA
      await new Promise(resolve => setTimeout(resolve, 800));

      // Réponse mockée de l'IA (contextuelle)
      const aiResponse = getMockAIResponse(userMessage);
      const auto = await appendMessage(chatId, 'ai', aiResponse);
      setMessages(auto.messages);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', "Le message n'a pas pu être envoyé.");
    } finally {
      setSending(false);
    }
  };

  const handleBackToDashboard = () => {
    router.replace('/patient/dashboard');
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Déconnexion',
      'Es-tu sûr·e de vouloir te déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return <Bubble message={item} />;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1, backgroundColor: bg }}>
      <ThemedView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Bulle de parole</ThemedText>
            <ThemedText style={styles.headerDescription}>
              Tu peux écrire librement. Ce que tu partages est synthétisé pour ton thérapeute.
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={handleBackToDashboard} hitSlop={10} style={styles.headerActionButton}>
              <Text style={styles.headerIcon}>↩</Text>
              <Text style={styles.backText}>Retour</Text>
            </Pressable>
            <Pressable onPress={handleSignOut} hitSlop={10} style={styles.headerActionButton}>
              <Text style={styles.headerIcon}>⎋</Text>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          style={{ flex: 1 }}
        />


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
            En cas de danger immédiat, appelle le 15 / 112 ou les services d'urgence de ton pays.
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  header: {
    flex: 1,
    gap: 6,
  },
  headerDescription: {
    opacity: 0.8,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 12,
  },
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  headerIcon: {
    fontSize: 14,
    color: '#94A3B8',
  },
  backText: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  logoutText: {
    fontSize: 14,
    color: '#9CA3AF',
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
