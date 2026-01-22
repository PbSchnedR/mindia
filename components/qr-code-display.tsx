import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
}

export function QRCodeDisplay({ 
  value, 
  size = 180, 
  backgroundColor = 'white',
  color = '#111827'
}: QRCodeDisplayProps) {
  const [QRCodeSvg, setQRCodeSvg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(Platform.OS !== 'web');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sur mobile, charger dynamiquement le composant QR
    if (Platform.OS !== 'web') {
      console.log('[QRCode] Chargement de react-native-qrcode-svg...');
      import('react-native-qrcode-svg')
        .then((module) => {
          console.log('[QRCode] Module chargé avec succès');
          setQRCodeSvg(() => module.default);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('[QRCode] Erreur chargement react-native-qrcode-svg:', err);
          setError(err.message);
          setIsLoading(false);
        });
    }
  }, []);

  // Sur le web, on utilise une API externe pour générer le QR code
  if (Platform.OS === 'web') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=${backgroundColor.replace('#', '')}&color=${color.replace('#', '')}`;
    
    return (
      <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
        <Image 
          source={{ uri: qrUrl }}
          style={{ width: size, height: size, borderRadius: 8 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // En cours de chargement
  if (isLoading) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <ThemedText style={styles.fallbackText}>...</ThemedText>
      </View>
    );
  }

  // Si erreur de chargement, afficher le message
  if (error) {
    console.log('[QRCode] Utilisation du fallback API (erreur:', error, ')');
  }

  // Si le composant n'est pas disponible, afficher une image via API
  if (!QRCodeSvg) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=${backgroundColor.replace('#', '')}&color=${color.replace('#', '')}`;
    
    return (
      <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
        <Image 
          source={{ uri: qrUrl }}
          style={{ width: size, height: size, borderRadius: 8 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Sur mobile avec react-native-qrcode-svg
  return (
    <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
      <QRCodeSvg
        value={value}
        size={size}
        backgroundColor={backgroundColor}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  fallbackText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});
