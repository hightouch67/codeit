import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import { ChatWidget } from '../components/ChatWidget';
import { getUrlParam, storeSession, getSession } from '../utils/config';

export default function Index() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On first load, check URL param (set by CodeIt dashboard when opening the app)
    const urlToken = getUrlParam('token');
    if (urlToken) {
      storeSession('codeit_token', urlToken);
      setToken(urlToken);
      // Clean token from URL bar without reloading
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
      }
    } else {
      // Restore from session storage (survives page refresh)
      const saved = getSession('codeit_token');
      if (saved) setToken(saved);
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <>
      <HomeScreen />
      {token && <ChatWidget token={token} />}
    </>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
