import React from 'react';
import { ActivityIndicator, View, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen, RegisterScreen } from './src/screens/AuthScreens';
import ReportsScreen from './src/screens/ReportsScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import NewReportScreen from './src/screens/NewReportScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';
import { Button, colors } from './src/components/ui';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const headerOpts = { headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false };

function Tabs() {
  const { profile, unread } = useAuth();
  const role = profile.role;
  const icon = (name) => ({ color, size }) => <Ionicons name={name} size={size} color={color} />;
  return (
    <Tab.Navigator screenOptions={{ ...headerOpts, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: '#94A3B8', tabBarLabelStyle: { fontWeight: '600' } }}>
      <Tab.Screen name="Reports" component={ReportsScreen}
        options={{ title: role === 'resident' ? 'AyosPH' : role === 'staff' ? 'Staff Dashboard' : 'All Reports', tabBarLabel: role === 'resident' ? 'Home' : role === 'staff' ? 'Dashboard' : 'Reports', tabBarIcon: icon(role === 'resident' ? 'home' : 'grid') }} />
      {role === 'admin' ? <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Administration', tabBarIcon: icon('shield-checkmark') }} /> : null}
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarIcon: icon('notifications'), tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined, tabBarBadgeStyle: { backgroundColor: colors.danger } }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: icon('person') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { session, profile, booting, profileError, loadProfile, signOut } = useAuth();
  if (booting) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.primary }}><ActivityIndicator size="large" color="#fff" /></View>;
  if (!session) return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} /><Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
  if (!profile) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bg }}>
      {profileError ? (<>
        <Text style={{ textAlign: 'center', marginBottom: 16, color: colors.text }}>{profileError}</Text>
        <Button title="Retry" onPress={loadProfile} style={{ marginBottom: 10, minWidth: 160 }} />
        <Button title="Log out" variant="outline" onPress={signOut} style={{ minWidth: 160 }} />
      </>) : <ActivityIndicator size="large" color={colors.primary} />}
    </View>
  );
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ title: 'Report details' }} />
      <Stack.Screen name="NewReport" component={NewReportScreen} options={{ title: 'New report' }} />
    </Stack.Navigator>
  );
}

// On web/PC: center the app in a phone-width column so nothing stretches.
function Shell({ children }) {
  if (Platform.OS !== 'web') return children;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#E2E8F0' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.bg, overflow: 'hidden',
        boxShadow: '0 0 24px rgba(0,0,0,0.12)' }}>
        {children}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Shell>
          <NavigationContainer><StatusBar style="light" /><Root /></NavigationContainer>
        </Shell>
      </AuthProvider>
    </SafeAreaProvider>
  );
}