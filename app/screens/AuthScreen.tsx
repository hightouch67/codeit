import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: { id: string; username: string }) => Promise<void>;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!username.trim()) return 'Username is required';
    if (mode === 'register' && username.trim().length < 3) return 'Username must be at least 3 characters';
    if (!password) return 'Password is required';
    if (mode === 'register' && password.length < 8) return 'Password must be at least 8 characters';
    return null;
  };

  const handleAuth = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; user: { id: string; username: string } }>(
        mode === 'login' ? '/api/auth/login' : '/api/auth/register',
        { username: username.trim(), password },
      );
      await onAuthSuccess(res.token, res.user);
    } catch (err: any) {
      const msg = err.message || 'Auth failed';
      // Extract readable error from API response
      try {
        const parsed = JSON.parse(msg.replace(/^API \d+: /, ''));
        setError(parsed.error || msg);
      } catch {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={[styles.brand, { color: theme.primary }]}>CodeIt</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {mode === 'login' ? 'Sign in to continue building' : 'Start building with AI'}
        </Text>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="Username"
          placeholderTextColor={theme.textSecondary}
          value={username}
          onChangeText={(t) => { setUsername(t); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); }}
          secureTextEntry
          editable={!loading}
          returnKeyType="done"
          onSubmitEditing={handleAuth}
        />

        {error && (
          <View style={[styles.errorBox, { backgroundColor: theme.error + '15', borderColor: theme.error + '30' }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: loading ? theme.textSecondary : theme.primary }]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
          <Text style={[styles.switch, { color: theme.secondary }]}>
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  brand: { fontSize: fontSize.xxl, fontWeight: '800', marginBottom: spacing.xs },
  title: { fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, marginBottom: spacing.xl },
  input: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: fontSize.lg },
  errorBox: {
    width: '100%',
    maxWidth: 320,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  errorText: { fontSize: fontSize.sm, textAlign: 'center' },
  switch: { marginTop: spacing.lg, fontSize: fontSize.sm, fontWeight: '500' },
});
