import Constants from 'expo-constants';

const ENV = {
  API_URL: Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3001',
  WS_URL: Constants.expoConfig?.extra?.wsUrl ?? 'ws://localhost:3001/ws',
};

export const config = {
  apiUrl: ENV.API_URL,
  wsUrl: ENV.WS_URL,
} as const;
