import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { country: 'asc' },
    });
  }

  async create(data: { country: string; province?: string; district?: string; city?: string; sector?: string }) {
    return this.prisma.location.create({
      data: {
        country: data.country.trim(),
        province: data.province?.trim(),
        district: data.district?.trim(),
        city: data.city?.trim(),
        sector: data.sector?.trim(),
      },
    });
  }

  async update(id: string, data: { country?: string; province?: string; district?: string; city?: string; sector?: string; isActive?: boolean }) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Location not found.');
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        country: data.country?.trim(),
        province: data.province?.trim(),
        district: data.district?.trim(),
        city: data.city?.trim(),
        sector: data.sector?.trim(),
        isActive: data.isActive,
      },
    });
  }
}
