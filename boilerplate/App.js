import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function ChatWidget() {
  return (
    <View style={styles.chatContainer}>
      <Text style={styles.chatText}>💬 Chat coming soon!</Text>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to your CodeIt App!</Text>
      <ChatWidget />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  chatContainer: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  chatText: {
    fontSize: 18,
    color: '#333',
  },
});
