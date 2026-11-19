import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstrumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.instrument.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; category?: string; description?: string }) {
    return this.prisma.instrument.create({
      data: {
        name: data.name.trim(),
        category: data.category?.trim(),
        description: data.description?.trim(),
      },
    });
  }

  async update(id: string, data: { name?: string; category?: string; description?: string; isActive?: boolean }) {
    const existing = await this.prisma.instrument.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Instrument not found.');
    }

    return this.prisma.instrument.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        category: data.category?.trim(),
        description: data.description?.trim(),
        isActive: data.isActive,
      },
    });
  }
}
