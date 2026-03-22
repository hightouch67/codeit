import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts';
import { HomeScreen, AuthScreen } from '../screens';

export default function Index() {
  const { token, user, loading, signIn } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  if (!token) {
    return <AuthScreen onAuthSuccess={signIn} />;
  }

  return <HomeScreen user={user} token={token} />;
}
