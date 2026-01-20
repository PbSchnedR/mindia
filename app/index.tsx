import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LandingScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#FCE7F3', dark: '#020617' }}
      headerImage={<Image source={require('@/assets/images/splash-icon.png')} style={styles.heroImage} />}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="subtitle">Projet avec le J</ThemedText>
        <ThemedText type="title">Relais entre les séances</ThemedText>
        <ThemedText>
          Une bulle de parole continue entre les séances, pour les patients et les thérapeutes. MVP centré
          sur les moments de down.
        </ThemedText>
      </ThemedView>

      <View style={styles.cardsRow}>
        <Card style={styles.card}>
          <ThemedText type="subtitle">Espace patient</ThemedText>
          <ThemedText style={styles.cardText}>
            Rejoins ta bulle sécurisée en scannant le QR code donné par ton thérapeute. Disponible 24h/24.
          </ThemedText>
          <Link href="/patient" asChild>
            <Button title="Scanner mon QR code" />
          </Link>
        </Card>
      </View>

      <View style={styles.cardsRow}>
        <Card style={styles.card}>
          <ThemedText type="subtitle">Espace thérapeute</ThemedText>
          <ThemedText style={styles.cardText}>
            Visualise les moments-clés entre deux séances, sans remplacer la relation humaine.
          </ThemedText>
          <Link href="/therapist" asChild>
            <Button title="Espace thérapeute" variant="secondary" />
          </Link>
        </Card>
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    gap: 8,
    marginBottom: 24,
  },
  heroImage: {
    height: 160,
    width: 160,
    borderRadius: 32,
    position: 'absolute',
    bottom: 8,
    right: 16,
  },
  cardsRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  card: {
    gap: 12,
  },
  cardText: {
    fontSize: 14,
    opacity: 0.8,
  },
});
