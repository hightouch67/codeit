import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts';
import { HomeScreen, AuthScreen } from '../screens';
import { ChatWidget } from '../components/ChatWidget';

export default function Index() {
  const { token, user, loading, login } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  if (!token) {
    return (
      <AuthScreen
        onAuthSuccess={async (tok, usr) => {
          await login(tok, usr);
        }}
      />
    );
  }

  return (
    <>
      <HomeScreen user={user} token={token} />
      <ChatWidget />
    </>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
