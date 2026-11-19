import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async discoverProfiles(search?: string) {
    const term = search?.trim();
    return this.prisma.musicianProfile.findMany({
      where: {
        visibility: 'Public',
        user: { is: { status: 'Active', deletedAt: null } },
        ...(term ? {
          OR: [
            { stageName: { contains: term, mode: 'insensitive' as const } },
            { headline: { contains: term, mode: 'insensitive' as const } },
            { city: { contains: term, mode: 'insensitive' as const } },
            { user: { is: { fullName: { contains: term, mode: 'insensitive' as const }, status: 'Active', deletedAt: null } } },
            { user: { is: { username: { contains: term, mode: 'insensitive' as const }, status: 'Active', deletedAt: null } } },
          ],
        } : {}),
      },
      select: {
        id: true,
        stageName: true,
        headline: true,
        biography: true,
        city: true,
        country: true,
        socialLinks: true,
        customGenres: true,
        skillLevel: true,
        bookingPreference: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarMediaId: true,
            avatarUrl: true,
            professions: { include: { profession: { select: { id: true, name: true } } } },
            instruments: { include: { instrument: { select: { id: true, name: true } } } },
            genres: { include: { genre: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async getMyProfile(userId: string) {
    return this.prisma.musicianProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarMediaId: true,
            avatarUrl: true,
            professions: { include: { profession: true } },
            instruments: { include: { instrument: true } },
            genres: { include: { genre: true } },
            availability: true,
            portfolioItems: true,
          },
        },
      },
    });
  }

  async createProfile(userId: string, data: Record<string, any>) {
    const existing = await this.prisma.musicianProfile.findUnique({ where: { userId } });
    if (existing) {
      return this.updateProfile(userId, data);
    }

    return this.prisma.musicianProfile.create({
      data: {
        userId,
        stageName: data.stageName ?? null,
        headline: data.headline ?? null,
        biography: data.biography ?? null,
        experience: data.experience ?? null,
        skillLevel: data.skillLevel ?? null,
        country: data.country ?? null,
        province: data.province ?? null,
        district: data.district ?? null,
        city: data.city ?? null,
        customGenres: this.normalizeCustomGenres(data.customGenres),
        socialLinks: this.normalizeSocialLinks(data.socialLinks),
        visibility: data.visibility ?? 'Public',
        contactPreference: data.contactPreference ?? 'DirectMessage',
        bookingPreference: data.bookingPreference ?? 'OpenToBooking',
      },
    });
  }

  async updateProfile(userId: string, data: Record<string, any>) {
    const profile = await this.prisma.musicianProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    return this.prisma.musicianProfile.update({
      where: { userId },
      data: {
        stageName: data.stageName !== undefined ? data.stageName : undefined,
        headline: data.headline !== undefined ? data.headline : undefined,
        biography: data.biography !== undefined ? data.biography : undefined,
        experience: data.experience !== undefined ? data.experience : undefined,
        skillLevel: data.skillLevel !== undefined ? data.skillLevel : undefined,
        country: data.country !== undefined ? data.country : undefined,
        province: data.province !== undefined ? data.province : undefined,
        district: data.district !== undefined ? data.district : undefined,
        city: data.city !== undefined ? data.city : undefined,
        customGenres: data.customGenres !== undefined ? this.normalizeCustomGenres(data.customGenres) : undefined,
        socialLinks: data.socialLinks !== undefined ? this.normalizeSocialLinks(data.socialLinks) : undefined,
        visibility: data.visibility !== undefined ? data.visibility : undefined,
        contactPreference: data.contactPreference !== undefined ? data.contactPreference : undefined,
        bookingPreference: data.bookingPreference !== undefined ? data.bookingPreference : undefined,
      },
    });
  }

  async getAvailability(userId: string) {
    return this.prisma.musicianAvailability.findMany({
      where: { userId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setAvailability(userId: string, items: Array<{ dayOfWeek: string; startTime?: string; endTime?: string; timezone?: string; isAvailable?: boolean }>) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.musicianAvailability.deleteMany({ where: { userId } });
      if (items.length) {
        await transaction.musicianAvailability.createMany({
          data: items.map((item) => ({
            userId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
            timezone: item.timezone ?? null,
            isAvailable: item.isAvailable ?? true,
          })),
        });
      }
      return transaction.musicianAvailability.findMany({
        where: { userId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  async getPortfolio(userId: string) {
    return this.prisma.portfolioItem.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async addPortfolioItem(userId: string, data: { title: string; description?: string; mediaUrl?: string; sortOrder?: number }) {
    return this.prisma.portfolioItem.create({
      data: {
        userId,
        title: data.title.trim(),
        description: data.description?.trim(),
        mediaUrl: data.mediaUrl?.trim(),
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async addProfession(userId: string, professionId: string) {
    return this.prisma.musicianProfession.upsert({
      where: { userId_professionId: { userId, professionId } },
      update: {},
      create: { userId, professionId },
    });
  }

  async removeProfession(userId: string, professionId: string) {
    return this.prisma.musicianProfession.deleteMany({ where: { userId, professionId } });
  }

  async addInstrument(userId: string, instrumentId: string, payload?: { skillLevel?: string; yearsExperience?: number }) {
    return this.prisma.musicianInstrument.upsert({
      where: { userId_instrumentId: { userId, instrumentId } },
      update: {
        skillLevel: payload?.skillLevel as any,
        yearsExperience: payload?.yearsExperience,
      },
      create: {
        userId,
        instrumentId,
        skillLevel: payload?.skillLevel as any,
        yearsExperience: payload?.yearsExperience,
      },
    });
  }

  async removeInstrument(userId: string, instrumentId: string) {
    return this.prisma.musicianInstrument.deleteMany({ where: { userId, instrumentId } });
  }

  async addGenre(userId: string, genreId: string) {
    return this.prisma.musicianGenre.upsert({
      where: { userId_genreId: { userId, genreId } },
      update: {},
      create: { userId, genreId },
    });
  }

  async removeGenre(userId: string, genreId: string) {
    return this.prisma.musicianGenre.deleteMany({ where: { userId, genreId } });
  }

  private normalizeCustomGenres(values?: unknown) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean))].slice(0, 20);
  }

  private normalizeSocialLinks(value?: unknown) {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Social links must be an object.');
    }

    const links = value as Record<string, unknown>;
    const normalized: Record<string, string> = {};
    for (const key of ['website', 'facebook', 'instagram', 'youtube', 'tiktok']) {
      const link = links[key];
      if (typeof link !== 'string' || !link.trim()) continue;
      try {
        const url = new URL(link.trim());
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported protocol.');
      } catch {
        throw new BadRequestException(`The ${key} link must be a valid HTTP or HTTPS URL.`);
      }
      normalized[key] = link.trim();
    }
    return normalized;
  }
}
