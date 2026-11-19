import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LandingPageService {
  constructor(private readonly prisma: PrismaService) {}

  async getContent() {
    const now = new Date();
    const publicMusicianWhere = {
      visibility: 'Public' as const,
      OR: [
        { stageName: { not: null } },
        { headline: { not: null } },
        { biography: { not: null } },
      ],
      user: {
        is: {
          status: 'Active' as const,
          deletedAt: null,
          onboardingCompletedAt: { not: null },
        },
      },
    };
    const publicOrganizationWhere = {
      isActive: true,
      isPublished: true,
      owner: { is: { status: 'Active' as const, deletedAt: null } },
    };
    const publicGroupWhere = {
      community: { is: { type: 'Public' as const } },
      owner: { is: { status: 'Active' as const, deletedAt: null } },
    };
    const activeOpportunityWhere = {
      status: 'Open',
      AND: [
        { OR: [{ deadline: null }, { deadline: { gte: now } }] },
        { OR: [{ eventDate: null }, { eventDate: { gte: now } }] },
        {
          OR: [
            { organizationId: null },
            {
              organization: {
                is: {
                  isActive: true,
                  isPublished: true,
                  owner: { is: { status: 'Active' as const, deletedAt: null } },
                },
              },
            },
          ],
        },
      ],
      organizer: { is: { status: 'Active' as const, deletedAt: null } },
    };

    const [
      musicians,
      organizations,
      groups,
      opportunities,
      musicianCount,
      organizationCount,
      groupCount,
      opportunityCount,
    ] = await Promise.all([
      this.prisma.musicianProfile.findMany({
        where: publicMusicianWhere,
        select: {
          id: true,
          stageName: true,
          headline: true,
          city: true,
          country: true,
          customGenres: true,
          user: {
            select: {
              fullName: true,
              username: true,
              avatarUrl: true,
              professions: { select: { profession: { select: { name: true } } } },
              instruments: { select: { instrument: { select: { name: true } } } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      this.prisma.organization.findMany({
        where: publicOrganizationWhere,
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          logoUrl: true,
          location: true,
          city: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.musicGroup.findMany({
        where: publicGroupWhere,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          community: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.opportunity.findMany({
        where: activeOpportunityWhere,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          eventDate: true,
          deadline: true,
          createdAt: true,
          organization: {
            select: { id: true, name: true, logoUrl: true, location: true },
          },
          organizer: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      this.prisma.musicianProfile.count({ where: publicMusicianWhere }),
      this.prisma.organization.count({ where: publicOrganizationWhere }),
      this.prisma.musicGroup.count({ where: publicGroupWhere }),
      this.prisma.opportunity.count({ where: activeOpportunityWhere }),
    ]);

    return {
      statistics: {
        publicMusicians: musicianCount,
        publicOrganizations: organizationCount,
        publicGroups: groupCount,
        activeOpportunities: opportunityCount,
      },
      musicians,
      organizations,
      groups,
      opportunities,
    };
  }
}
