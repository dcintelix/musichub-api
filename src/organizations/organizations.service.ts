import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { search?: string; type?: string; location?: string } = {}) {
    const search = filters.search?.trim();
    const type = filters.type?.trim();
    const location = filters.location?.trim();
    const where: Prisma.OrganizationWhereInput = {
      isActive: true,
      isPublished: true,
      ...(type ? { type: { equals: type, mode: 'insensitive' } } : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { type: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    return this.prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        logoUrl: true,
        coverImageUrl: true,
        location: true,
        country: true,
        city: true,
        website: true,
        socialLinks: true,
        createdAt: true,
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        _count: { select: { opportunities: { where: { status: 'Open' } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listManaged(userId: string) {
    const organizations = await this.prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: 'Active', role: { in: ['Owner', 'Admin', 'Manager'] } } } },
        ],
      },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        members: {
          where: { userId },
          select: { role: true, status: true, title: true, authorizationConfirmedAt: true },
        },
        opportunities: {
          select: {
            id: true,
            _count: { select: { applications: { where: { status: 'Pending' } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return organizations.map(({ opportunities, ...organization }) => ({
      ...organization,
      pendingApplicationsCount: opportunities.reduce((count, opportunity) => count + opportunity._count.applications, 0),
    }));
  }

  async getById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id, isActive: true, isPublished: true },
      include: {
        owner: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        opportunities: {
          where: { status: 'Open' },
          include: { organizer: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { opportunities: { where: { status: 'Open' } } } },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    return organization;
  }

  async create(userId: string, data: {
    name: string;
    type?: string;
    description?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    location?: string;
    country?: string;
    city?: string;
    physicalAddress?: string;
    website?: string;
    socialLinks?: Record<string, string>;
    registrationNumber?: string;
    establishedYear?: number;
    email?: string;
    phone?: string;
  }) {
    const name = data.name.trim();
    if (!name) {
      throw new BadRequestException('Organization name is required.');
    }

    const socialLinks = this.normalizeSocialLinks(data.socialLinks);
    return this.prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: {
          ownerId: userId,
          name,
          type: data.type?.trim() || null,
          description: data.description?.trim() || null,
          logoUrl: data.logoUrl?.trim() || null,
          coverImageUrl: data.coverImageUrl?.trim() || null,
          location: data.location?.trim() || [data.city?.trim(), data.country?.trim()].filter(Boolean).join(', ') || null,
          country: data.country?.trim() || null,
          city: data.city?.trim() || null,
          physicalAddress: data.physicalAddress?.trim() || null,
          website: data.website?.trim() || null,
          socialLinks,
          registrationNumber: data.registrationNumber?.trim() || null,
          establishedYear: data.establishedYear ?? null,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          isActive: true,
          isPublished: false,
        },
      });
      await transaction.organizationMember.create({
        data: { organizationId: organization.id, userId, role: 'Owner', status: 'Active' },
      });
      return organization;
    });
  }

  async canManage(userId: string, organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        ownerId: true,
        members: { where: { userId, status: 'Active', role: { in: ['Owner', 'Admin', 'Manager'] } }, select: { id: true }, take: 1 },
      },
    });
    return Boolean(organization && (organization.ownerId === userId || organization.members.length));
  }

  async assertCanManage(userId: string, organizationId: string) {
    if (!await this.canManage(userId, organizationId)) {
      throw new ForbiddenException('You do not have permission to manage this organization.');
    }
  }

  async assertCanPublish(userId: string, organizationId: string) {
    await this.assertCanManage(userId, organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isActive: true, isPublished: true },
    });
    if (!organization?.isActive || !organization.isPublished) {
      throw new ForbiddenException('This organization is not active and published.');
    }
  }

  async update(userId: string, organizationId: string, data: {
    name?: string;
    type?: string;
    description?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    location?: string;
    country?: string;
    city?: string;
    physicalAddress?: string;
    website?: string;
    socialLinks?: Record<string, string>;
    registrationNumber?: string;
    establishedYear?: number;
    email?: string;
    phone?: string;
    ownerTitle?: string;
    ownerAuthorized?: boolean;
  }) {
    await this.assertCanManage(userId, organizationId);
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException('Organization name cannot be empty.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    if ((data.ownerTitle !== undefined || data.ownerAuthorized !== undefined) && organization.ownerId !== userId) {
      throw new ForbiddenException('Only the organization owner can update owner authorization details.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.organization.update({
        where: { id: organizationId },
        data: {
          name: data.name?.trim(),
          type: data.type?.trim(),
          description: data.description?.trim(),
          logoUrl: data.logoUrl?.trim(),
          coverImageUrl: data.coverImageUrl?.trim(),
          location: data.location?.trim() || [data.city?.trim(), data.country?.trim()].filter(Boolean).join(', ') || undefined,
          country: data.country?.trim(),
          city: data.city?.trim(),
          physicalAddress: data.physicalAddress?.trim(),
          website: data.website?.trim(),
          socialLinks: data.socialLinks ? this.normalizeSocialLinks(data.socialLinks) : undefined,
          registrationNumber: data.registrationNumber?.trim(),
          establishedYear: data.establishedYear,
          email: data.email?.trim(),
          phone: data.phone?.trim(),
        },
      });
      if (data.ownerTitle !== undefined || data.ownerAuthorized !== undefined) {
        await transaction.organizationMember.upsert({
          where: { organizationId_userId: { organizationId, userId: organization.ownerId } },
          create: {
            organizationId,
            userId: organization.ownerId,
            role: 'Owner',
            status: 'Active',
            title: data.ownerTitle?.trim() || null,
            authorizationConfirmedAt: data.ownerAuthorized === true ? new Date() : null,
          },
          update: {
            role: 'Owner',
            status: 'Active',
            title: data.ownerTitle?.trim() || undefined,
            authorizationConfirmedAt: data.ownerAuthorized === true
              ? new Date()
              : data.ownerAuthorized === false ? null : undefined,
          },
        });
      }
      return updated;
    });
  }

  private normalizeSocialLinks(links?: Record<string, string>) {
    if (!links) return undefined;
    const allowedKeys = ['website', 'facebook', 'instagram', 'youtube', 'tiktok'];
    const normalized: Record<string, string> = {};
    for (const key of allowedKeys) {
      const value = links[key]?.trim();
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new Error('Unsupported protocol.');
        }
      } catch {
        throw new BadRequestException(`The ${key} link must be a valid HTTP or HTTPS URL.`);
      }
      normalized[key] = value;
    }
    return normalized;
  }

  async addMember(actorId: string, organizationId: string, member: { userId: string; role: string; status?: string }) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
    if (organization.ownerId !== actorId) {
      throw new ForbiddenException('Only the organization owner can manage members.');
    }

    return this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: member.userId,
        },
      },
      update: {
        role: member.role,
        status: member.status ?? 'Active',
      },
      create: {
        organizationId,
        userId: member.userId,
        role: member.role,
        status: member.status ?? 'Active',
      },
    });
  }

  async listMembers(actorId: string, organizationId: string) {
    await this.assertCanManage(actorId, organizationId);
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        title: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async removeMember(actorId: string, organizationId: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    if (organization.ownerId !== actorId || userId === organization.ownerId) {
      throw new ForbiddenException('Only the owner can remove non-owner team members.');
    }

    await this.prisma.organizationMember.deleteMany({ where: { organizationId, userId } });
    return { success: true };
  }
}
