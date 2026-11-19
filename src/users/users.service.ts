import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const publicUserFields = {
  id: true,
  fullName: true,
  username: true,
  avatarMediaId: true,
  avatarUrl: true,
  profile: { select: { stageName: true, headline: true, city: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateOnboardingIdentity(
    userId: string,
    data: { fullName?: string; phone?: string; avatarMediaId?: string },
  ) {
    const fullName = data.fullName?.trim();
    const phone = data.phone?.trim();
    if (data.fullName !== undefined && !fullName || data.phone !== undefined && !phone) {
      throw new BadRequestException('Full name and phone number cannot be blank.');
    }

    let avatarUrl: string | undefined;
    if (data.avatarMediaId) {
      const asset = await this.prisma.mediaAsset.findFirst({
        where: {
          id: data.avatarMediaId,
          ownerId: userId,
          category: 'Avatar',
          uploadStatus: 'Uploaded',
          deletedAt: null,
        },
        select: { url: true },
      });
      if (!asset?.url) {
        throw new BadRequestException('Upload a public profile photo before attaching it to your account.');
      }
      avatarUrl = asset.url;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        phone,
        ...(data.avatarMediaId ? { avatarMediaId: data.avatarMediaId, avatarUrl } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarMediaId: true,
        avatarUrl: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });
  }

  async getPreferences(userId: string) {
    const preferences = await this.prisma.userPreference.findUnique({ where: { userId } });
    return preferences ?? {
      userId,
      theme: 'light',
      emailAlerts: true,
      pushNotifications: true,
    };
  }

  async updatePreferences(userId: string, data: { theme?: string; emailAlerts?: boolean; pushNotifications?: boolean }) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: data.theme ?? 'light',
        emailAlerts: data.emailAlerts ?? true,
        pushNotifications: data.pushNotifications ?? true,
      },
      update: {
        theme: data.theme ?? undefined,
        emailAlerts: data.emailAlerts ?? undefined,
        pushNotifications: data.pushNotifications ?? undefined,
      },
    });
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ConflictException('You cannot follow yourself.');
    }

    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: followerId, blockedId: followingId },
          { blockerId: followingId, blockedId: followerId },
        ],
      },
      select: { id: true },
    });
    if (block) {
      throw new ForbiddenException('This connection is unavailable.');
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: followingId,
        status: 'Active',
        deletedAt: null,
        profile: { is: { visibility: 'Public' } },
      },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Public musician profile not found.');
    }

    return this.prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.userFollow.deleteMany({ where: { followerId, followingId } });
    return { success: true };
  }

  async listFollowing(userId: string) {
    return this.prisma.userFollow.findMany({
      where: {
        followerId: userId,
        following: {
          is: {
            status: 'Active',
            deletedAt: null,
            profile: { is: { visibility: 'Public' } },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        following: { select: publicUserFields },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listFollowers(userId: string) {
    return this.prisma.userFollow.findMany({
      where: {
        followingId: userId,
        follower: {
          is: {
            status: 'Active',
            deletedAt: null,
            profile: { is: { visibility: 'Public' } },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        follower: { select: publicUserFields },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSavedOpportunities(userId: string) {
    return this.prisma.savedOpportunity.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        opportunity: {
          include: {
            organizer: {
              select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveOpportunity(userId: string, opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }

    return this.prisma.savedOpportunity.upsert({
      where: { userId_opportunityId: { userId, opportunityId } },
      create: { userId, opportunityId },
      update: {},
    });
  }

  async unsaveOpportunity(userId: string, opportunityId: string) {
    await this.prisma.savedOpportunity.deleteMany({ where: { userId, opportunityId } });
    return { success: true };
  }
}
