import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async listByUser(userId: string) {
    return this.prisma.verificationRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: { type: string; notes?: string }) {
    return this.prisma.verificationRecord.create({
      data: {
        userId,
        type: data.type,
        status: 'Pending',
        notes: data.notes,
      },
    });
  }

  async review(recordId: string, data: { status: string; notes?: string; reviewedBy?: string }) {
    const record = await this.prisma.verificationRecord.findUnique({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException('Verification record not found.');
    }

    return this.prisma.verificationRecord.update({
      where: { id: recordId },
      data: {
        status: data.status,
        notes: data.notes ?? record.notes,
        reviewedBy: data.reviewedBy ?? record.reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }
}
