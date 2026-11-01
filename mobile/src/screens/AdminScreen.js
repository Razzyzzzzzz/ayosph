import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, Switch, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, qs } from '../api';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, Chip, Empty, ErrorBox, Field, Loader, ROLE_LABEL, STATUS, colors, timeAgo } from '../components/ui';

const Seg = ({ tabs, value, onChange }) => (
  <View style={{ flexDirection: 'row', backgroundColor: '#E5EFE8', borderRadius: 12, padding: 3, marginBottom: 14 }}>
    {tabs.map(([k, label]) => (
      <TouchableOpacity key={k} onPress={() => onChange(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: value === k ? '#fff' : 'transparent' }}>
        <Text style={{ fontWeight: '700', color: value === k ? colors.primary : colors.muted }}>{label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const Stat = ({ label, value, color }) => (
  <View style={{ width: '31%', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EAF0EC' }}>
    <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text><Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>{label}</Text>
  </View>
);

function Overview({ data }) {
  const s = data.stats;
  return (
    <>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 }}>Reports</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Stat label="Total" value={s.total} color={colors.text} /><Stat label="Pending" value={s.pending} color="#B45309" /><Stat label="Verified" value={s.verified} color="#1D4ED8" />
        <Stat label="In progress" value={s.in_progress} color="#6D28D9" /><Stat label="Resolved" value={s.resolved} color={colors.primary} /><Stat label="Rejected" value={s.rejected} color={colors.danger} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginVertical: 10 }}>Users</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Stat label="Residents" value={data.users.resident} color={colors.text} /><Stat label="Staff" value={data.users.staff} color={colors.text} /><Stat label="Admins" value={data.users.admin} color={colors.text} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginVertical: 10 }}>By barangay</Text>
      {data.barangays.length === 0 ? <Empty title="No barangays yet" text="Add one in the Barangays tab." /> : data.barangays.map((b) => (
        <Card key={b.id}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{b.name}, {b.city}{!b.is_active ? ' (inactive)' : ''}</Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{b.total} total · {b.pending} pending · {b.in_progress} in progress · {b.resolved} resolved</Text>
        </Card>
      ))}
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginVertical: 10 }}>Recent activity</Text>
      {data.recent.length === 0 ? <Text style={{ color: colors.muted }}>No activity yet.</Text> : data.recent.map((u) => (
        <Card key={u.id}>
          <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.text }}>{u.report?.title}</Text>
          <View style={{ marginVertical: 6 }}>{u.new_status ? <Badge status={u.new_status} /> : null}</View>
          {u.note ? <Text style={{ color: colors.text }}>{u.note}</Text> : null}
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{u.author?.full_name} · {u.report?.barangay?.name} · {timeAgo(u.created_at)}</Text>
        </Card>
      ))}
    </>
  );
}

