import React, { useEffect, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkForUpdate, showOptionalUpdateAlert } from '../utils/forceUpdate';

/** Keep a mandatory update visible when the store opens or the app resumes. */
export default function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const [requiredUrl, setRequiredUrl] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    checkForUpdate().then(result => {
      if (!active || !result.updateUrl) return;
      if (result.updateRequired) setRequiredUrl(result.updateUrl);
      else if (result.updateAvailable && result.latestVersion) {
        showOptionalUpdateAlert(result.latestVersion, result.updateUrl);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return <>
    {children}
    <Modal visible={!!requiredUrl} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.message}>Please update My Dear Partner to continue using the app.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Update Now" style={styles.button} onPress={() => {
            if (!requiredUrl) return;
            setError(false);
            Linking.openURL(requiredUrl).catch(() => setError(true));
          }}><Text style={styles.buttonText}>Update Now</Text></TouchableOpacity>
          {error && <Text accessibilityRole="alert" style={styles.message}>Could not open the store. Please try again or search for My Dear Partner in the app store.</Text>}
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { color: '#271B23', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  message: { color: '#44343D', fontSize: 16, lineHeight: 24, marginVertical: 12 },
  button: { backgroundColor: '#A51D3C', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
