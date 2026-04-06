import websocket from '@fastify/websocket';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma';

interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

interface WsSession {
  id: string;
  socket: WsLikeSocket;
  buffer: string;
  connected: boolean;
  username: string | null;
  subscriptions: Map<string, string>; // subId -> destination
}

interface WsLikeSocket {
  readyState: number;
  close: (code?: number, reason?: string) => void;
  send: (data: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

const WS_OPEN = 1;
interface JwtPayload {
  sub: string;
}

const DEST = {
  ECHO: '/app/ws/echo',
  PRIVATE: '/app/ws/private',
  BROADCAST: '/topic/ws/broadcast',
  PRIVATE_QUEUE: '/user/queue/ws/private',
};

@Injectable()
export class StompWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StompWsService.name);

  private sessions = new Set<WsSession>();
  private sessionsByUser = new Map<string, Set<WsSession>>();

  // 🚀 核心优化：destination -> subscribers
  private destinationIndex = new Map<
    string,
    Set<{ session: WsSession; subId: string }>
  >();

  private tickTimer: NodeJS.Timeout | null = null;
  private registered = false;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    if (this.registered) return;

    const app = this.httpAdapterHost.httpAdapter.getInstance<FastifyInstance>();
    await app.register(websocket);

    const path = this.config.get<string>('ws.path', '/ws');

    app.get(path, { websocket: true }, (conn) => {
      this.handleConnection(conn as unknown);
    });

    this.startHeartbeat();
    this.registered = true;

