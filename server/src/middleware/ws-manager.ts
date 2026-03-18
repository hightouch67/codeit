import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { Job, WSMessage } from '../types/index.js';

class WSManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log(`[WS] Client connected. Total: ${this.clients.size}`);

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });
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
    this.broadcast({
      type: 'job_update',
      payload: {
        jobId: job.id,
        status: job.status,
        message: job.message,
        error: job.error,
        commitSha: job.commitSha,
        operations: job.operations,
      },
    });
  }

  broadcastLog(message: string): void {
    this.broadcast({ type: 'log', payload: message });
  }
}

export const wsManager = new WSManager();
