import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, Empty, ErrorBox, Loader, colors, timeAgo } from '../components/ui';

export default function NotificationsScreen({ navigation }) {
  const { refreshUnread } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setItems((await api('/notifications')).data); setError(null); }
    catch (e) { setError(e.message); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function open(n) {
    if (!n.is_read) {
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      api('/notifications/read', { method: 'POST', body: { id: n.id } }).then(refreshUnread).catch(() => {});
    }
    if (n.report_id) navigation.navigate('ReportDetail', { id: n.report_id });
  }
  async function markAll() {
    try { await api('/notifications/read', { method: 'POST', body: {} }); setItems((p) => p.map((x) => ({ ...x, is_read: true }))); refreshUnread(); } catch {}
  }
  const hasUnread = items.some((n) => !n.is_read);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {hasUnread ? <TouchableOpacity onPress={markAll} style={{ padding: 12, alignItems: 'flex-end' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>Mark all as read</Text></TouchableOpacity> : null}
      <FlatList data={items} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 16, paddingTop: hasUnread ? 0 : 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={loading ? <Loader /> : error ? <ErrorBox message={error} onRetry={load} /> : <Empty icon="notifications-off-outline" title="No notifications" text="You'll be notified when a report's status changes." />}
        renderItem={({ item: n }) => (
          <Card onPress={() => open(n)} style={{ flexDirection: 'row', borderColor: n.is_read ? '#EAF0EC' : colors.primary, backgroundColor: n.is_read ? '#fff' : '#F0FDF4' }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="notifications" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: n.is_read ? '600' : '800', color: colors.text }}>{n.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>{n.body}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{timeAgo(n.created_at)}</Text>
            </View>
          </Card>
        )} />
    </View>
  );
}
