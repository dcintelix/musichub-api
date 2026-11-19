import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, beforeId?: string) {
    const cursor = beforeId
      ? await this.prisma.notification.findFirst({
          where: { id: beforeId, userId },
          select: { id: true, createdAt: true },
        })
      : null;

    if (beforeId && !cursor) {
      throw new BadRequestException('Notification cursor is invalid.');
    }

    const where = {
      userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { conversation: { select: { id: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      unreadCount,
      items: items.map((item) => ({
        ...item,
        actionUrl: item.actionUrl ?? (item.conversation ? `/app/messages?conversationId=${item.conversation.id}` : null),
      })),
    };
  }

  async getById(userId: string, notificationId: string) {
    const item = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      include: { conversation: { select: { id: true } } },
    });
    if (!item) {
      throw new NotFoundException('Notification not found.');
    }

    return {
      ...item,
      actionUrl: item.actionUrl ?? (item.conversation ? `/app/messages?conversationId=${item.conversation.id}` : null),
    };
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { success: true };
  }
}
