import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts';
import { spacing, fontSize, borderRadius } from '../theme';
import { api, getJobHistory, setAuthToken } from '../services/api';
import { formatTimestamp } from '../utils/helpers';

interface HomeScreenProps {
  user: { id: string; username: string } | null;
  token: string;
}

interface JobSummary {
  jobId: string;
  status: string;
  message?: string;
  prompt?: string;
  createdAt: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#00b894',
  failed: '#d63031',
  processing: '#fdcb6e',
  ai_calling: '#fdcb6e',
  queued: '#636e72',
};

export default function HomeScreen({ user, token }: HomeScreenProps) {
  const theme = useTheme();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const loadJobs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getJobHistory(user.id);
      setJobs(data);
    } catch {
      // Silently fail — jobs will be empty
    }
  }, [user]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const handleLaunchApp = async () => {
    setLoading(true);
    setError(null);
    setAppUrl(null);
    try {
      const { url } = await api.post<{ url: string }>(
        '/api/app/start',
        {},
        { Authorization: `Bearer ${token}` },
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

  const handleStopApp = async () => {
    try {
      await api.post('/api/app/stop', {}, { Authorization: `Bearer ${token}` });
      setAppUrl(null);
    } catch {}
  };

  const handleOpenApp = () => {
    if (appUrl) {
      const urlWithToken = `${appUrl}?token=${encodeURIComponent(token)}`;
      Linking.openURL(urlWithToken);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>CodeIt</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>AI-powered app builder</Text>
        </View>
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: theme.border }]}
          onPress={logout}
        >
          <Text style={{ color: theme.textSecondary, fontSize: fontSize.sm }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Welcome, {user?.username || 'user'}!</Text>
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
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textSecondary, marginTop: spacing.md }}>Starting your app...</Text>
        </View>
      ) : appUrl ? (
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Text style={{ color: theme.success, marginBottom: spacing.sm, fontWeight: '600' }}>Your app is running!</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={handleOpenApp}>
              <Text style={styles.actionBtnText}>Open App</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.error }]} onPress={handleStopApp}>
              <Text style={styles.actionBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: theme.textSecondary, marginTop: spacing.xs, fontSize: fontSize.xs }}>{appUrl}</Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.launchBtn, { backgroundColor: theme.primary }]} onPress={handleLaunchApp}>
          <Text style={styles.launchBtnText}>Launch My App</Text>
        </TouchableOpacity>
      )}

      {jobs.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[styles.cardTitle, { color: theme.text, marginBottom: spacing.sm }]}>Recent Jobs</Text>
          {jobs.slice(0, 10).map((job) => (
            <View
              key={job.jobId}
              style={[styles.jobItem, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[job.status] ?? theme.textSecondary }]} />
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: fontSize.sm, flex: 1 }}>
                  {job.status.replace(/_/g, ' ')}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: fontSize.xs }}>
                  {formatTimestamp(job.createdAt)}
                </Text>
              </View>
              {job.prompt && (
                <Text style={{ color: theme.textSecondary, fontSize: fontSize.sm }} numberOfLines={2}>
                  {job.prompt}
                </Text>
              )}
              {job.message && (
                <Text style={{ color: theme.textSecondary, fontSize: fontSize.xs, marginTop: spacing.xs }} numberOfLines={1}>
                  {job.message}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.xl, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: { fontSize: fontSize.md, marginTop: spacing.xs },
  logoutBtn: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '600', marginBottom: spacing.sm },
  cardBody: { fontSize: fontSize.md, lineHeight: 24 },
  steps: { gap: spacing.sm },
  step: { fontSize: fontSize.md, lineHeight: 22 },
  launchBtn: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  launchBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.lg },
  actionBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: fontSize.md },
  jobItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
});
