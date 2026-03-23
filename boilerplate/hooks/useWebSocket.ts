import { useState, useEffect, useRef, useCallback } from 'react';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  reconnectInterval?: number;
  maxRetries?: number;
  enabled?: boolean;
}

export function useWebSocket({ url, onMessage, reconnectInterval = 3000, maxRetries = 5, enabled = true }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const connect = useCallback(() => {
    if (!enabled || !url) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('connected');
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch {
        onMessage?.(event.data);
      }
    };

    ws.onerror = () => setStatus('error');

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      if (enabled && retriesRef.current < maxRetries) {
        retriesRef.current++;
        reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
      }
    };

    wsRef.current = ws;
  }, [url, onMessage, reconnectInterval, maxRetries, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    retriesRef.current = maxRetries;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, [maxRetries]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (enabled) connect();
    else disconnect();
    return () => { disconnect(); };
  }, [enabled, connect, disconnect]);

  return { status, send, disconnect, reconnect: connect };
}
