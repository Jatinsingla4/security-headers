/**
 * Secure WebSocket Room — Durable Object
 *
 * Handles real-time WebSocket connections with:
 * - Token-based authentication on upgrade
 * - Origin validation
 * - Connection throttling (max connections per user)
 * - Message rate limiting
 */

import type { Env } from "../../types" ;
import { verifyToken, type AuthUser } from "../security/auth";

interface ConnectedClient {
  webSocket: WebSocket;
  user: AuthUser;
  connectedAt: number;
  messageCount: number;
  lastMessageAt: number;
}

const MAX_CONNECTIONS_PER_USER = 5;
const MAX_MESSAGES_PER_SECOND = 10;
const ALLOWED_ORIGINS = new Set([
  "https://securityheaders.com",
  "https://app.securityheaders.com",
]);

export class WebSocketRoom implements DurableObject {
  private connections = new Map<string, ConnectedClient>();
  private userConnectionCounts = new Map<string, number>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    if (url.pathname === "/stats") {
      return new Response(
        JSON.stringify({
          totalConnections: this.connections.size,
          uniqueUsers: this.userConnectionCounts.size,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // 1. Validate WebSocket upgrade
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // 2. Validate origin
    const origin = request.headers.get("Origin") ?? "";
    if (this.env.ENVIRONMENT === "production" && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }

    // 3. Authenticate via token in query string (WebSocket can't use headers)
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing authentication token", { status: 401 });
    }

    const authResult = await verifyToken(token, this.env.JWT_SECRET);
    if (!authResult.authenticated || !authResult.user) {
      return new Response("Invalid or expired token", { status: 401 });
    }

    // 4. Connection throttling — limit connections per user
    const userId = authResult.user.sub;
    const currentCount = this.userConnectionCounts.get(userId) ?? 0;
    if (currentCount >= MAX_CONNECTIONS_PER_USER) {
      return new Response("Too many connections", { status: 429 });
    }

    // 5. Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);

    const connectionId = crypto.randomUUID();
    this.connections.set(connectionId, {
      webSocket: server,
      user: authResult.user,
      connectedAt: Date.now(),
      messageCount: 0,
      lastMessageAt: 0,
    });
    this.userConnectionCounts.set(userId, currentCount + 1);

    // Tag the WebSocket for hibernation API lookups
    server.serializeAttachment({ connectionId, userId });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as {
      connectionId: string;
      userId: string;
    } | null;

    if (!attachment) {
      ws.close(1008, "Invalid connection state");
      return;
    }

    const conn = this.connections.get(attachment.connectionId);
    if (!conn) {
      ws.close(1008, "Connection not found");
      return;
    }

    // Message rate limiting
    const now = Date.now();
    if (now - conn.lastMessageAt < 1000) {
      conn.messageCount++;
      if (conn.messageCount > MAX_MESSAGES_PER_SECOND) {
        ws.close(1008, "Message rate limit exceeded");
        this.removeConnection(attachment.connectionId, attachment.userId);
        return;
      }
    } else {
      conn.messageCount = 1;
    }
    conn.lastMessageAt = now;

    // Validate message size (prevent DoS via large payloads)
    const msgSize = typeof message === "string" ? message.length : message.byteLength;
    if (msgSize > 64 * 1024) {
      ws.close(1009, "Message too large");
      this.removeConnection(attachment.connectionId, attachment.userId);
      return;
    }

    // Broadcast to all other connections in this room
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    for (const [id, client] of this.connections) {
      if (id !== attachment.connectionId) {
        try {
          client.webSocket.send(text);
        } catch {
          this.removeConnection(id, client.user.sub);
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as {
      connectionId: string;
      userId: string;
    } | null;

    if (attachment) {
      this.removeConnection(attachment.connectionId, attachment.userId);
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as {
      connectionId: string;
      userId: string;
    } | null;

    if (attachment) {
      this.removeConnection(attachment.connectionId, attachment.userId);
    }
  }

  private removeConnection(connectionId: string, userId: string): void {
    this.connections.delete(connectionId);
    const count = this.userConnectionCounts.get(userId) ?? 1;
    if (count <= 1) {
      this.userConnectionCounts.delete(userId);
    } else {
      this.userConnectionCounts.set(userId, count - 1);
    }
  }
}
