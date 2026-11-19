import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OpportunityApplicationStatus } from '@prisma/client';
import { ChatGateway } from '../chat/chat.gateway';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';

const userSummary = { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } as const;

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async list() {
    return this.prisma.opportunity.findMany({
      where: {
        status: 'Open',
        OR: [
          { organizationId: null },
          { organization: { is: { isActive: true, isPublished: true } } },
        ],
      },
      include: {
        organizer: { select: userSummary },
        organization: { select: { id: true, name: true, type: true, logoUrl: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        OR: [
          { organizationId: null },
          { organization: { is: { isActive: true, isPublished: true } } },
        ],
      },
      include: {
        organizer: { select: userSummary },
        organization: { select: { id: true, name: true, type: true, logoUrl: true, location: true } },
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }

    return opportunity;
  }

  async create(userId: string, payload: { title: string; description?: string; location?: string; eventDate?: string; deadline?: string; budget?: number; currency?: string; status?: string; organizationId?: string }) {
    if (payload.organizationId) {
      await this.organizationsService.assertCanPublish(userId, payload.organizationId);
    }

    return this.prisma.opportunity.create({
      data: {
        title: payload.title.trim(),
        description: payload.description?.trim() ?? null,
        organizerId: userId,
        organizationId: payload.organizationId ?? null,
        location: payload.location?.trim() ?? null,
        eventDate: payload.eventDate ? new Date(payload.eventDate) : null,
        deadline: payload.deadline ? new Date(payload.deadline) : null,
        budget: payload.budget !== undefined ? Number(payload.budget) : null,
        currency: payload.currency ?? 'RWF',
        status: payload.status ?? 'Open',
      },
      include: {
        organizer: { select: userSummary },
        organization: { select: { id: true, name: true, type: true, logoUrl: true, location: true } },
      },
    });
  }

  async update(userId: string, opportunityId: string, payload: { title?: string; description?: string; location?: string; eventDate?: string; deadline?: string; budget?: number; currency?: string; status?: string }) {
    const opportunity = await this.prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }
    const canManage = opportunity.organizationId
      ? await this.organizationsService.canManage(userId, opportunity.organizationId)
      : opportunity.organizerId === userId;
    if (!canManage) {
      throw new ForbiddenException('You do not have permission to update this opportunity.');
    }

    return this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        title: payload.title?.trim() ?? opportunity.title,
        description: payload.description?.trim() ?? opportunity.description,
        location: payload.location?.trim() ?? opportunity.location,
        eventDate: payload.eventDate ? new Date(payload.eventDate) : opportunity.eventDate,
        deadline: payload.deadline ? new Date(payload.deadline) : opportunity.deadline,
        budget: payload.budget !== undefined ? Number(payload.budget) : opportunity.budget,
        currency: payload.currency ?? opportunity.currency,
        status: payload.status ?? opportunity.status,
      },
      include: {
        organizer: { select: userSummary },
        organization: { select: { id: true, name: true, type: true, logoUrl: true, location: true } },
      },
    });
  }

  async remove(userId: string, opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }
    const canManage = opportunity.organizationId
      ? await this.organizationsService.canManage(userId, opportunity.organizationId)
      : opportunity.organizerId === userId;
    if (!canManage) {
      throw new ForbiddenException('You do not have permission to delete this opportunity.');
    }

    await this.prisma.opportunity.delete({ where: { id: opportunityId } });
    return { success: true };
  }

  async getApplication(applicantId: string, opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }

    return this.prisma.opportunityApplication.findUnique({
      where: { opportunityId_applicantId: { opportunityId, applicantId } },
    });
  }

  async apply(applicantId: string, opportunityId: string, payload: { coverLetter?: string }) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        OR: [
          { organizationId: null },
          { organization: { is: { isActive: true, isPublished: true } } },
        ],
      },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }
    if (opportunity.organizerId === applicantId ||
      (opportunity.organizationId && await this.organizationsService.canManage(applicantId, opportunity.organizationId))) {
      throw new ConflictException('You cannot apply to your own opportunity.');
    }
    if (opportunity.status !== 'Open') {
      throw new ConflictException('This opportunity is not accepting applications.');
    }
    if (opportunity.deadline && opportunity.deadline < new Date()) {
      throw new ConflictException('The application deadline has passed.');
    }

    const existing = await this.prisma.opportunityApplication.findUnique({
      where: { opportunityId_applicantId: { opportunityId, applicantId } },
    });
    if (existing && existing.status !== OpportunityApplicationStatus.Withdrawn) {
      throw new ConflictException('You have already applied to this opportunity.');
    }

    const application = await this.prisma.$transaction(async (tx) => {
      const applicant = await tx.user.findUnique({
        where: { id: applicantId },
        select: { fullName: true },
      });
      if (!applicant) {
        throw new NotFoundException('Applicant not found.');
      }

      const created = existing
        ? await tx.opportunityApplication.update({
            where: { id: existing.id },
            data: {
              coverLetter: payload.coverLetter?.trim() || null,
              reviewMessage: null,
              status: OpportunityApplicationStatus.Pending,
              appliedAt: new Date(),
            },
          })
        : await tx.opportunityApplication.create({
            data: {
              opportunityId,
              applicantId,
              coverLetter: payload.coverLetter?.trim() || null,
            },
          });
      const notification = await tx.notification.create({
        data: {
          userId: opportunity.organizerId,
          type: 'ApplicationReceived',
          content: `${applicant.fullName} applied to "${opportunity.title}".`,
          actionUrl: `/app/opportunities/${opportunityId}`,
        },
      });
      return { application: created, notification };
    });
    this.chatGateway.notifyUser(opportunity.organizerId, application.notification);
    return application.application;
  }

  async withdrawApplication(applicantId: string, opportunityId: string) {
    const application = await this.prisma.opportunityApplication.findUnique({
      where: { opportunityId_applicantId: { opportunityId, applicantId } },
      include: {
        opportunity: { select: { organizerId: true, title: true } },
        applicant: { select: { fullName: true } },
      },
    });
    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    if (application.status !== OpportunityApplicationStatus.Pending) {
      throw new ConflictException('Only pending applications can be withdrawn.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.opportunityApplication.updateMany({
        where: { id: application.id, status: OpportunityApplicationStatus.Pending },
        data: { status: OpportunityApplicationStatus.Withdrawn },
      });
      if (changed.count !== 1) {
        throw new ConflictException('This application has already been updated.');
      }
      const updated = await tx.opportunityApplication.findUnique({
        where: { id: application.id },
      });
      if (!updated) {
        throw new NotFoundException('Application not found.');
      }
      const notification = await tx.notification.create({
        data: {
          userId: application.opportunity.organizerId,
          type: 'ApplicationUpdate',
          content: `${application.applicant.fullName} withdrew their application for "${application.opportunity.title}".`,
          actionUrl: `/app/opportunities/${opportunityId}`,
        },
      });
      return { updated, notification };
    });
    this.chatGateway.notifyUser(application.opportunity.organizerId, result.notification);
    return result.updated;
  }

  async listApplications(organizerId: string, opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, organizerId: true, organizationId: true },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found.');
    }
    const canManage = opportunity.organizationId
      ? await this.organizationsService.canManage(organizerId, opportunity.organizationId)
      : opportunity.organizerId === organizerId;
    if (!canManage) {
      throw new ForbiddenException('Only the opportunity organizer can view applications.');
    }

    return this.prisma.opportunityApplication.findMany({
      where: { opportunityId, status: { not: OpportunityApplicationStatus.Withdrawn } },
      include: {
        applicant: {
          select: {
            ...userSummary,
            profile: { select: { stageName: true, headline: true } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async listMyApplications(applicantId: string) {
    return this.prisma.opportunityApplication.findMany({
      where: { applicantId },
      include: {
        opportunity: {
          select: {
            id: true,
            title: true,
            status: true,
            eventDate: true,
            location: true,
            organizer: { select: userSummary },
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async updateApplication(
    organizerId: string,
    opportunityId: string,
    applicationId: string,
    status: 'Accepted' | 'Rejected',
    reviewMessage?: string,
  ) {
    const application = await this.prisma.opportunityApplication.findFirst({
      where: { id: applicationId, opportunityId },
      include: { opportunity: { select: { organizerId: true, organizationId: true, title: true } } },
    });
    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    const canManage = application.opportunity.organizationId
      ? await this.organizationsService.canManage(organizerId, application.opportunity.organizationId)
      : application.opportunity.organizerId === organizerId;
    if (!canManage) {
      throw new ForbiddenException('Only the opportunity organizer can review applications.');
    }
    if (application.status !== OpportunityApplicationStatus.Pending) {
      throw new ConflictException('Only pending applications can be reviewed.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.opportunityApplication.updateMany({
        where: { id: applicationId, status: OpportunityApplicationStatus.Pending },
        data: { status, reviewMessage: reviewMessage?.trim() || null },
      });
      if (changed.count !== 1) {
        throw new ConflictException('This application has already been reviewed.');
      }
      const updated = await tx.opportunityApplication.findUnique({
        where: { id: applicationId },
      });
      if (!updated) {
        throw new NotFoundException('Application not found.');
      }
      const notification = await tx.notification.create({
        data: {
          userId: application.applicantId,
          type: 'ApplicationUpdate',
          content: reviewMessage?.trim()
            ? `Your application for "${application.opportunity.title}" was ${status.toLowerCase()}. ${reviewMessage.trim()}`
            : `Your application for "${application.opportunity.title}" was ${status.toLowerCase()}.`,
          actionUrl: `/app/opportunities/${opportunityId}`,
        },
      });
      return { updated, notification };
    });
    this.chatGateway.notifyUser(application.applicantId, result.notification);
    return result.updated;
  }
}
