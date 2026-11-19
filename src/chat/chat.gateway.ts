import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { MessageType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MessagingService } from '../messaging/messaging.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly messagingService: MessagingService,
    private readonly jwtService: JwtService,
  ) {}

  notifyUser(userId: string, notification: { id: string; type: string; content: string; actionUrl?: string | null }) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private getAuthToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization ?? client.handshake.auth?.token;
    if (!authHeader) {
      return null;
    }

    return typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : String(authHeader);
  }

  private registerUserPresence(userId: string, clientId: string) {
    const sockets = this.connectedUsers.get(userId) ?? new Set<string>();
    sockets.add(clientId);
    this.connectedUsers.set(userId, sockets);
    this.server.emit('presence-update', {
      userId,
      online: true,
    });
  }

  private removeUserPresence(userId: string, clientId: string) {
    const sockets = this.connectedUsers.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(clientId);
    if (sockets.size === 0) {
      this.connectedUsers.delete(userId);
      this.server.emit('presence-update', {
        userId,
        online: false,
      });
      return;
    }

    this.connectedUsers.set(userId, sockets);
  }

  handleConnection(client: Socket) {
    const token = this.getAuthToken(client);
    if (!token) {
      client.emit('auth-error', { message: 'Missing bearer token.' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      if (!payload.sub) {
        throw new Error('Access token has no subject.');
      }

      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      this.registerUserPresence(payload.sub, client.id);
      client.emit('connected', { status: 'ok', userId: payload.sub });
    } catch {
      client.emit('auth-error', { message: 'Invalid or expired token.' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      this.removeUserPresence(userId, client.id);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!client.data.userId || !payload?.conversationId) {
      client.emit('join-error', { message: 'Unauthorized or invalid payload.' });
      return;
    }

    if (!(await this.messagingService.isConversationMember(client.data.userId, payload.conversationId))) {
      client.emit('join-error', { message: 'Conversation not found.' });
      return;
    }

    client.join(this.conversationRoom(payload.conversationId));
    client.emit('joined-room', { conversationId: payload.conversationId });
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!payload?.conversationId) {
      return;
    }

    client.leave(this.conversationRoom(payload.conversationId));
    client.emit('left-room', { conversationId: payload.conversationId });
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!client.data.userId || !payload?.conversationId ||
      !client.rooms.has(this.conversationRoom(payload.conversationId))) {
      return;
    }

    this.server.to(this.conversationRoom(payload.conversationId)).emit('typing', {
      userId: client.data.userId,
      conversationId: payload.conversationId,
      isTyping: true,
    });
  }

  @SubscribeMessage('stop-typing')
  async handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!client.data.userId || !payload?.conversationId ||
      !client.rooms.has(this.conversationRoom(payload.conversationId))) {
      return;
    }

    this.server.to(this.conversationRoom(payload.conversationId)).emit('typing', {
      userId: client.data.userId,
      conversationId: payload.conversationId,
      isTyping: false,
    });
  }

  @SubscribeMessage('voice-recording')
  handleVoiceRecording(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isRecording: boolean },
  ) {
    const userId = client.data.userId as string | undefined;
    if (
      !userId ||
      !payload?.conversationId ||
      typeof payload.isRecording !== 'boolean' ||
      !client.rooms.has(this.conversationRoom(payload.conversationId))
    ) {
      return;
    }

    this.server.to(this.conversationRoom(payload.conversationId)).except(client.id).emit('voice-recording', {
      userId,
      conversationId: payload.conversationId,
      isRecording: payload.isRecording,
    });
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!client.data.userId || !payload?.conversationId) {
      client.emit('read-error', { message: 'Invalid payload.' });
      return;
    }

    try {
      const result = await this.messagingService.markMessagesAsRead(client.data.userId, payload.conversationId);
      this.server.to(this.conversationRoom(payload.conversationId)).except(client.id).emit('messages-read', {
        conversationId: payload.conversationId,
        userId: client.data.userId,
        updatedCount: result.updatedCount,
        messageIds: result.messageIds,
      });
      client.emit('messages-read', {
        conversationId: payload.conversationId,
        userId: client.data.userId,
        updatedCount: result.updatedCount,
        messageIds: result.messageIds,
      });
    } catch (error) {
      client.emit('read-error', { message: (error as Error).message ?? 'Unable to mark messages as read.' });
    }
  }

  @SubscribeMessage('messages-delivered')
  async handleMessagesDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; messageIds: string[] },
  ) {
    const userId = client.data.userId as string | undefined;
    if (
      !userId ||
      !payload?.conversationId ||
      !Array.isArray(payload.messageIds) ||
      payload.messageIds.length === 0 ||
      payload.messageIds.length > 100 ||
      payload.messageIds.some((messageId) => typeof messageId !== 'string')
    ) {
      client.emit('delivery-error', { message: 'Invalid payload.' });
      return;
    }

    try {
      const result = await this.messagingService.markMessagesAsDelivered(
        userId,
        payload.conversationId,
        payload.messageIds,
      );
      this.server.to(this.conversationRoom(payload.conversationId)).emit('messages-delivered', {
        conversationId: payload.conversationId,
        userId,
        messageIds: result.messageIds,
        updatedCount: result.updatedCount,
      });
    } catch (error) {
      client.emit('delivery-error', { message: (error as Error).message ?? 'Unable to update delivery status.' });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; type?: MessageType; content?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId || !payload?.conversationId || !payload?.content) {
      client.emit('message-error', { message: 'Invalid payload.' });
      return;
    }

    try {
      const message = await this.messagingService.sendMessage(userId, payload.conversationId, {
        type: payload.type,
        content: payload.content,
      });

      this.server.to(this.conversationRoom(payload.conversationId)).emit('new-message', message);
      for (const receipt of message.receipts) {
        this.server.to(`user:${receipt.userId}`).emit('notification:new', {
          type: 'NewMessage',
          conversationId: payload.conversationId,
          messageId: message.id,
          sender: message.sender,
          createdAt: message.createdAt,
        });
      }
      client.emit('message-sent', message);
    } catch (error) {
      client.emit('message-error', { message: (error as Error).message ?? 'Unable to send message.' });
    }
  }
}
