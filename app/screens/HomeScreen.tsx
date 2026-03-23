import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api } from '../services/api';

interface HomeScreenProps {
  user: { id: string; username: string } | null;
  token: string;
  onLogout?: () => void;
}

export default function HomeScreen({ user, token, onLogout }: HomeScreenProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLaunchApp = async () => {
    setLoading(true);
    setError(null);
    setAppUrl(null);
    try {
      const { url } = await api.post<{ url: string }>(
        '/api/app/start',
        {},
        { Authorization: `Bearer ${token}` }
      );
      let ready = false;
      let tries = 0;
      while (!ready && tries < 20) {
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
        tries++;
      }
      if (ready) {
        setAppUrl(url);
      } else {
        setError('App did not start in time. Please try again.');
      }
    } catch (err) {
      setError('Failed to launch app: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApp = () => {
    if (appUrl) {
      // Append token so the embedded ChatWidget in the user's app can authenticate
      const urlWithToken = `${appUrl}?token=${encodeURIComponent(token)}`;
      Linking.openURL(urlWithToken);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>CodeIt</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>AI-powered app builder</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Welcome, {user?.username || 'user'}!</Text>
          {onLogout && (
            <TouchableOpacity onPress={onLogout}>
              <Text style={[styles.logoutText, { color: theme.error }]}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
          Describe what you want to build and let AI generate the code for you. Open the chat widget to get started.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>How it works</Text>
        <View style={styles.steps}>
          {[
            '1. Describe your feature or change',
            '2. AI generates targeted code patches',
            '3. Changes are validated & applied safely',
            '4. Code is committed to your repo',
          ].map((step, i) => (
            <Text key={i} style={[styles.step, { color: theme.textSecondary }]}>{step}</Text>
          ))}
        </View>
      </View>

      {error && <Text style={{ color: theme.error, marginBottom: spacing.md }}>{error}</Text>}
      {loading ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: spacing.md }}>Starting your app...</Text>
        </View>
      ) : appUrl ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Text style={{ color: theme.success, marginBottom: spacing.md }}>Your app is ready!</Text>
          <TouchableOpacity style={[styles.launchBtn, { backgroundColor: theme.primary }]} onPress={handleOpenApp}>
            <Text style={styles.launchBtnText}>Open My App</Text>
          </TouchableOpacity>
          <Text style={{ color: theme.textSecondary, marginTop: spacing.sm }}>{appUrl}</Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.launchBtn, { backgroundColor: theme.primary }]} onPress={handleLaunchApp}>
          <Text style={styles.launchBtnText}>Launch My App</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  header: { marginBottom: spacing.xl, alignItems: 'center' },
  title: { fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: { fontSize: fontSize.md, marginTop: spacing.xs },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '600' },
  cardBody: { fontSize: fontSize.md, lineHeight: 24 },
  logoutText: { fontSize: fontSize.sm, fontWeight: '600' },
  steps: { gap: spacing.sm },
  step: { fontSize: fontSize.md, lineHeight: 22 },
  launchBtn: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  launchBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.lg },
});
