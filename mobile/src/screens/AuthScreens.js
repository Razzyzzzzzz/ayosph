import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { api } from '../api';
import { Button, Field, Chip, Loader, colors } from '../components/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Shell({ title, subtitle, children, footer }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.primary }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ paddingTop: 70, paddingBottom: 28, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="location" size={34} color={colors.primary} />
          </View>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 12 }}>AyosPH</Text>
          <Text style={{ color: '#D1FAE5', marginTop: 2 }}>Report. Track. Ayusin.</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{title}</Text>
          <Text style={{ color: colors.muted, marginBottom: 18, marginTop: 2 }}>{subtitle}</Text>
          {children}
          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LoginScreen({ navigation }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({}); const [loading, setLoading] = useState(false);

  async function submit() {
    const e = {};
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Enter your password';
    setErrors(e); if (Object.keys(e).length) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message === 'Email not confirmed' ? 'Please confirm your email first (check your inbox).' : error.message);
  }
  return (
    <Shell title="Welcome back" subtitle="Log in to report and track issues in your barangay."
      footer={<TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.muted }}>New here? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Text></Text></TouchableOpacity>}>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" error={errors.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" error={errors.password} />
      <Button title="Log in" onPress={submit} loading={loading} />
    </Shell>
  );
}

export function RegisterScreen({ navigation }) {
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '', confirm: '' });
  const [barangayId, setBarangayId] = useState(null);
  const [barangays, setBarangays] = useState(null);
  const [errors, setErrors] = useState({}); const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { api('/barangays').then((r) => setBarangays(r.data)).catch(() => setBarangays([])); }, []);

  async function submit() {
    const e = {};
    if (f.full_name.trim().length < 2) e.full_name = 'Enter your full name';
    if (f.phone && !/^[0-9+\-\s]{7,15}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number';
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address';
    if (f.password.length < 8) e.password = 'Use at least 8 characters';
    if (f.confirm !== f.password) e.confirm = 'Passwords do not match';
    if (!barangayId) e.barangay = 'Select your barangay';
    setErrors(e); if (Object.keys(e).length) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(), password: f.password,
      options: { data: { full_name: f.full_name.trim(), phone: f.phone.trim(), barangay_id: barangayId } },
    });
    setLoading(false);
    if (error) return Alert.alert('Registration failed', error.message);
    if (!data.session) {
      Alert.alert('Check your email', 'We sent a confirmation link. Confirm your email, then log in.', [{ text: 'OK', onPress: () => navigation.navigate('Login') }]);
    }
  }
  return (
    <Shell title="Create account" subtitle="Join your barangay community on AyosPH."
      footer={<TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.muted }}>Already registered? <Text style={{ color: colors.primary, fontWeight: '700' }}>Log in</Text></Text></TouchableOpacity>}>
      <Field label="Full name" value={f.full_name} onChangeText={set('full_name')} placeholder="Juan Dela Cruz" error={errors.full_name} />
      <Field label="Phone (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="09xx xxx xxxx" error={errors.phone} />
      <Field label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" error={errors.email} />
      <Field label="Password" value={f.password} onChangeText={set('password')} secureTextEntry placeholder="At least 8 characters" error={errors.password} />
      <Field label="Confirm password" value={f.confirm} onChangeText={set('confirm')} secureTextEntry placeholder="Repeat password" error={errors.confirm} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Your barangay</Text>
      {barangays === null ? <Loader /> : barangays.length === 0 ? (
        <Text style={{ color: colors.muted, marginBottom: 12 }}>No barangays are registered yet. Please ask your Super Admin to add yours.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {barangays.map((b) => <Chip key={b.id} label={`${b.name}, ${b.city}`} active={barangayId === b.id} onPress={() => setBarangayId(b.id)} />)}
        </View>
      )}
      {errors.barangay ? <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 10 }}>{errors.barangay}</Text> : null}
      <Button title="Create account" onPress={submit} loading={loading} style={{ marginTop: 8 }} />
    </Shell>
  );
}
