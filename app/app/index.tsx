import React, { useState, useEffect } from 'react';
import { HomeScreen, AuthScreen } from '../screens';

export default function Index() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => {
    // Try to load token from localStorage (web) or AsyncStorage (native) in a real app
    // For now, just keep in memory
  }, []);

  if (!token) {
    return (
      <AuthScreen
        onAuthSuccess={(tok, usr) => {
          setToken(tok);
          setUser(usr);
        }}
      />
    );
  }

  return <HomeScreen user={user} token={token} />;
}
