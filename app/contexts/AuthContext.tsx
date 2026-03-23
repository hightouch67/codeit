import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'codeit_token';
const USER_KEY = 'codeit_user';

interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

async function saveToStorage(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getFromStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function removeFromStorage(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await getFromStorage(TOKEN_KEY);
        const savedUser = await getFromStorage(USER_KEY);
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    await saveToStorage(TOKEN_KEY, newToken);
    await saveToStorage(USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await removeFromStorage(TOKEN_KEY);
    await removeFromStorage(USER_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
