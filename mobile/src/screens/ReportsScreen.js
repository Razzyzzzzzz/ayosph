import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Image, TextInput, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api, qs } from '../api';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, Chip, Empty, ErrorBox, Loader, CATEGORIES, STATUS, STATUS_KEYS, catOf, colors, timeAgo, ROLE_LABEL } from '../components/ui';

function StatCard({ label, value, color, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 10, marginRight: 8, borderWidth: 1.5, borderColor: active ? colors.primary : '#EAF0EC' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value ?? '–'}</Text>
      <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReportCard({ r, onPress, showReporter }) {
  const c = catOf(r.category);
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row' }}>
      {r.photo_url ? <Image source={{ uri: r.photo_url }} style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: '#EEF2EF' }} />
        : <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={c.icon} size={28} color={colors.primary} /></View>}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{r.title}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {c.label} · {r.barangay?.name}{showReporter && r.reporter ? ` · ${r.reporter.full_name}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <Badge status={r.status} />
          <Text style={{ fontSize: 11, color: colors.muted }}>{timeAgo(r.created_at)}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function ReportsScreen({ navigation }) {
  const { profile } = useAuth();
  const isResident = profile.role === 'resident';
  const [items, setItems] = useState([]); const [count, setCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(''); const [q, setQ] = useState('');
  const [status, setStatus] = useState(null); const [category, setCategory] = useState(null);
  const reqId = useRef(0);

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 400); return () => clearTimeout(t); }, [search]);

  const fetchPage = useCallback(async (offset = 0, replace = true) => {
    const id = ++reqId.current;
    try {
      const res = await api('/reports?' + qs({ limit: 20, offset, q, status, category }));
      if (id !== reqId.current) return;
      setItems((prev) => (replace ? res.data : [...prev, ...res.data]));
      setCount(res.count); setError(null);
    } catch (e) { if (id === reqId.current) setError(e.message); }
    finally { if (id === reqId.current) { setLoading(false); setRefreshing(false); setMore(false); } }
  }, [q, status, category]);

  const loadStats = useCallback(async () => { try { setStats((await api('/stats')).data); } catch {} }, []);

  useFocusEffect(useCallback(() => { loadStats(); fetchPage(0, true); }, [fetchPage, loadStats]));

  const onRefresh = () => { setRefreshing(true); loadStats(); fetchPage(0, true); };
  const onEnd = () => { if (!more && !loading && items.length < count) { setMore(true); fetchPage(items.length, false); } };
  const pickStat = (st) => { setLoading(true); setStatus(st); };

  const title = isResident ? 'My reports' : profile.role === 'staff' ? 'Incoming reports' : 'All reports';
  const header = (
    <View>
      <View style={{ backgroundColor: colors.primary, marginHorizontal: -16, marginTop: -12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, marginBottom: 14, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Hello, {profile.full_name.split(' ')[0]} 👋</Text>
        <Text style={{ color: '#D1FAE5', marginTop: 2 }}>
          {ROLE_LABEL[profile.role]}{profile.barangay ? ` · ${profile.barangay.name}, ${profile.barangay.city}` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <StatCard label="Total" value={stats?.total} color={colors.text} active={!status} onPress={() => pickStat(null)} />
        <StatCard label="Pending" value={stats?.pending} color="#B45309" active={status === 'pending'} onPress={() => pickStat('pending')} />
        <StatCard label="In progress" value={stats?.in_progress} color="#6D28D9" active={status === 'in_progress'} onPress={() => pickStat('in_progress')} />
        <StatCard label="Resolved" value={stats?.resolved} color={colors.primary} active={status === 'resolved'} onPress={() => pickStat('resolved')} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, marginBottom: 10 }}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search reports…" placeholderTextColor="#94A3B8" style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 8, color: colors.text }} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.muted} /></TouchableOpacity> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label="All categories" active={!category} onPress={() => { setLoading(true); setCategory(null); }} />
        {CATEGORIES.map((c) => <Chip key={c.key} icon={c.icon} label={c.label} active={category === c.key} onPress={() => { setLoading(true); setCategory(c.key); }} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label="Any status" active={!status} onPress={() => pickStat(null)} />
        {STATUS_KEYS.map((k) => <Chip key={k} label={STATUS[k].label} active={status === k} onPress={() => pickStat(k)} />)}
      </ScrollView>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginVertical: 10 }}>{title} <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>({count})</Text></Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 100 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ReportCard r={item} showReporter={!isResident} onPress={() => navigation.navigate('ReportDetail', { id: item.id })} />}
        ListEmptyComponent={loading ? <Loader /> : error ? <ErrorBox message={error} onRetry={() => { setLoading(true); fetchPage(0, true); }} /> :
          <Empty title="No reports found" text={isResident ? 'Tap + to report a problem in your barangay.' : 'Nothing matches your filters yet.'} />}
        ListFooterComponent={more ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={onEnd} onEndReachedThreshold={0.4} keyboardShouldPersistTaps="handled"
      />
      {isResident ? (
        <TouchableOpacity onPress={() => navigation.navigate('NewReport')} activeOpacity={0.85}
          style={{ position: 'absolute', right: 18, bottom: 22, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 54, borderRadius: 27, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
          <Ionicons name="add" size={24} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', marginLeft: 4 }}>New report</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
