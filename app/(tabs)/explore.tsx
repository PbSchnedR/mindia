import { StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';

export default function AboutScreen() {
  return (
    <ParallaxScrollView headerBackgroundColor={{ light: '#E5E7EB', dark: '#020617' }}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Pourquoi cette appli ?</ThemedText>
      </ThemedView>

      <Card style={styles.card}>
        <ThemedText type="subtitle">Constat</ThemedText>
        <ThemedText style={styles.text}>
          1 jeune sur 3 déclare des symptômes d’anxiété ou de dépression, avec une forte hausse des
          consultations. Pourtant, entre deux séances, les patients restent souvent seuls face aux
          crises.
        </ThemedText>
      </Card>

      <View style={styles.spacer} />

      <Card style={styles.card}>
        <ThemedText type="subtitle">Promesse</ThemedText>
        <ThemedText style={styles.text}>
          Offrir un espace de confiance continu: un bot d’écoute disponible 24h/24, connecté à un
          thérapeute humain, avec un suivi synthétique et visuel des moments clés.
        </ThemedText>
      </Card>

      <View style={styles.spacer} />

      <Card style={styles.card}>
        <ThemedText type="subtitle">MVP testé ici</ThemedText>
        <ThemedText style={styles.text}>
          - Bulle de discussion patient (IA / psy / patient){'\n'}
          - Auto-évaluation en 3 niveaux{'\n'}
          - Synthèse simple dans l’espace pro thérapeute{'\n'}
          - Lien de prise de RDV simulé (Doctolib / Médoucine)
        </ThemedText>
      </Card>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  card: {
    gap: 8,
  },
  text: {
    fontSize: 14,
    opacity: 0.85,
  },
  spacer: {
    height: 12,
  },
});
