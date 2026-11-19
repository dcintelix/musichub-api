import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunitiesService } from '../communities/communities.service';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  async list(userId: string) {
    return this.prisma.musicGroup.findMany({
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: { where: { userId }, select: { status: true } },
        community: { select: { id: true, name: true } },
        _count: { select: { members: { where: { status: MembershipStatus.Active } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(groupId: string, userId: string) {
    const group = await this.prisma.musicGroup.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: { where: { userId }, select: { status: true } },
        _count: { select: { members: { where: { status: MembershipStatus.Active } } } },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    return group;
  }

  async listByCommunity(userId: string, communityId: string, beforeId?: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, ownerId: true, type: true },
    });
    if (!community) throw new NotFoundException('Community not found.');
    if (community.type === 'Private' && community.ownerId !== userId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { status: true },
      });
      if (membership?.status !== MembershipStatus.Active) {
        throw new NotFoundException('Community not found.');
      }
    }

    const cursor = beforeId
      ? await this.prisma.musicGroup.findFirst({
          where: { id: beforeId, communityId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (beforeId && !cursor) throw new BadRequestException('Group cursor is invalid.');

    const rows = await this.prisma.musicGroup.findMany({
      where: {
        communityId,
        ...(cursor ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: { where: { userId }, select: { status: true } },
        community: { select: { id: true, name: true } },
        _count: { select: { members: { where: { status: MembershipStatus.Active } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    const hasMore = rows.length > 50;
    const items = rows.slice(0, 50);
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async create(userId: string, payload: { name: string; description?: string; type?: string }) {
    const name = payload.name.trim();
    if (!name) {
      throw new BadRequestException('Group name is required.');
    }
    const community = await this.getDefaultCommunity(userId);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId } },
        update: { status: MembershipStatus.Active },
        create: { communityId: community.id, userId, status: MembershipStatus.Active },
      });
      const group = await transaction.musicGroup.create({
        data: {
          name,
          description: payload.description?.trim() ?? null,
          type: payload.type ?? 'Community',
          ownerId: userId,
          communityId: community.id,
        },
        include: {
          owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        },
      });
      await transaction.musicGroupMember.create({
        data: { groupId: group.id, userId, status: MembershipStatus.Active },
      });
      const conversation = await transaction.conversation.create({
        data: {
          type: 'Group',
          title: group.name,
          members: { create: { userId } },
        },
        select: { id: true },
      });
      return transaction.musicGroup.update({
        where: { id: group.id },
        data: { conversationId: conversation.id },
        include: {
          owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
          members: { where: { userId }, select: { status: true } },
          community: { select: { id: true, name: true } },
          _count: { select: { members: { where: { status: MembershipStatus.Active } } } },
        },
      });
    });
  }

  async listMembers(userId: string, groupId: string, beforeId?: string) {
    const group = await this.prisma.musicGroup.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    if (!userId) throw new ForbiddenException('Authentication is required to view group members.');

    const cursor = beforeId
      ? await this.prisma.musicGroupMember.findFirst({
          where: { id: beforeId, groupId, status: MembershipStatus.Active },
          select: { id: true, createdAt: true },
        })
      : null;
    if (beforeId && !cursor) throw new BadRequestException('Group member cursor is invalid.');

    const rows = await this.prisma.musicGroupMember.findMany({
      where: {
        groupId,
        status: MembershipStatus.Active,
        ...(cursor ? {
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ],
        } : {}),
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 51,
    });
    const hasMore = rows.length > 50;
    const items = rows.slice(0, 50);
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async join(userId: string, groupId: string) {
    const group = await this.prisma.musicGroup.findUnique({ where: { id: groupId }, select: { id: true, conversationId: true } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    const membership = await this.prisma.musicGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (membership?.status === MembershipStatus.Banned) {
      throw new ForbiddenException('You cannot join this group.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const joined = await transaction.musicGroupMember.upsert({
        where: { groupId_userId: { groupId, userId } },
        update: { status: MembershipStatus.Active },
        create: { groupId, userId, status: MembershipStatus.Active },
      });
      if (group.conversationId) {
        await transaction.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: group.conversationId, userId } },
          update: { leftAt: null },
          create: { conversationId: group.conversationId, userId },
        });
      }
      return joined;
    });
  }

  async leave(userId: string, groupId: string) {
    const group = await this.prisma.musicGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    if (group.ownerId === userId) {
      throw new ConflictException('Group owners cannot leave their own group.');
    }

    const membership = await this.prisma.musicGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.Active) {
      throw new ConflictException('You are not an active member of this group.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.musicGroupMember.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.Left },
      });
      if (group.conversationId) {
        await transaction.conversationMember.updateMany({
          where: { conversationId: group.conversationId, userId, leftAt: null },
          data: { leftAt: new Date() },
        });
      }
      return updated;
    });
  }

  async getOrCreateConversation(userId: string, groupId: string) {
    const group = await this.prisma.musicGroup.findUnique({
      where: { id: groupId },
      include: { members: { where: { userId }, select: { status: true } } },
    });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    if (group.ownerId !== userId && group.members[0]?.status !== MembershipStatus.Active) {
      throw new ForbiddenException('Join this group before opening its chat.');
    }

    return this.prisma.$transaction(async (transaction) => {
      let conversationId = group.conversationId;
      if (!conversationId) {
        const conversation = await transaction.conversation.create({
          data: {
            type: 'Group',
            title: group.name,
            members: { create: { userId } },
          },
          select: { id: true },
        });
        const claimed = await transaction.musicGroup.updateMany({
          where: { id: groupId, conversationId: null },
          data: { conversationId: conversation.id },
        });
        if (claimed.count) {
          conversationId = conversation.id;
        } else {
          await transaction.conversation.delete({ where: { id: conversation.id } });
          const currentGroup = await transaction.musicGroup.findUniqueOrThrow({
            where: { id: groupId },
            select: { conversationId: true },
          });
          conversationId = currentGroup.conversationId;
        }
      }

      if (!conversationId) {
        throw new ConflictException('Could not create the group conversation.');
      }

      await transaction.conversationMember.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        update: { leftAt: null },
        create: { conversationId, userId },
      });

      return transaction.conversation.findFirstOrThrow({
        where: { id: conversationId, members: { some: { userId, leftAt: null } } },
        include: {
          members: { where: { userId }, include: { user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    });
  }

  async update(userId: string, groupId: string, payload: { name?: string; description?: string; type?: string }) {
    const group = await this.prisma.musicGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    if (group.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to update this group.');
    }
    const name = payload.name?.trim();
    if (name !== undefined && !name) {
      throw new BadRequestException('Group name cannot be empty.');
    }
    const community = await this.getDefaultCommunity(userId);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId } },
        update: { status: MembershipStatus.Active },
        create: { communityId: community.id, userId, status: MembershipStatus.Active },
      });
      const updated = await transaction.musicGroup.update({
        where: { id: groupId },
        data: {
          name: name ?? group.name,
          description: payload.description?.trim() ?? group.description,
          type: payload.type ?? group.type,
          communityId: community.id,
        },
        include: {
          owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
          community: { select: { id: true, name: true } },
        },
      });
      if (updated.conversationId && name) {
        await transaction.conversation.update({ where: { id: updated.conversationId }, data: { title: name } });
      }
      return updated;
    });
  }

  async remove(userId: string, groupId: string) {
    const group = await this.prisma.musicGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Group not found.');
    }
    if (group.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this group.');
    }

    await this.prisma.$transaction(async (transaction) => {
      if (group.conversationId) {
        await transaction.conversation.delete({ where: { id: group.conversationId } });
      }
      await transaction.musicGroup.delete({ where: { id: groupId } });
    });
    return { success: true };
  }

  private async getDefaultCommunity(userId: string) {
    const communityId = await this.communitiesService.ensureDefaultCommunity(userId);
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, isDefault: true, type: 'Public' },
      select: { id: true },
    });
    if (!community) throw new NotFoundException('The official public community is not available.');
    return community;
  }
}
