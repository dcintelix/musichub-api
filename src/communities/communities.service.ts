import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultCommunity(userId: string) {
    const existing = await this.prisma.community.findFirst({
      where: { isDefault: true },
      select: { id: true, type: true },
    });
    if (existing) {
      if (existing.type !== 'Public') {
        await this.prisma.community.update({
          where: { id: existing.id },
          data: { type: 'Public' },
        });
      }
      await this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: existing.id, userId } },
        update: { status: 'Active' },
        create: { communityId: existing.id, userId, role: 'Member', status: 'Active' },
      });
      return existing.id;
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(83472011)::text`;
      let community = await transaction.community.findFirst({
        where: { isDefault: true },
        select: { id: true, type: true },
      });
      if (!community) {
        community = await transaction.community.create({
          data: {
            ownerId: userId,
            name: '',
            description: 'The official public community for everyone in .',
            type: 'Public',
            isDefault: true,
            members: { create: { userId, role: 'Owner', status: 'Active' } },
          },
          select: { id: true, type: true },
        });

        const activeUsers = await transaction.user.findMany({
          where: { status: 'Active', id: { not: userId } },
          select: { id: true },
        });
        if (activeUsers.length) {
          await transaction.communityMember.createMany({
            data: activeUsers.map(({ id }) => ({
              communityId: community!.id,
              userId: id,
              role: 'Member',
              status: 'Active',
            })),
            skipDuplicates: true,
          });
        }
      } else {
        if (community.type !== 'Public') {
          await transaction.community.update({
            where: { id: community.id },
            data: { type: 'Public' },
          });
        }
        await transaction.communityMember.upsert({
          where: { communityId_userId: { communityId: community.id, userId } },
          update: { status: 'Active' },
          create: { communityId: community.id, userId, role: 'Member', status: 'Active' },
        });
      }
      return community.id;
    });
  }

  async list(userId: string) {
    await this.ensureDefaultCommunity(userId);
    return this.prisma.community.findMany({
      where: {
        OR: [
          { type: 'Public' },
          { ownerId: userId },
          { members: { some: { userId, status: { in: ['Active', 'Pending'] } } } },
        ],
      },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: {
          where: { userId },
          select: { userId: true, status: true, role: true },
        },
        _count: { select: { members: { where: { status: 'Active' } }, groups: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(communityId: string, userId?: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: {
          where: userId ? { userId } : { status: 'Active' },
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
          },
        },
        _count: { select: { members: { where: { status: 'Active' } }, groups: true } },
        rules: true,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found.');
    }

    if (community.type === 'Private' && userId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { status: true },
      });
      if (community.ownerId !== userId && membership?.status !== 'Active' && membership?.status !== 'Pending') {
        throw new NotFoundException('Community not found.');
      }
    } else if (community.type === 'Private' && !userId) {
      throw new NotFoundException('Community not found.');
    }

    return community;
  }

  async listMembers(userId: string, communityId: string, beforeId?: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, type: true, ownerId: true },
    });
    if (!community) throw new NotFoundException('Community not found.');
    if (community.type === 'Private' && community.ownerId !== userId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { status: true },
      });
      if (membership?.status !== 'Active') throw new NotFoundException('Community not found.');
    }

    const cursor = beforeId
      ? await this.prisma.communityMember.findFirst({
          where: { id: beforeId, communityId, status: 'Active' },
          select: { id: true, createdAt: true },
        })
      : null;
    if (beforeId && !cursor) throw new BadRequestException('Community member cursor is invalid.');

    const rows = await this.prisma.communityMember.findMany({
      where: {
        communityId,
        status: 'Active',
        ...(cursor ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        } : {}),
      },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    const hasMore = rows.length > 50;
    const items = rows.slice(0, 50);
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async create(userId: string, data: { name: string; description?: string; type?: string }) {
    const name = data.name.trim();
    if (!name) {
      throw new BadRequestException('Community name is required.');
    }

    return this.prisma.community.create({
      data: {
        ownerId: userId,
        name,
        description: data.description?.trim() || null,
        type: data.type === 'Private' ? 'Private' : 'Public',
        members: {
          create: {
            userId,
            role: 'Owner',
            status: 'Active',
          },
        },
      },
    });
  }

  async update(userId: string, communityId: string, data: { name?: string; description?: string; type?: string }) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new NotFoundException('Community not found.');
    }
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the community owner can update it.');
    }

    const name = data.name?.trim();
    if (name !== undefined && !name) {
      throw new BadRequestException('Community name cannot be empty.');
    }

    return this.prisma.community.update({
      where: { id: communityId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(data.type !== undefined ? {
          type: community.isDefault ? 'Public' : data.type === 'Private' ? 'Private' : 'Public',
        } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: { where: { userId }, select: { userId: true, status: true, role: true } },
        _count: { select: { members: { where: { status: 'Active' } }, groups: true } },
        rules: true,
      },
    });
  }

  async joinCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new NotFoundException('Community not found.');
    }

    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });

    if (existing?.status === 'Active' || existing?.status === 'Pending') {
      return existing;
    }

    const status = community.type === 'Private' ? 'Pending' : 'Active';
    return this.prisma.communityMember.upsert({
      where: { communityId_userId: { communityId, userId } },
      update: { status },
      create: {
        communityId,
        userId,
        status,
        role: 'Member',
      },
    });
  }

  async leaveCommunity(userId: string, communityId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this community.');
    }

    if (member.role === 'Owner') {
      throw new BadRequestException('The owner cannot leave the community.');
    }

    await this.prisma.communityMember.delete({
      where: { id: member.id },
    });

    return { success: true };
  }

  private async assertOwner(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { ownerId: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found.');
    }
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the community owner can manage members.');
    }
  }

  async listRequests(userId: string, communityId: string) {
    await this.assertOwner(userId, communityId);
    return this.prisma.communityMember.findMany({
      where: { communityId, status: 'Pending' },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
      },
    });
  }

  async respondToRequest(userId: string, communityId: string, requestId: string, action: 'approve' | 'reject') {
    await this.assertOwner(userId, communityId);
    const member = await this.prisma.communityMember.findUnique({
      where: { id: requestId },
    });

    if (!member || member.communityId !== communityId || member.status !== 'Pending') {
      throw new NotFoundException('Membership request not found.');
    }

    const status = action === 'approve' ? 'Active' : 'Rejected';

    return this.prisma.communityMember.update({
      where: { id: requestId },
      data: { status },
    });
  }

  async removeMember(userId: string, communityId: string, memberId: string) {
    await this.assertOwner(userId, communityId);
    const member = await this.prisma.communityMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.communityId !== communityId || member.role === 'Owner') {
      throw new NotFoundException('Member not found.');
    }

    await this.prisma.communityMember.delete({ where: { id: memberId } });
    return { success: true };
  }
}
