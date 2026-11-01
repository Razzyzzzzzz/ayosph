import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { api } from '../api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async (canRetry) => {
    setProfileError(null);
    try {
      const r = await api('/me');
      setProfile(r.data);
    } catch (e) {
      const expired = e?.status === 401 || /invalid or expired session|authentication required/i.test(e?.message || '');
      if (expired && canRetry) {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data?.session) return fetchProfile(false);
      }
      if (expired) {
        await supabase.auth.signOut();
        setProfile(null);
        setProfileError('Your session expired. Please log in again.');
        return;
      }
      setProfile(null);
      setProfileError(e.message);
    } finally {
      setBooting(false);
    }
  }, []);

  const loadProfile = useCallback(() => fetchProfile(true), [fetchProfile]);

  const uid = session?.user?.id;
  useEffect(() => {
    if (uid) loadProfile();
    else { setProfile(null); setUnread(0); }
  }, [uid, loadProfile]);

  const refreshUnread = useCallback(async () => {
    try { const r = await api('/notifications/unread-count'); setUnread(r.count); } catch {}
  }, []);

  // Realtime push of new notifications + slow polling as a fallback
  useEffect(() => {
    if (!profile?.id) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    const ch = supabase.channel('notif-' + profile.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, refreshUnread)
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [profile?.id, refreshUnread]);

  const value = {
    session, profile, booting, profileError, unread, loadProfile, refreshUnread, setProfile,
    signOut: () => supabase.auth.signOut(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}