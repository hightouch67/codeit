import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>CodeIt</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          AI-powered app builder
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Welcome</Text>
        <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
          Describe what you want to build and let AI generate the code for you. 
          Open the chat widget to get started.
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
            <Text key={i} style={[styles.step, { color: theme.textSecondary }]}>
              {step}
            </Text>
          ))}
        </View>
      </View>
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
  cardTitle: { fontSize: fontSize.lg, fontWeight: '600', marginBottom: spacing.sm },
  cardBody: { fontSize: fontSize.md, lineHeight: 24 },
  steps: { gap: spacing.sm },
  step: { fontSize: fontSize.md, lineHeight: 22 },
});
