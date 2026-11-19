import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunitiesService } from '../communities/communities.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communitiesService: CommunitiesService,
    private readonly storageService: StorageService,
  ) {}

  async listConversations(userId: string, beforeId?: string) {
    const cursor = beforeId
      ? await this.prisma.conversation.findFirst({
          where: {
            id: beforeId,
            members: { some: { userId, leftAt: null } },
          },
          select: { id: true, updatedAt: true },
        })
      : null;

    if (beforeId && !cursor) {
      throw new BadRequestException('Conversation cursor is invalid.');
    }

    return this.prisma.conversation.findMany({
      where: {
        members: { some: { userId, leftAt: null } },
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: {
        members: {
          where: { leftAt: null },
          take: 2,
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true, lastSeenAt: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: { some: { userId, leftAt: null } },
      },
      include: {
        members: {
          where: { leftAt: null },
          take: 2,
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true, lastSeenAt: true } },
          },
        },
        messages: {
          include: {
            sender: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
            reactions: true,
            receipts: { take: 20 },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    conversation.messages.reverse();
    return conversation;
  }

  async createConversation(userId: string, payload: { targetUserId: string }) {
    const targetUserId = payload.targetUserId;

    if (!targetUserId || targetUserId === userId) {
      throw new BadRequestException('A valid participant is required to start a conversation.');
    }

    const otherUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, status: 'Active', deletedAt: null },
      select: { id: true },
    });
    if (!otherUser) {
      throw new NotFoundException('Target user not found.');
    }

    await this.communitiesService.ensureDefaultCommunity(userId);
    await this.communitiesService.ensureDefaultCommunity(targetUserId);
    const publicCommunity = await this.prisma.community.findFirst({
      where: { isDefault: true, type: 'Public' },
      select: { id: true },
    });
    if (!publicCommunity) {
      throw new NotFoundException('The official public community is not available.');
    }

    const communityMembers = await this.prisma.communityMember.findMany({
      where: {
        communityId: publicCommunity.id,
        userId: { in: [userId, targetUserId] },
        status: 'Active',
      },
      select: { userId: true },
    });
    if (communityMembers.length !== 2) {
      throw new ForbiddenException('Both people must be active members of the public community to start a chat.');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'Direct',
        AND: [
          { members: { some: { userId, leftAt: null } } },
          { members: { some: { userId: targetUserId, leftAt: null } } },
          { members: { none: { userId: { notIn: [userId, targetUserId] }, leftAt: null } } },
        ],
      },
      include: { members: { where: { leftAt: null } } },
    });

    if (existing && existing.members.length === 2) {
      return this.getConversation(userId, existing.id);
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'Direct',
        title: null,
        members: {
          create: [
            { userId },
            { userId: targetUserId },
          ],
        },
      },
    });

    return this.getConversation(userId, conversation.id);
  }

  async listMessages(userId: string, conversationId: string, beforeId?: string) {
    if (!await this.isConversationMember(userId, conversationId)) {
      throw new NotFoundException('Conversation not found.');
    }

    const cursor = beforeId
      ? await this.prisma.message.findFirst({
          where: { id: beforeId, conversationId },
          select: { id: true, createdAt: true },
        })
      : null;

    if (beforeId && !cursor) {
      throw new BadRequestException('Message cursor is invalid.');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        reactions: true,
        receipts: { take: 20 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });

    return messages.reverse();
  }

  async isConversationMember(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findFirst({
      where: { userId, conversationId, leftAt: null },
      select: { id: true },
    });

    return Boolean(membership);
  }

  async markMessagesAsDelivered(userId: string, conversationId: string, messageIds: string[]) {
    if (!await this.isConversationMember(userId, conversationId)) {
      throw new NotFoundException('Conversation not found.');
    }
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true } });
    if (conversation?.type !== 'Direct') {
      return { success: true, updatedCount: 0, messageIds: [] };
    }

    const now = new Date();
    const where = {
      userId,
      deliveredAt: null,
      message: { conversationId, senderId: { not: userId } },
      ...(messageIds.length ? { messageId: { in: messageIds } } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const pendingReceipts = await tx.messageReceipt.findMany({
        where,
        select: { messageId: true },
      });

      if (!pendingReceipts.length) {
        return { success: true, updatedCount: 0, messageIds: [] };
      }

      await tx.messageReceipt.updateMany({
        where,
        data: { deliveredAt: now },
      });

      return {
        success: true,
        updatedCount: pendingReceipts.length,
        messageIds: pendingReceipts.map(({ messageId }) => messageId),
      };
    });
  }

  async markMessagesAsRead(userId: string, conversationId: string) {
    if (!await this.isConversationMember(userId, conversationId)) {
      throw new NotFoundException('Conversation not found.');
    }
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { type: true } });
    if (conversation?.type !== 'Direct') {
      return { success: true, updatedCount: 0, messageIds: [] };
    }

    const where = {
      userId,
      readAt: null,
      message: { conversationId, senderId: { not: userId } },
    };

    return this.prisma.$transaction(async (tx) => {
      const unreadReceipts = await tx.messageReceipt.findMany({
        where,
        select: { messageId: true },
      });

      const now = new Date();
      if (unreadReceipts.length) {
        await tx.messageReceipt.updateMany({
          where,
          data: { readAt: now, deliveredAt: now },
        });
      }
      await tx.notification.updateMany({
        where: { userId, type: 'NewMessage', entityId: conversationId, isRead: false },
        data: { isRead: true },
      });

      return {
        success: true,
        updatedCount: unreadReceipts.length,
        messageIds: unreadReceipts.map(({ messageId }) => messageId),
      };
    });
  }

  async sendMessage(userId: string, conversationId: string, payload: { type?: MessageType; content: string }) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        members: { some: { userId, leftAt: null } },
      },
      select: { id: true, type: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const type = payload.type ?? MessageType.Text;
    if (!Object.values(MessageType).includes(type)) {
      throw new BadRequestException('Unsupported message type.');
    }

    const content = payload.content?.trim();
    if (!content) {
      throw new BadRequestException('Message content is required.');
    }
    if (content.length > 10000) {
      throw new BadRequestException('Message content is too long.');
    }

    if (type === MessageType.Image || type === MessageType.Audio) {
      const asset = await this.prisma.mediaAsset.findFirst({
        where: {
          id: content,
          ownerId: userId,
          category: type === MessageType.Image ? 'Post' : 'Audio',
          visibility: 'Private',
          uploadStatus: 'Uploaded',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!asset) {
        throw new BadRequestException('Upload this private chat attachment before sending it.');
      }
    }

    const recipients = conversation.type === 'Direct'
      ? await this.prisma.conversationMember.findMany({
          where: { conversationId, userId: { not: userId }, leftAt: null },
          select: { userId: true },
          take: 1,
        })
      : [];

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          type,
          content,
          receipts: {
            create: recipients.map(({ userId: recipientId }) => ({ userId: recipientId })),
          },
        },
        include: {
          sender: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
          reactions: true,
          receipts: true,
        },
      });

      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map(({ userId: recipientId }) => ({
            userId: recipientId,
            type: 'NewMessage',
            content: 'You received a new message.',
            entityId: conversationId,
          })),
        });
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
    });
  }

  async getAttachmentUrl(userId: string, conversationId: string, mediaId: string) {
    if (!await this.isConversationMember(userId, conversationId)) {
      throw new NotFoundException('Conversation not found.');
    }

    const message = await this.prisma.message.findFirst({
      where: {
        conversationId,
        content: mediaId,
        type: { in: [MessageType.Image, MessageType.Audio] },
      },
      select: { senderId: true, type: true },
    });
    if (!message) {
      throw new NotFoundException('Attachment not found.');
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        ownerId: message.senderId,
        category: message.type === MessageType.Image ? 'Post' : 'Audio',
        visibility: 'Private',
        uploadStatus: 'Uploaded',
        deletedAt: null,
      },
      select: { objectKey: true },
    });
    if (!asset) {
      throw new NotFoundException('Attachment not found.');
    }

    return { url: await this.storageService.createPrivateDownloadUrl(asset.objectKey) };
  }
}
