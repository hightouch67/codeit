import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useWebSocket } from '../hooks/useWebSocket';
import { sendPrompt } from '../services/api';
import { config, generateId, formatTimestamp } from '../utils';
import { spacing, fontSize, borderRadius } from '../theme';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: string;
}

const WINDOW_HEIGHT = Dimensions.get('window').height;
const USER_ID = 'default-user'; // In production, from auth
const REPO_NAME = 'codeit-app';

export function ChatWidget() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Welcome! Describe what you want to build or modify.',
      timestamp: Date.now(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(WINDOW_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleWSMessage = useCallback((data: unknown) => {
    const msg = data as { type: string; payload: Record<string, unknown> };
    if (msg.type === 'job_update') {
      const payload = msg.payload as { status: string; message?: string; error?: string; commitSha?: string };
      const statusText =
        payload.status === 'completed'
          ? `Done! Commit: ${payload.commitSha ?? 'applied'}`
          : payload.status === 'failed'
          ? `Error: ${payload.error ?? 'unknown'}`
          : `Status: ${payload.status}${payload.message ? ` — ${payload.message}` : ''}`;

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: statusText,
          timestamp: Date.now(),
          status: payload.status,
        },
      ]);

      if (payload.status === 'completed' || payload.status === 'failed') {
        setLoading(false);
      }
    } else if (msg.type === 'log') {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'system',
          content: String(msg.payload),
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  useWebSocket({ url: config.wsUrl, onMessage: handleWSMessage });

  const toggle = () => {
    const toValue = open ? WINDOW_HEIGHT : 0;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setOpen(!open);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { jobId } = await sendPrompt({
        userId: USER_ID,
        prompt: text,
        repoName: REPO_NAME,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'system',
          content: `Job queued: ${jobId}`,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: `Failed to send: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: Date.now(),
          status: 'failed',
        },
      ]);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isUser
                ? theme.chatBubbleUser
                : isSystem
                ? 'transparent'
                : theme.chatBubbleAssistant,
              borderColor: isSystem ? theme.border : 'transparent',
              borderWidth: isSystem ? 1 : 0,
            },
          ]}
        >
          <Text
            style={[
              styles.msgText,
              {
                color: isUser ? theme.chatTextUser : theme.chatTextAssistant,
                fontStyle: isSystem ? 'italic' : 'normal',
              },
            ]}
          >
            {item.content}
          </Text>
          <Text style={[styles.msgTime, { color: isUser ? 'rgba(255,255,255,0.6)' : theme.textSecondary }]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>{open ? '✕' : '💬'}</Text>
      </TouchableOpacity>

      {/* Chat Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: theme.background,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <KeyboardAvoidingView
          style={styles.panelInner}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.panelTitle, { color: theme.text }]}>AI Chat</Text>
            {loading && (
              <View style={[styles.statusDot, { backgroundColor: theme.warning }]} />
            )}
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.msgList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />

          {/* Input */}
          <View style={[styles.inputRow, { borderTopColor: theme.border }]}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surface,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder="Describe a change..."
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={2000}
              editable={!loading}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: loading ? theme.textSecondary : theme.primary }]}
              onPress={handleSend}
              disabled={loading}
            >
              <Text style={styles.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
  fabText: { fontSize: 22 },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  panelInner: { flex: 1 },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    paddingTop: 50,
  },
  panelTitle: { fontSize: fontSize.lg, fontWeight: '700', flex: 1 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  msgList: { padding: spacing.md, paddingBottom: spacing.xl },
  msgRow: { marginBottom: spacing.sm, alignItems: 'flex-start' },
  msgRowUser: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  msgText: { fontSize: fontSize.sm, lineHeight: 20 },
  msgTime: { fontSize: fontSize.xs, marginTop: spacing.xs, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    maxHeight: 100,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
