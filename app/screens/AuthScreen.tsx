import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: { id: string; username: string }) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; user: { id: string; username: string } }>(
        mode === 'login' ? '/api/auth/login' : '/api/auth/register',
        { username, password }
      );
      onAuthSuccess(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <Text style={[styles.title, { color: theme.text }]}>CodeIt {mode === 'login' ? 'Login' : 'Register'}</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        placeholder="Username"
        placeholderTextColor={theme.textSecondary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!loading}
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
        placeholder="Password"
        placeholderTextColor={theme.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}
      <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleAuth} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : mode === 'login' ? 'Login' : 'Register'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={[styles.switch, { color: theme.secondary }]}>Switch to {mode === 'login' ? 'Register' : 'Login'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  input: { width: 260, height: 44, borderWidth: 1, borderRadius: 8, marginBottom: 16, paddingHorizontal: 12, fontSize: 16 },
  button: { width: 260, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 18 },
  error: { marginTop: 8, marginBottom: 8, fontSize: 15 },
  switch: { marginTop: 18, fontSize: 15, fontWeight: '500' },
});
