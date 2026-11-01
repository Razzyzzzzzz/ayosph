import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Alert, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { pickImage, toFormFile } from '../media';
import { Button, Field, Chip, CATEGORIES, colors } from '../components/ui';

export default function NewReportScreen({ navigation }) {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [category, setCategory] = useState(null); const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState(null);
  const [coords, setCoords] = useState(null); const [locState, setLocState] = useState('loading');
  const [errors, setErrors] = useState({}); const [submitting, setSubmitting] = useState(false);

  const locate = useCallback(async () => {
    setLocState('loading');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setLocState('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLocState('ok');
      try {
        const [g] = await Location.reverseGeocodeAsync(pos.coords);
        if (g) setAddress((prev) => prev || [g.street || g.name, g.district, g.city].filter(Boolean).join(', '));
      } catch {}
    } catch { setLocState('error'); }
  }, []);
  useEffect(() => { locate(); }, [locate]);

  async function addPhoto() { const a = await pickImage(); if (a) setPhoto(a); }

  async function submit() {
    const e = {};
    if (title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (description.trim().length < 10) e.description = 'Please describe the problem (at least 10 characters)';
    if (!category) e.category = 'Choose a category';
    if (!photo) e.photo = 'Add a photo of the problem';
    if (!coords) e.location = 'Location is required. Enable GPS and tap retry.';
    setErrors(e); if (Object.keys(e).length) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', title.trim()); form.append('description', description.trim());
      form.append('category', category);
      form.append('latitude', String(coords.latitude)); form.append('longitude', String(coords.longitude));
      if (address.trim()) form.append('address_text', address.trim());
      form.append('photo', toFormFile(photo));
      await api('/reports', { method: 'POST', form });
      Alert.alert('Report submitted', 'Thank you! Your barangay will review it shortly.');
      navigation.goBack();
    } catch (err) { Alert.alert('Could not submit', err.message); }
    finally { setSubmitting(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Deep pothole near the basketball court" maxLength={120} error={errors.title} />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="What is the problem? How long has it been there? Is it dangerous?" multiline maxLength={2000} error={errors.description} />

        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => <Chip key={c.key} icon={c.icon} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />)}
        </View>
        {errors.category ? <Text style={{ color: colors.danger, fontSize: 12 }}>{errors.category}</Text> : null}

        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 8 }}>Photo</Text>
        <TouchableOpacity onPress={addPhoto} activeOpacity={0.85}
          style={{ height: 190, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: errors.photo ? colors.danger : colors.primary, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} /> : (
            <><Ionicons name="camera-outline" size={34} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Take or choose a photo</Text></>)}
        </TouchableOpacity>
        {photo ? <Text onPress={addPhoto} style={{ color: colors.primary, fontWeight: '700', marginTop: 6 }}>Change photo</Text> : null}
        {errors.photo ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.photo}</Text> : null}

        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 8 }}>Location</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: errors.location ? colors.danger : colors.border, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
          {locState === 'loading' ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={locState === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={22} color={locState === 'ok' ? colors.primary : colors.warn} />}
          <Text style={{ flex: 1, marginLeft: 10, color: colors.text }}>
            {locState === 'loading' ? 'Getting your GPS position…' : locState === 'ok' ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locState === 'denied' ? 'Location permission denied. Enable it in Settings.' : 'Could not get your location.'}
          </Text>
          <Text onPress={locate} style={{ color: colors.primary, fontWeight: '700' }}>{locState === 'ok' ? 'Refresh' : 'Retry'}</Text>
        </View>
        {errors.location ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.location}</Text> : null}
        <Field label="Landmark / address (optional)" value={address} onChangeText={setAddress} placeholder="Near the barangay hall" maxLength={200} style={{ marginTop: 14 }} />

        <Button title="Submit report" icon="paper-plane-outline" onPress={submit} loading={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
