import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { CommunitiesService } from '../communities/communities.service';
import { normalizeEmail } from '../common/utils/normalize-email.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  async register(input: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    accountType?: 'Musician' | 'EventOrganizer';
  }) {
    const fullName = input.fullName.trim();
    const username = input.username.trim();
    const email = normalizeEmail(input.email);

    if (!fullName || !username || !email || !input.password) {
      throw new BadRequestException('All required fields must be provided.');
    }

    if (input.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered.');
      }
      throw new ConflictException('Username already taken.');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        fullName,
        username,
        email,
        phone: input.phone?.trim() || null,
        passwordHash,
        status: 'PendingVerification',
        accountType: input.accountType ?? 'Musician',
        accountTypeSelectedAt: new Date(),
        onboardingStep: 1,
      },
    });

    this.logger.log(`REGISTER_CREATED userId=${user.id}`);
    await this.createAndSendVerificationCode(user.id, user.email, user.fullName);

    return {
      verificationRequired: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        status: user.status,
        accountType: user.accountType,
      },
    };
  }

  async login(input: { email: string; password: string }) {
    this.logger.debug('LOGIN_ATTEMPT');
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      this.logger.warn('LOGIN_REJECTED reason=account_not_found');
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== 'Active') {
      this.logger.warn(`LOGIN_REJECTED reason=account_not_active userId=${user.id} status=${user.status}`);
      throw new UnauthorizedException('Account is not active.');
    }

    const passwordValid = await argon2.verify(user.passwordHash, input.password);
    if (!passwordValid) {
      this.logger.warn(`LOGIN_REJECTED reason=password_mismatch userId=${user.id}`);
      throw new UnauthorizedException('Invalid credentials.');
    }

    this.logger.debug(`LOGIN_CREDENTIALS_VALID userId=${user.id}`);
    const communityId = await this.communitiesService.ensureDefaultCommunity(user.id);
    this.logger.debug(`LOGIN_COMMUNITY_READY userId=${user.id} communityId=${communityId}`);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles.map(({ role }) => role.name),
    });

    const refreshToken = randomBytes(32).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: refreshExpiresAt,
      },
    });

    this.logger.log(`LOGIN_SUCCESS userId=${user.id}`);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        status: user.status,
        roles: user.roles.map(({ role }) => role.name),
        accountType: user.accountType,
        accountTypeSelected: user.accountTypeSelectedAt !== null,
        onboardingStep: user.onboardingStep,
        onboardingCompleted: user.onboardingCompletedAt !== null,
      },
    };
  }

  async verifyEmail(emailInput: string, otp: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    const record = user
      ? await this.prisma.emailVerificationToken.findFirst({
          where: { userId: user.id, usedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!user || user.status !== 'PendingVerification' || !record ||
      record.expiresAt < new Date() || !(await argon2.verify(record.tokenHash, otp))) {
      this.logger.warn(`EMAIL_VERIFICATION_REJECTED reason=invalid_or_expired userId=${user?.id ?? 'unknown'}`);
      throw new BadRequestException('Verification code is invalid or expired.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { status: 'Active', emailVerifiedAt: new Date() },
      });

    });
    await this.communitiesService.ensureDefaultCommunity(user.id);

    this.logger.log(`EMAIL_VERIFICATION_SUCCESS userId=${user.id}`);
    return { success: true };
  }

  async resendVerificationCode(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new BadRequestException('No account is registered with this email address.');
    }

    if (user.status !== 'PendingVerification') {
      throw new BadRequestException('This email is already verified or the account cannot be verified.');
    }

    const recentToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentToken) {
      throw new HttpException(
        'Please wait a minute before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.createAndSendVerificationCode(user.id, user.email, user.fullName);
    this.logger.log(`VERIFICATION_CODE_RESENT userId=${user.id}`);
    return { success: true };
  }

  async requestPasswordReset(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== 'Active') {
      return { success: true };
    }

    const recentToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentToken) {
      return { success: true };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(user.email, user.fullName, token);
    } catch (error) {
      this.logDeliveryFailure('PASSWORD_RESET_EMAIL', user.id, error);
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Could not send the password reset email. Please try again.');
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, id: { not: record.id }, usedAt: null },
      data: { usedAt: new Date() },
    });

    this.logger.log(`PASSWORD_RESET_EMAIL_SENT userId=${user.id}`);
    return { success: true };
  }

  async resetPassword(token: string, password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const passwordHash = await argon2.hash(password);

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      });
      if (!record) {
        throw new BadRequestException('Password reset link is invalid or expired.');
      }

      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('Password reset link is invalid or expired.');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, id: { not: record.id }, usedAt: null },
        data: { usedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });

    });

    this.logger.log('PASSWORD_RESET_SUCCESS');
    return { success: true };
  }

  private async createAndSendVerificationCode(userId: string, email: string, fullName: string) {
    const otp = randomInt(100_000, 1_000_000).toString();
    const tokenHash = await argon2.hash(otp);
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const record = await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    try {
      await this.emailService.sendVerificationCode(email, fullName, otp);
    } catch (error) {
      this.logDeliveryFailure('VERIFICATION_EMAIL', userId, error);
      await this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Could not send the verification code. Please try again.');
    }

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, id: { not: record.id }, usedAt: null },
      data: { usedAt: new Date() },
    });
    this.logger.log(`VERIFICATION_EMAIL_SENT userId=${userId}`);
  }

  async refresh(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    let record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });

    if (!record) {
      const legacyRecords = await this.prisma.refreshToken.findMany({
        where: { revokedAt: null, tokenHash: { startsWith: '$argon2' } },
        include: { user: { include: { roles: { include: { role: true } } } } },
      });

      for (const legacyRecord of legacyRecords) {
        if (await argon2.verify(legacyRecord.tokenHash, token)) {
          record = legacyRecord;
          break;
        }
      }
    }

    if (!record || record.expiresAt < new Date()) {
      this.logger.warn('REFRESH_REJECTED reason=invalid_or_expired');
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const newAccessToken = this.jwtService.sign({
      sub: record.user.id,
      email: record.user.email,
      username: record.user.username,
      roles: record.user.roles.map(({ role }) => role.name),
    });

    const newRefreshToken = randomBytes(32).toString('hex');

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: record.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: createHash('sha256').update(newRefreshToken).digest('hex'),
        },
      });

      await tx.refreshToken.create({
        data: {
          userId: record.userId,
          tokenHash: createHash('sha256').update(newRefreshToken).digest('hex'),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        },
      });
    });

    this.logger.log(`REFRESH_SUCCESS userId=${record.userId}`);
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        profile: true,
        organizationMemberships: {
          where: { status: 'Active' },
          select: {
            role: true,
            status: true,
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                logoUrl: true,
                isActive: true,
                isPublished: true,
              },
            },
          },
        },
        ownedOrganizations: {
          select: {
            id: true,
            name: true,
            type: true,
            logoUrl: true,
            isActive: true,
            isPublished: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`AUTH_ME_USER_NOT_FOUND userId=${userId}`);
      throw new BadRequestException('User not found.');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      phone: user.phone,
      avatarMediaId: user.avatarMediaId,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles: user.roles.map(({ role }) => role.name),
      profile: user.profile,
      organizationMemberships: user.organizationMemberships,
      availablePublishingIdentities: [
        { type: 'Personal', id: user.id, name: user.fullName },
        ...new Map(
          [
            ...user.ownedOrganizations
              .filter((organization) => organization.isActive && organization.isPublished)
              .map((organization) => [organization, 'Owner'] as const),
            ...user.organizationMemberships
              .filter(({ role, organization }) =>
                ['Owner', 'Admin', 'Manager'].includes(role) && organization.isActive && organization.isPublished)
              .map(({ organization, role }) => [organization, role] as const),
          ].map(([organization, role]) => [
            organization.id,
            {
              type: 'Organization',
              id: organization.id,
              name: organization.name,
              logoUrl: organization.logoUrl,
              role,
            },
          ]),
        ).values(),
      ],
      accountType: user.accountType,
      accountTypeSelected: user.accountTypeSelectedAt !== null,
      onboardingStep: user.onboardingStep,
      onboardingStatus: user.onboardingCompletedAt
        ? 'COMPLETED'
        : user.onboardingStep > 1 ? 'IN_PROGRESS' : 'NOT_STARTED',
      onboardingCompleted: user.onboardingCompletedAt !== null,
    };
  }

  async updateOnboardingProgress(userId: string, step: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingStep: true, onboardingCompletedAt: true, accountTypeSelectedAt: true },
    });
    if (!user) throw new BadRequestException('User not found.');
    if (!user.accountTypeSelectedAt) {
      throw new BadRequestException('Select your account type before continuing onboarding.');
    }
    if (user.onboardingCompletedAt) return { step: 4, onboardingCompleted: true };
    if (step > user.onboardingStep + 1) {
      throw new BadRequestException('Complete the current onboarding step before moving ahead.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: step },
    });
    return { step, onboardingCompleted: false };
  }

  async selectAccountType(userId: string, accountType: 'Musician' | 'EventOrganizer') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, onboardingCompletedAt: true },
    });
    if (!user) throw new BadRequestException('User not found.');
    if (!user.emailVerifiedAt) {
      throw new BadRequestException('Verify your account email before choosing an account type.');
    }
    if (user.onboardingCompletedAt) {
      throw new ConflictException('Your onboarding is already complete.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { accountType, accountTypeSelectedAt: new Date(), onboardingStep: 1 },
    });
    return { accountType, accountTypeSelected: true, onboardingStep: 1 };
  }

  async completeOnboarding(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountType: true,
        accountTypeSelectedAt: true,
        fullName: true,
        email: true,
        phone: true,
        avatarMediaId: true,
        emailVerifiedAt: true,
        onboardingCompletedAt: true,
      },
    });
    if (!user) throw new BadRequestException('User not found.');
    if (user.onboardingCompletedAt) return { onboardingCompleted: true };
    if (!user.accountTypeSelectedAt) {
      throw new BadRequestException('Select your account type before completing onboarding.');
    }
    if (!user.emailVerifiedAt) {
      throw new BadRequestException('Verify your account email before completing onboarding.');
    }
    if (!user.fullName.trim() || !user.phone?.trim()) {
      throw new BadRequestException('Add your full name and phone number before continuing.');
    }

    if (user.accountType === 'EventOrganizer') {
      const organization = await this.prisma.organization.findFirst({
        where: { ownerId: userId, isActive: true },
        include: {
          members: {
            where: { userId, status: 'Active', role: 'Owner' },
            select: { title: true, authorizationConfirmedAt: true },
            take: 1,
          },
        },
      });
      if (!organization || !organization.name.trim() || !organization.type?.trim() ||
        !organization.description?.trim() || !organization.logoUrl?.trim() ||
        !organization.country?.trim() || !organization.city?.trim() ||
        !organization.email?.trim() || !organization.phone?.trim() ||
        organization.email !== user.email ||
        !organization.members[0]?.title?.trim() ||
        !organization.members[0]?.authorizationConfirmedAt) {
        throw new BadRequestException('Complete the required organization and owner information before continuing.');
      }
      await this.prisma.$transaction([
        this.prisma.organization.update({
          where: { id: organization.id },
          data: { isPublished: true, isActive: true },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: new Date(), onboardingStep: 4 },
        }),
      ]);
    } else {
      const [profile, professionsCount, genresCount, avatar] = await Promise.all([
        this.prisma.musicianProfile.findUnique({ where: { userId } }),
        this.prisma.musicianProfession.count({ where: { userId } }),
        this.prisma.musicianGenre.count({ where: { userId } }),
        user.avatarMediaId
          ? this.prisma.mediaAsset.findFirst({
              where: {
                id: user.avatarMediaId,
                ownerId: userId,
                category: 'Avatar',
                uploadStatus: 'Uploaded',
                deletedAt: null,
              },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);
      if (!avatar || !profile || !profile.biography?.trim() ||
        !profile.city?.trim() || !profile.country?.trim() || professionsCount === 0 ||
        (genresCount === 0 && profile.customGenres.length === 0)) {
        throw new BadRequestException('Add a profile photo, professional biography, location, at least one profession, and at least one genre before continuing.');
      }

      await this.prisma.$transaction([
        this.prisma.musicianProfile.update({
          where: { userId },
          data: { visibility: 'Public' },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: new Date(), onboardingStep: 4 },
        }),
      ]);
    }
    return { onboardingCompleted: true };
  }

  private logDeliveryFailure(operation: string, userId: string, error: unknown) {
    const errorType = error instanceof Error ? error.name : typeof error;
    this.logger.error(`${operation}_FAILED userId=${userId} errorType=${errorType}`);
  }
}
