import { describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../prisma/prisma.service';
import { LandingPageService } from './landing-page.service';

type CapturedQuery = {
  where?: Record<string, unknown>;
  select?: {
    user?: { select?: Record<string, unknown> };
    organizer?: { select?: Record<string, unknown> };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

describe('LandingPageService', () => {
  it('only queries eligible public records and returns database-derived statistics', async () => {
    let musicianQuery: CapturedQuery | undefined;
    let organizationQuery: CapturedQuery | undefined;
    let opportunityQuery: CapturedQuery | undefined;
    const musicianFindMany = jest.fn(async (query: CapturedQuery) => {
      musicianQuery = query;
      return [];
    });
    const organizationFindMany = jest.fn(async (query: CapturedQuery) => {
      organizationQuery = query;
      return [];
    });
    const groupFindMany = jest.fn(async (_query: CapturedQuery) => []);
    const opportunityFindMany = jest.fn(async (query: CapturedQuery) => {
      opportunityQuery = query;
      return [];
    });
    const prisma = {
      musicianProfile: { findMany: musicianFindMany, count: jest.fn(async () => 0) },
      organization: { findMany: organizationFindMany, count: jest.fn(async () => 0) },
      musicGroup: { findMany: groupFindMany, count: jest.fn(async () => 0) },
      opportunity: { findMany: opportunityFindMany, count: jest.fn(async () => 0) },
    } as unknown as PrismaService;
    const service = new LandingPageService(prisma);

    await expect(service.getContent()).resolves.toEqual({
      statistics: {
        publicMusicians: 0,
        publicOrganizations: 0,
        publicGroups: 0,
        activeOpportunities: 0,
      },
      musicians: [],
      organizations: [],
      groups: [],
      opportunities: [],
    });

    expect(musicianFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        visibility: 'Public',
        user: { is: expect.objectContaining({ status: 'Active', deletedAt: null, onboardingCompletedAt: { not: null } }) },
      }),
    }));
    expect(organizationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: true, isPublished: true }),
    }));
    expect(groupFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { community: { is: { type: 'Public' } }, owner: { is: { status: 'Active', deletedAt: null } } },
    }));
    expect(opportunityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'Open',
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: [{ deadline: null }, { deadline: { gte: expect.any(Date) } }] }),
          expect.objectContaining({ OR: [{ eventDate: null }, { eventDate: { gte: expect.any(Date) } }] }),
        ]),
      }),
    }));

    const musicianSelect = musicianQuery?.select;
    const organizationSelect = organizationQuery?.select;
    const opportunitySelect = opportunityQuery?.select;
    expect(musicianSelect?.user?.select).not.toHaveProperty('email');
    expect(musicianSelect?.user?.select).not.toHaveProperty('phone');
    expect(organizationSelect).not.toHaveProperty('email');
    expect(organizationSelect).not.toHaveProperty('phone');
    expect(opportunitySelect?.organizer?.select).not.toHaveProperty('email');
    expect(opportunitySelect?.organizer?.select).not.toHaveProperty('phone');
  });
});
