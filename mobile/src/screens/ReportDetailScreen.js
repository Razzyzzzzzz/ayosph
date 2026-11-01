import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { pickImage, toFormFile } from '../media';
import { Badge, Button, Card, Chip, ErrorBox, Field, Loader, STATUS, STATUS_KEYS, catOf, colors, fmtDateTime } from '../components/ui';

function Photo({ label, url, onAdd, canAdd, busy }) {
  if (!url && !canAdd) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>{label}</Text>
      {url ? <Image source={{ uri: url }} style={{ width: '100%', height: 200, borderRadius: 14, backgroundColor: '#EEF2EF' }} resizeMode="cover" /> : null}
      {canAdd ? <Button title={url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`} variant="outline" icon="camera-outline" onPress={onAdd} disabled={busy} style={{ marginTop: url ? 8 : 0 }} /> : null}
    </View>
  );
}

export default function ReportDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [r, setR] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [newStatus, setNewStatus] = useState(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const res = await api(`/reports/${id}`); setR(res.data); setError(null); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (r) setNewStatus(r.status); }, [r?.status]);

  async function save() {
    const text = note.trim();
    if (newStatus === r.status && !text) return Alert.alert('Nothing to save', 'Choose a new status or write a progress note.');
    if (newStatus === 'rejected' && r.status !== 'rejected' && !text) return Alert.alert('Note required', 'Please explain why this report is rejected.');
    setBusy(true);
    try {
      if (newStatus !== r.status) await api(`/reports/${id}/status`, { method: 'PATCH', body: { status: newStatus, note: text || undefined } });
      else await api(`/reports/${id}/notes`, { method: 'POST', body: { note: text } });
      setNote(''); await load();
    } catch (e) { Alert.alert('Update failed', e.message); } finally { setBusy(false); }
  }

  async function addPhoto(kind) {
    const a = await pickImage(); if (!a) return;
    setBusy(true);
    try {
      const form = new FormData(); form.append('kind', kind); form.append('photo', toFormFile(a));
      await api(`/reports/${id}/photos`, { method: 'POST', form }); await load();
    } catch (e) { Alert.alert('Upload failed', e.message); } finally { setBusy(false); }
  }

  if (loading) return <Loader style={{ flex: 1, justifyContent: 'center' }} />;
  if (error || !r) return <ErrorBox message={error || 'Report not found'} onRetry={() => { setLoading(true); load(); }} />;
  const c = catOf(r.category);
  const mapUrl = r.latitude != null ? `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}` : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge status={r.status} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtDateTime(r.created_at)}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10 }}>{r.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name={c.icon} size={16} color={colors.primary} />
            <Text style={{ color: colors.muted, marginLeft: 6 }}>{c.label} · {r.barangay?.name}, {r.barangay?.city}</Text>
          </View>
          <Text style={{ color: colors.text, lineHeight: 21, marginTop: 12 }}>{r.description}</Text>
          {r.reporter ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>Reported by {r.reporter.full_name}{r.can_manage && r.reporter.phone ? ` · ${r.reporter.phone}` : ''}</Text> : null}
          {r.address_text ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>📍 {r.address_text}</Text> : null}
          {mapUrl ? <Button title="Open location in Maps" variant="outline" icon="map-outline" onPress={() => Linking.openURL(mapUrl)} style={{ marginTop: 12 }} /> : null}
        </Card>

        <Card>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Photos</Text>
          <Photo label="Reported photo" url={r.photo_url} />
          <Photo label="Before photo" url={r.before_photo_url} canAdd={r.can_manage} onAdd={() => addPhoto('before')} busy={busy} />
          <Photo label="After photo" url={r.after_photo_url} canAdd={r.can_manage} onAdd={() => addPhoto('after')} busy={busy} />
        </Card>

        {r.can_manage ? (
          <Card>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Update report</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS_KEYS.map((k) => <Chip key={k} label={STATUS[k].label} active={newStatus === k} onPress={() => setNewStatus(k)} />)}
            </View>
            <Field label={newStatus === 'rejected' ? 'Reason for rejection (required)' : 'Progress note'} value={note} onChangeText={setNote}
              placeholder="e.g. Crew scheduled for Friday morning" multiline maxLength={1000} style={{ marginTop: 10 }} />
            <Button title="Save update" icon="checkmark-circle-outline" onPress={save} loading={busy} />
          </Card>
        ) : null}

        <Card>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Activity</Text>
          {r.updates.length === 0 ? <Text style={{ color: colors.muted }}>No updates yet. Your barangay will respond soon.</Text> : r.updates.map((u, i) => (
            <View key={u.id} style={{ flexDirection: 'row', marginBottom: 14 }}>
              <View style={{ alignItems: 'center', marginRight: 12 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 }} />
                {i < r.updates.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: '#D1E7D8' }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                {u.new_status ? <Text style={{ fontWeight: '700', color: colors.text }}>{u.old_status ? `${STATUS[u.old_status].label} → ` : ''}{STATUS[u.new_status].label}</Text> : null}
                {u.note ? <Text style={{ color: colors.text, marginTop: 2 }}>{u.note}</Text> : null}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{u.author?.full_name || 'Staff'} · {fmtDateTime(u.created_at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
