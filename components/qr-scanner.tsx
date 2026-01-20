import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScan: (data: string) => void;
  onCancel?: () => void;
}

export function QRScanner({ onScan, onCancel }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Sur le web, le scanner de caméra ne fonctionne pas bien
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallback}>
        <ThemedText style={styles.webText}>
          Le scan QR n'est pas disponible sur le web.
        </ThemedText>
        <ThemedText style={styles.webSubtext}>
          Utilisez l'application mobile pour scanner le QR code.
        </ThemedText>
        {onCancel && (
          <Button title="Retour" variant="secondary" onPress={onCancel} style={{ marginTop: 16 }} />
        )}
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ThemedText>Chargement...</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <ThemedText style={styles.permissionText}>
          L'accès à la caméra est nécessaire pour scanner le QR code.
        </ThemedText>
        <Button title="Autoriser la caméra" onPress={requestPermission} />
        {onCancel && (
          <Button title="Annuler" variant="secondary" onPress={onCancel} style={{ marginTop: 12 }} />
        )}
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <ThemedText style={styles.hint}>
            Place le QR code dans le cadre
          </ThemedText>
        </View>
      </CameraView>
      {onCancel && (
        <View style={styles.cancelButton}>
          <Button title="Annuler" variant="secondary" onPress={onCancel} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  hint: {
    marginTop: 24,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  webSubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});