    this.logger.log(`WS ready at ${path}`);
  }

  onModuleDestroy() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    for (const s of this.sessions) {
      s.socket.close(1001, 'shutdown');
      this.cleanup(s);
    }
  }

  // ================== connection ==================

  private handleConnection(connection: unknown) {
    const socket = this.resolveSocket(connection);
    if (!socket) return;

    const session: WsSession = {
      id: randomUUID(),
      socket,
      buffer: '',
      connected: false,
      username: null,
      subscriptions: new Map(),
    };

    this.sessions.add(session);

    socket.on('message', (raw) => {
      void this.onRaw(session, raw);
    });
    socket.on('close', () => this.cleanup(session));
    socket.on('error', () => this.cleanup(session));
  }

  private resolveSocket(conn: unknown): WsLikeSocket | null {
    if (!conn || typeof conn !== 'object') {
      return null;
    }

    const withSocket = conn as { socket?: unknown };
    if (this.isWsLikeSocket(withSocket.socket)) {
      return withSocket.socket;
    }

    if (this.isWsLikeSocket(conn)) {
      return conn;
    }

    return null;
  }

  private isWsLikeSocket(value: unknown): value is WsLikeSocket {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const socket = value as Partial<WsLikeSocket>;
    return (
      typeof socket.readyState === 'number' &&
      typeof socket.close === 'function' &&
      typeof socket.send === 'function' &&
      typeof socket.on === 'function'
    );
  }

  // ================== message ==================

  private async onRaw(session: WsSession, raw: unknown) {
    session.buffer += this.toString(raw);

    while (true) {
      const idx = session.buffer.indexOf('\0');
      if (idx < 0) break;

      const frameStr = session.buffer.slice(0, idx);
      session.buffer = session.buffer.slice(idx + 1);

      if (!frameStr.trim()) continue;

      const frame = this.parseFrame(frameStr);
      await this.handleFrame(session, frame);
    }
  }

  private async handleFrame(session: WsSession, frame: StompFrame) {
    const cmd = frame.command;

    if (cmd === 'CONNECT' || cmd === 'STOMP') {
      return this.handleConnect(session, frame);
    }

    if (!session.connected) throw new Error('unauth');

    switch (cmd) {
      case 'SUBSCRIBE':
        return this.subscribe(session, frame);
      case 'UNSUBSCRIBE':
        return this.unsubscribe(session, frame);
      case 'SEND':
        return this.handleSend(session, frame);
      case 'DISCONNECT':
        return session.socket.close(1000);
    }
  }

  // ================== auth ==================

  private async handleConnect(session: WsSession, frame: StompFrame) {
    const token = frame.headers['authorization']?.replace('Bearer ', '');
    if (!token) throw new Error('no token');

    const secret = this.config.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('jwt secret missing');
    }

    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, isActive: true },
    });

    if (!user?.isActive) throw new Error('invalid user');

    session.connected = true;
    session.username = user.email;

    if (!this.sessionsByUser.has(user.email)) {
      this.sessionsByUser.set(user.email, new Set());
    }
    this.sessionsByUser.get(user.email)!.add(session);

    this.send(session.socket, 'CONNECTED', {
      version: '1.2',
      'heart-beat': '10000,10000',
    });
  }

  // ================== subscribe ==================

  private subscribe(session: WsSession, frame: StompFrame) {
    const dest = frame.headers['destination'];
    const id = frame.headers['id'];

    session.subscriptions.set(id, dest);

    if (!this.destinationIndex.has(dest)) {
      this.destinationIndex.set(dest, new Set());
    }

    this.destinationIndex.get(dest)!.add({ session, subId: id });
  }

  private unsubscribe(session: WsSession, frame: StompFrame) {
    const id = frame.headers['id'];
    const dest = session.subscriptions.get(id);

    if (dest) {
      this.destinationIndex.get(dest)?.forEach((s) => {
        if (s.session === session && s.subId === id) {
          this.destinationIndex.get(dest)!.delete(s);
        }
      });
    }

    session.subscriptions.delete(id);
  }

  // ================== send ==================

  private handleSend(session: WsSession, frame: StompFrame) {
    const dest = frame.headers['destination'];
    const message = this.extractMessage(frame.body);

    if (dest === DEST.ECHO) {
      this.publish(DEST.BROADCAST, { sender: session.username, message });
      return;
    }

    if (dest === DEST.PRIVATE) {
      this.publishUser(session.username!, DEST.PRIVATE_QUEUE, {
        sender: session.username,
        message,
      });
      return;
    }
  }

  // ================== publish ==================

  private publish(dest: string, payload: Record<string, unknown>) {
    const subs = this.destinationIndex.get(dest);
    if (!subs) return;

    const body = JSON.stringify(payload);

    for (const { session, subId } of subs) {
      if (!session.connected) continue;

      this.send(
        session.socket,
        'MESSAGE',
        {
          subscription: subId,
          'message-id': randomUUID(),
          destination: dest,
        },
        body,
      );
    }
  }

  private publishUser(
    username: string,
    dest: string,
    payload: Record<string, unknown>,
  ) {
    const sessions = this.sessionsByUser.get(username);
    if (!sessions) return;

    const body = JSON.stringify(payload);

    for (const session of sessions) {
      if (!session.connected) continue;

      for (const [subId, subscribedDest] of session.subscriptions) {
        if (subscribedDest !== dest) continue;

        this.send(
          session.socket,
          'MESSAGE',
          {
            subscription: subId,
            'message-id': randomUUID(),
            destination: dest,
          },
          body,
        );
      }
    }
  }

  // ================== utils ==================

  private send(
    socket: WsLikeSocket,
    cmd: string,
    headers: Record<string, string>,
    body = '',
  ) {
    if (socket.readyState !== WS_OPEN) return;

    const lines = [cmd];
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`${key}:${value}`);
    }
    lines.push('', body);

    socket.send(lines.join('\n') + '\0');
  }

  private parseFrame(raw: string): StompFrame {
    const [head, body = ''] = raw.split('\n\n');
    const lines = head.split('\n');

    const command = lines[0];
    const headers: Record<string, string> = {};

    for (let i = 1; i < lines.length; i++) {
      const [k, ...rest] = lines[i].split(':');
      if (!k) continue;
      headers[k.toLowerCase()] = rest.join(':');
    }

    return { command, headers, body };
  }

  private toString(raw: unknown): string {
    if (typeof raw === 'string') return raw;
    if (raw instanceof Buffer) return raw.toString('utf8');
    if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer).toString();
    if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString();
    return '';
  }

  private extractMessage(body: string): string {
    if (!body.trim()) return '(empty)';
    try {
      const parsed = JSON.parse(body) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'message' in parsed &&
        typeof (parsed as { message?: unknown }).message === 'string'
      ) {
        return (parsed as { message: string }).message;
      }
      return '(empty)';
    } catch {
      return body;
    }
  }

  private cleanup(session: WsSession) {
    if (!this.sessions.has(session)) return;

    this.sessions.delete(session);

    if (session.username) {
      const set = this.sessionsByUser.get(session.username);
      set?.delete(session);
      if (set?.size === 0) this.sessionsByUser.delete(session.username);
    }

    for (const [id, dest] of session.subscriptions) {
      this.destinationIndex.get(dest)?.forEach((s) => {
        if (s.session === session && s.subId === id) {
          this.destinationIndex.get(dest)!.delete(s);
        }
      });
    }
  }

  private startHeartbeat() {
    this.tickTimer = setInterval(() => {
      for (const s of this.sessions) {
        if (s.socket.readyState === WS_OPEN) {
          s.socket.send('\n'); // STOMP heartbeat
        }
      }
    }, 10000);
  }
}
