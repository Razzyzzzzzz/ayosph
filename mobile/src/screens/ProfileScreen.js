import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, ROLE_LABEL, colors } from '../components/ui';

export default function ProfileScreen() {
  const { profile, loadProfile, signOut } = useAuth();
  const [name, setName] = useState(profile.full_name); const [phone, setPhone] = useState(profile.phone || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (name.trim().length < 2) return Alert.alert('Invalid name', 'Please enter your full name.');
    setSaving(true);
    try { await api('/me', { method: 'PATCH', body: { full_name: name.trim(), phone: phone.trim() } }); await loadProfile(); Alert.alert('Saved', 'Profile updated.'); }
    catch (e) { Alert.alert('Could not save', e.message); } finally { setSaving(false); }
  }
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{profile.full_name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 10 }}>{profile.full_name}</Text>
        <Text style={{ color: colors.muted }}>{profile.email}</Text>
        <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginTop: 8 }}>
          <Text style={{ color: colors.primaryDark, fontWeight: '700', fontSize: 12 }}>{ROLE_LABEL[profile.role]}</Text>
        </View>
        {profile.barangay ? <Text style={{ color: colors.muted, marginTop: 8 }}>{profile.barangay.name}, {profile.barangay.city}</Text> : null}
      </Card>
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Save changes" onPress={save} loading={saving} />
      </Card>
      <Button title="Log out" variant="danger" icon="log-out-outline" onPress={() => Alert.alert('Log out', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: signOut }])} />
    </ScrollView>
  );
}
