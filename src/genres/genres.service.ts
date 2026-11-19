import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GenresService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.genre.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; description?: string }) {
    return this.prisma.genre.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim(),
      },
    });
  }

  async update(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
    const existing = await this.prisma.genre.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Genre not found.');
    }

    return this.prisma.genre.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        isActive: data.isActive,
      },
    });
  }
}
