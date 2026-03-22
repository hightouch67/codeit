import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import type { Job, WSMessage } from '../types/index.js';

const HEARTBEAT_INTERVAL = 30_000;

interface AuthenticatedWS extends WebSocket {
  userId?: string;
  username?: string;
}

class WSManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<AuthenticatedWS>();
  private alive = new WeakMap<WebSocket, boolean>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWS, req: IncomingMessage) => {
      // Authenticate via query param token
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token');

      if (token) {
        try {
          const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; username: string };
          ws.userId = payload.userId;
          ws.username = payload.username;
        } catch {
          // Invalid token — still allow connection but unscoped
          console.warn('[WS] Client connected with invalid token');
        }
      }

      this.clients.add(ws);
      this.alive.set(ws, true);
      console.log(`[WS] Client connected (user: ${ws.userId ?? 'anonymous'}). Total: ${this.clients.size}`);

      ws.on('pong', () => {
        this.alive.set(ws, true);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });

    // Ping all clients periodically; terminate unresponsive ones
    this.heartbeatTimer = setInterval(() => {
      for (const ws of this.clients) {
        if (!this.alive.get(ws)) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        this.alive.set(ws, false);
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL);
    this.heartbeatTimer.unref();
  }

  /**
   * Broadcast to all connected clients.
   */
  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Send a message only to clients authenticated as the given userId.
   */
  sendToUser(userId: string, message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(data);
      }
    }
  }

  broadcastJobUpdate(job: Job): void {
    const msg: WSMessage = {
      type: 'job_update',
      payload: {
        jobId: job.id,
        status: job.status,
        message: job.message,
        error: job.error,
        commitSha: job.commitSha,
        operations: job.operations,
      },
    };

    // Scope job updates to the owning user
    if (job.userId) {
      this.sendToUser(job.userId, msg);
    } else {
      this.broadcast(msg);
    }
  }

  broadcastLog(message: string): void {
    this.broadcast({ type: 'log', payload: message });
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WSManager();
