import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SavedSearch, SavedSearchFilters, savedSearchService } from '../api/savedSearchService';
import { colors } from '../theme/theme';

interface Props {
  accountId: string;
  filters: SavedSearchFilters;
  quickSuggestionActive: boolean;
  onApply: (saved: SavedSearch) => void;
  onRemove?: (id: string) => void;
}

export default function SavedSearchControls({ accountId, filters, quickSuggestionActive, onApply, onRemove }: Props) {
  const [mode, setMode] = useState<'save' | 'list' | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [name, setName] = useState('');
  const [alerts, setAlerts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setMode(null);
    setSearches([]);
    setName('');
    setAlerts(false);
    setError('');
    setBusy(false);
    // Invalidate pending requests when this account or component leaves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; };
  }, [accountId]);

  const run = async (operation: () => Promise<void>) => {
    const revision = generation.current;
    setBusy(true);
    setError('');
    try { await operation(); }
    catch (failure: any) {
      if (revision === generation.current) setError(failure?.status === 404
        ? 'Saved searches are not available from the service yet. Please try again later.'
        : failure?.message || 'Could not update saved searches. Please try again.');
    } finally { if (revision === generation.current) setBusy(false); }
  };

  const openList = () => {
    generation.current++;
    setMode('list');
    const revision = generation.current;
    run(async () => {
      const saved = await savedSearchService.list();
      if (revision === generation.current) setSearches(saved);
    });
  };
  const openSave = () => {
    if (quickSuggestionActive) {
      Alert.alert('Save your filters', 'Clear the quick suggestion before saving this search.');
      return;
    }
    if (!Object.values(filters).some(Boolean)) {
      Alert.alert('Choose a search', 'Enter a search or choose filters first.');
      return;
    }
    generation.current++;
    setName('');
    setAlerts(false);
    setError('');
    setMode('save');
  };
  const save = () => {
    const revision = generation.current;
    run(async () => {
      await savedSearchService.create(name.trim(), filters, alerts);
      if (revision === generation.current) {
        setMode(null);
        Alert.alert('Search saved', alerts ? 'We’ll alert you when new members match these filters.' : 'You can reopen this search from Saved searches.');
      }
    });
  };

  return <View style={styles.container}>
    <View style={styles.buttons}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save search" onPress={openSave} style={styles.button}><Text style={styles.action}>Save search</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Saved searches" onPress={openList} style={styles.button}><Text style={styles.action}>Saved searches</Text></TouchableOpacity>
    </View>
    <Modal visible={mode !== null} transparent animationType="fade" onRequestClose={() => { generation.current++; setBusy(false); setMode(null); }}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <View style={styles.heading}><Text style={styles.title}>{mode === 'save' ? 'Save this search' : 'Saved searches'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close saved searches" disabled={busy} onPress={() => setMode(null)}><Text style={styles.action}>Close</Text></TouchableOpacity>
        </View>
        {mode === 'save' ? <>
          <TextInput accessibilityLabel="Search name" placeholder="Search name" value={name} onChangeText={setName} maxLength={80} style={styles.input} autoFocus />
          <View style={styles.row}><Text style={styles.label}>Alert me to new matches</Text><Switch accessibilityLabel="Alert me to new matches" value={alerts} onValueChange={setAlerts} /></View>
          <Text style={styles.help}>Alerts check for matching members who join after you save. You can pause them anytime.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirm save search" disabled={busy || !name.trim()} style={styles.button} onPress={save}><Text style={styles.action}>{busy ? 'Saving…' : 'Save'}</Text></TouchableOpacity>
        </> : <ScrollView style={styles.list}>
          {busy && searches.length === 0 && <Text style={styles.help}>Loading saved searches…</Text>}
          {!busy && !error && searches.length === 0 && <Text style={styles.help}>No saved searches yet. Choose filters, then tap Save search.</Text>}
          {searches.map(saved => <View key={saved.id} style={styles.saved}>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { onApply(saved); setMode(null); }}><Text style={styles.savedName}>{saved.name}</Text><Text style={styles.help}>Open matching profiles</Text></TouchableOpacity>
            <View style={styles.row}><Text style={styles.label}>New-match alerts</Text><Switch accessibilityLabel={`Alerts for ${saved.name}`} value={saved.alerts_enabled} disabled={busy} onValueChange={value => {
              const revision = generation.current;
              run(async () => {
                const updated = await savedSearchService.update(saved.id, value);
                if (revision === generation.current) setSearches(rows => rows.map(row => row.id === updated.id ? updated : row));
              });
            }} /></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${saved.name}`} disabled={busy} onPress={() => {
              const revision = generation.current;
              run(async () => {
                await savedSearchService.remove(saved.id);
                if (revision === generation.current) {
                  setSearches(rows => rows.filter(row => row.id !== saved.id));
                  onRemove?.(saved.id);
                }
              });
            }}><Text style={styles.remove}>Delete search</Text></TouchableOpacity>
          </View>)}
        </ScrollView>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingTop: 12 }, buttons: { flexDirection: 'row', gap: 12 },
  button: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF0F5' },
  action: { color: colors.primary, fontWeight: '700' }, backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, maxHeight: '85%' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#271B23', flex: 1 },
  input: { borderWidth: 1, borderColor: '#E7D9DF', padding: 12, borderRadius: 10, color: '#271B23' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12, gap: 12 },
  label: { color: '#44343D', flex: 1 }, help: { color: '#786772', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  list: { flexGrow: 0 }, saved: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE5E9' },
  savedName: { fontWeight: '700', fontSize: 16, color: '#271B23' }, remove: { color: '#A51D3C', paddingVertical: 6 },
  error: { color: '#A51D3C', marginTop: 12, lineHeight: 20 },
});
