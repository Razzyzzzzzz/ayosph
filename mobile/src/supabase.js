import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://missing-env',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'missing-env',
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