function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState(null); const [error, setError] = useState(null);
  const [search, setSearch] = useState(''); const [q, setQ] = useState(''); const [roleFilter, setRoleFilter] = useState(null);
  const [edit, setEdit] = useState(null); const [barangays, setBarangays] = useState([]); const [saving, setSaving] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 400); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    try { setUsers((await api('/admin/users?' + qs({ q, role: roleFilter }))).data); setError(null); } catch (e) { setError(e.message); }
  }, [q, roleFilter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/barangays').then((r) => setBarangays(r.data)).catch(() => {}); }, []);

  async function save() {
    setSaving(true);
    try {
      await api(`/admin/users/${edit.id}`, { method: 'PATCH', body: { role: edit.role, barangay_id: edit.barangay_id || null } });
      setEdit(null); load();
    } catch (e) { Alert.alert('Could not update', e.message); } finally { setSaving(false); }
  }

  return (
    <>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search by name…" placeholderTextColor="#94A3B8"
        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label="All" active={!roleFilter} onPress={() => setRoleFilter(null)} />
        {Object.keys(ROLE_LABEL).map((r) => <Chip key={r} label={ROLE_LABEL[r]} active={roleFilter === r} onPress={() => setRoleFilter(r)} />)}
      </ScrollView>
      <View style={{ height: 8 }} />
      {error ? <ErrorBox message={error} onRetry={load} /> : users === null ? <Loader /> : users.length === 0 ? <Empty title="No users found" /> : users.map((u) => (
        <Card key={u.id} onPress={() => setEdit({ id: u.id, name: u.full_name, role: u.role, barangay_id: u.barangay_id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{u.full_name}{u.id === profile.id ? ' (you)' : ''}</Text>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{ROLE_LABEL[u.role]}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{u.email}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{u.barangay ? `${u.barangay.name}, ${u.barangay.city}` : 'No barangay'}</Text>
        </Card>
      ))}
      <Modal visible={!!edit} animationType="slide" transparent onRequestClose={() => setEdit(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          {edit ? (
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{edit.name}</Text>
              <Text style={{ fontWeight: '600', marginTop: 14, marginBottom: 8 }}>Role</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Object.keys(ROLE_LABEL).map((r) => <Chip key={r} label={ROLE_LABEL[r]} active={edit.role === r} onPress={() => setEdit({ ...edit, role: r })} />)}
              </View>
              <Text style={{ fontWeight: '600', marginTop: 10, marginBottom: 8 }}>Barangay {edit.role === 'staff' ? '(required for staff)' : ''}</Text>
              <ScrollView style={{ maxHeight: 200 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {edit.role !== 'staff' ? <Chip label="None" active={!edit.barangay_id} onPress={() => setEdit({ ...edit, barangay_id: null })} /> : null}
                {barangays.map((b) => <Chip key={b.id} label={`${b.name}, ${b.city}`} active={edit.barangay_id === b.id} onPress={() => setEdit({ ...edit, barangay_id: b.id })} />)}
              </View></ScrollView>
              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <Button title="Cancel" variant="outline" onPress={() => setEdit(null)} style={{ flex: 1, marginRight: 8 }} />
                <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function Barangays({ list, reload }) {
  const [form, setForm] = useState(null); const [saving, setSaving] = useState(false);
  async function create() {
    setSaving(true);
    try { await api('/admin/barangays', { method: 'POST', body: { name: form.name, city: form.city, province: form.province } }); setForm(null); reload(); }
    catch (e) { Alert.alert('Could not add', e.message); } finally { setSaving(false); }
  }
  async function toggle(b, v) { try { await api(`/admin/barangays/${b.id}`, { method: 'PATCH', body: { is_active: v } }); reload(); } catch (e) { Alert.alert('Error', e.message); } }
  function remove(b) {
    Alert.alert('Delete barangay', `Delete ${b.name}? This only works if it has no users or reports.`, [{ text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api(`/admin/barangays/${b.id}`, { method: 'DELETE' }); reload(); } catch (e) { Alert.alert('Cannot delete', e.message); } } }]);
  }
  return (
    <>
      <Button title="Add barangay" icon="add-circle-outline" onPress={() => setForm({ name: '', city: '', province: '' })} style={{ marginBottom: 12 }} />
      {list.length === 0 ? <Empty title="No barangays yet" text="Residents can't register until at least one exists." /> : list.map((b) => (
        <Card key={b.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{b.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{b.city}{b.province ? `, ${b.province}` : ''} · {b.total} reports</Text>
            </View>
            <Switch value={b.is_active} onValueChange={(v) => toggle(b, v)} trackColor={{ true: colors.primary }} />
            <TouchableOpacity onPress={() => remove(b)} style={{ padding: 8 }}><Ionicons name="trash-outline" size={20} color={colors.danger} /></TouchableOpacity>
          </View>
        </Card>
      ))}
      <Modal visible={!!form} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          {form ? (
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12 }}>New barangay</Text>
              <Field label="Barangay name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Sta. Rita" />
              <Field label="City / Municipality" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} placeholder="Guiguinto" />
              <Field label="Province" value={form.province} onChangeText={(v) => setForm({ ...form, province: v })} placeholder="Bulacan" />
              <View style={{ flexDirection: 'row' }}>
                <Button title="Cancel" variant="outline" onPress={() => setForm(null)} style={{ flex: 1, marginRight: 8 }} />
                <Button title="Add" onPress={create} loading={saving} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

export default function AdminScreen() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null); const [error, setError] = useState(null); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api('/admin/activity')); setError(null); } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
      <Seg tabs={[['overview', 'Overview'], ['users', 'Users'], ['barangays', 'Barangays']]} value={tab} onChange={setTab} />
      {tab === 'users' ? <Users /> : error ? <ErrorBox message={error} onRetry={load} /> : !data ? <Loader /> :
        tab === 'overview' ? <Overview data={data} /> : <Barangays list={data.barangays} reload={load} />}
    </ScrollView>
  );
}
