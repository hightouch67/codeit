import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Job, WSMessage } from '../types/index.js';
import { env } from '../config/index.js';

interface AuthenticatedWS extends WebSocket {
  userId?: string;
}

class WSManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<AuthenticatedWS>();

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWS, req: IncomingMessage) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (token) {
        try {
          const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
          ws.userId = payload.userId;
        } catch {
          ws.close(4001, 'Invalid token');
          return;
        }
      }

      this.clients.add(ws);
      console.log(`[WS] Client connected (user: ${ws.userId ?? 'anonymous'}). Total: ${this.clients.size}`);

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });

      // Heartbeat
      ws.on('pong', () => { (ws as any)._alive = true; });
      (ws as any)._alive = true;
    });

    // Heartbeat interval to clean up stale connections
    setInterval(() => {
      for (const ws of this.clients) {
        if ((ws as any)._alive === false) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        (ws as any)._alive = false;
        ws.ping();
      }
    }, 30_000);
  }

  sendToUser(userId: string, message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(data);
      }
    }
  }

  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
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
}

export const wsManager = new WSManager();
