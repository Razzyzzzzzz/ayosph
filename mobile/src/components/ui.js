import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const colors = {
  primary: '#14693B', primaryDark: '#0F4F2C', primaryLight: '#E6F4EA', bg: '#F4F6F8', card: '#FFFFFF',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0', danger: '#DC2626', warn: '#D97706',
  sidebar: '#0B1F16', subtle: '#F8FAFC',
};

const shadow = (level = 1) => Platform.select({
  web: { boxShadow: level === 1 ? '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)' : '0 8px 24px rgba(15,23,42,0.12)' },
  default: { shadowColor: '#0F172A', shadowOpacity: level === 1 ? 0.06 : 0.14, shadowRadius: level === 1 ? 4 : 14, shadowOffset: { width: 0, height: level === 1 ? 1 : 6 }, elevation: level === 1 ? 2 : 6 },
});
export const elevation = shadow;

export const STATUS = {
  pending: { label: 'Pending', bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
  verified: { label: 'Verified', bg: '#DBEAFE', fg: '#1E40AF', dot: '#3B82F6' },
  in_progress: { label: 'In Progress', bg: '#EDE9FE', fg: '#5B21B6', dot: '#8B5CF6' },
  resolved: { label: 'Resolved', bg: '#DCFCE7', fg: '#166534', dot: '#22C55E' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444' },
};
export const STATUS_KEYS = Object.keys(STATUS);

export const CATEGORIES = [
  { key: 'pothole', label: 'Pothole', icon: 'construct-outline' },
  { key: 'garbage', label: 'Garbage', icon: 'trash-outline' },
  { key: 'streetlight', label: 'Streetlight', icon: 'bulb-outline' },
  { key: 'drainage', label: 'Drainage', icon: 'water-outline' },
  { key: 'public_facility', label: 'Public Facility', icon: 'business-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];
export const catOf = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[5];
export const ROLE_LABEL = { resident: 'Resident', staff: 'Barangay Staff', admin: 'Super Admin' };

export const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtDateTime = (d) => new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export function timeAgo(d) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
}

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon, style }) {
  const v = {
    primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
    outline: { bg: '#fff', fg: colors.primary, border: colors.border },
    danger: { bg: '#fff', fg: colors.danger, border: '#FECACA' },
  }[variant] || { bg: colors.primary, fg: '#fff', border: colors.primary };
  const off = disabled || loading;
  return (
    <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.85}
      style={[s.btn, { backgroundColor: v.bg, borderColor: v.border, opacity: off ? 0.55 : 1 }, variant === 'primary' && shadow(1), style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <View style={s.row}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[s.btnText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Field({ label, error, style, onFocus, onBlur, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#94A3B8" {...props}
        onFocus={(e) => { setFocus(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
        style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' },
          props.multiline && { minHeight: 96, textAlignVertical: 'top' },
          focus && { borderColor: colors.primary, backgroundColor: '#fff' },
          error && { borderColor: colors.danger }]} />
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

export const Card = ({ children, style, onPress }) =>
  onPress ? <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[s.card, style]}>{children}</TouchableOpacity>
          : <View style={[s.card, style]}>{children}</View>;

export function Badge({ status }) {
  const m = STATUS[status] || STATUS.pending;
  return (
    <View style={[s.badge, { backgroundColor: m.bg }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.dot, marginRight: 6 }} />
      <Text style={[s.badgeText, { color: m.fg }]}>{m.label}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {icon ? <Ionicons name={icon} size={14} color={active ? '#fff' : colors.muted} style={{ marginRight: 5 }} /> : null}
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const Loader = ({ style }) => <View style={[{ padding: 40, alignItems: 'center' }, style]}><ActivityIndicator size="large" color={colors.primary} /></View>;

export function Empty({ icon = 'leaf-outline', title, text }) {
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 14 }}>{title}</Text>
      {text ? <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 4, maxWidth: 320 }}>{text}</Text> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <View style={{ alignItems: 'center', padding: 32 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
      </View>
      <Text style={{ color: colors.text, textAlign: 'center', marginVertical: 12, maxWidth: 360 }}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  btnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text },
  err: { color: colors.danger, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow(1) },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', marginRight: 8, marginBottom: 6 },
  chipText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  h2: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
});