import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, BookingPreference } from '@prisma/client';
import { ChatGateway } from '../chat/chat.gateway';
import { PrismaService } from '../prisma/prisma.service';

const userSummary = {
  id: true,
  fullName: true,
  username: true,
  avatarMediaId: true,
  avatarUrl: true,
  profile: { select: { stageName: true, headline: true } },
} as const;

const bookingInclude = {
  requester: { select: userSummary },
  musician: { select: userSummary },
} as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async list(userId: string) {
    return this.prisma.bookingRequest.findMany({
      where: { OR: [{ requesterId: userId }, { musicianId: userId }] },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    requesterId: string,
    musicianId: string,
    payload: { eventTitle: string; eventDate: string; description?: string; location?: string; budget?: number; currency?: string },
  ) {
    if (requesterId === musicianId) {
      throw new ConflictException('You cannot book your own profile.');
    }

    const musician = await this.prisma.user.findFirst({
      where: { id: musicianId, status: 'Active', deletedAt: null },
      select: {
        id: true,
        profile: { select: { visibility: true, bookingPreference: true } },
      },
    });
    if (!musician?.profile || musician.profile.visibility !== 'Public') {
      throw new NotFoundException('Musician profile not found.');
    }
    if (musician.profile.bookingPreference === BookingPreference.NotAvailable) {
      throw new ConflictException('This musician is not accepting booking requests right now.');
    }

    const eventDate = new Date(payload.eventDate);
    if (!Number.isFinite(eventDate.getTime()) || eventDate <= new Date()) {
      throw new BadRequestException('Choose a future date for your event.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.bookingRequest.create({
        data: {
          requesterId,
          musicianId,
          eventTitle: payload.eventTitle.trim(),
          eventDate,
          description: payload.description?.trim() || null,
          location: payload.location?.trim() || null,
          budget: payload.budget,
          currency: payload.currency?.trim().toUpperCase() || 'RWF',
        },
        include: bookingInclude,
      });
      const notification = await tx.notification.create({
        data: {
          userId: musicianId,
          type: 'BookingRequest',
          content: `${booking.requester.fullName} sent you a booking request for "${booking.eventTitle}".`,
          actionUrl: '/app/bookings',
        },
      });
      return { booking, notification };
    });
    this.chatGateway.notifyUser(musicianId, result.notification);
    return result.booking;
  }

  async update(
    userId: string,
    bookingId: string,
    nextStatus: 'Accepted' | 'Declined' | 'Cancelled' | 'Completed',
    responseMessage?: string,
  ) {
    const booking = await this.prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    });
    if (!booking) {
      throw new NotFoundException('Booking request not found.');
    }

    const isMusician = booking.musicianId === userId;
    const isRequester = booking.requesterId === userId;
    if (!isMusician && !isRequester) {
      throw new ForbiddenException('You do not have access to this booking request.');
    }

    const allowed = nextStatus === BookingStatus.Cancelled
      ? booking.status === BookingStatus.Pending || booking.status === BookingStatus.Accepted
      : isMusician && (
        (nextStatus === BookingStatus.Accepted && booking.status === BookingStatus.Pending) ||
        (nextStatus === BookingStatus.Declined && booking.status === BookingStatus.Pending) ||
        (nextStatus === BookingStatus.Completed && booking.status === BookingStatus.Accepted)
      );
    if (!allowed) {
      throw new ConflictException('This booking request can no longer be updated that way.');
    }

    const recipientId = isMusician ? booking.requesterId : booking.musicianId;
    const statusMessage = nextStatus === 'Accepted'
      ? 'accepted'
      : nextStatus === 'Declined'
        ? 'declined'
        : nextStatus === 'Completed'
          ? 'marked as completed'
          : 'cancelled';
    const notificationType = nextStatus === 'Cancelled'
      ? 'BookingCancellation'
      : nextStatus === 'Accepted'
        ? 'BookingConfirmation'
        : 'BookingProposal';
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.bookingRequest.updateMany({
        where: { id: bookingId, status: booking.status },
        data: { status: nextStatus, responseMessage: responseMessage?.trim() || null },
      });
      if (changed.count !== 1) {
        throw new ConflictException('This booking request has already been updated.');
      }
      const updated = await tx.bookingRequest.findUnique({
        where: { id: bookingId },
        include: bookingInclude,
      });
      if (!updated) {
        throw new NotFoundException('Booking request not found.');
      }
      const notification = await tx.notification.create({
        data: {
          userId: recipientId,
          type: notificationType,
          content: responseMessage?.trim()
            ? `Your booking request for "${booking.eventTitle}" was ${statusMessage}. ${responseMessage.trim()}`
            : `Your booking request for "${booking.eventTitle}" was ${statusMessage}.`,
          actionUrl: '/app/bookings',
        },
      });
      return { updated, notification };
    });
    this.chatGateway.notifyUser(recipientId, result.notification);
    return result.updated;
  }
}
