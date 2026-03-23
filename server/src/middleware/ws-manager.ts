import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import type { Server, IncomingMessage } from 'http';
import type { Job, WSMessage } from '../types/index.js';
import { env } from '../config/index.js';

interface AuthenticatedWS extends WebSocket {
  userId?: string;
  username?: string;
}

const HEARTBEAT_INTERVAL = 30_000;

class WSManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<AuthenticatedWS>();
  private alive = new WeakMap<WebSocket, boolean>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWS, req: IncomingMessage) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token');

      if (token) {
        try {
          const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; username: string };
          ws.userId = payload.userId;
          ws.username = payload.username;
        } catch {
          ws.close(4001, 'Invalid token');
          return;
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

  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

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

    if (job.userId) {
      this.sendToUser(job.userId, msg);
    } else {
      this.broadcast(msg);
    }
  }

  broadcastLog(message: string, userId?: string): void {
    const msg: WSMessage = { type: 'log', payload: message };
    if (userId) {
      this.sendToUser(userId, msg);
    } else {
      this.broadcast(msg);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WSManager();
