import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService onboarding', () => {
  function createService(prisma: Record<string, any>) {
    return new AuthService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('requires a verified account and a selected account type', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          accountType: 'Musician',
          accountTypeSelectedAt: null,
          onboardingCompletedAt: null,
          emailVerifiedAt: null,
        }),
      },
    };

    await expect(createService(prisma).completeOnboarding('user-id'))
      .rejects.toThrow('Select your account type before completing onboarding.');
  });

  it('publishes the organizer profile only after owner authorization is complete', async () => {
    const user = {
      accountType: 'EventOrganizer',
      accountTypeSelectedAt: new Date(),
      onboardingCompletedAt: null,
      emailVerifiedAt: new Date(),
      fullName: 'Organizer',
      email: 'organizer@example.com',
      phone: '+250780000000',
    };
    const organization = {
      id: 'organization-id',
      ownerId: 'user-id',
      name: 'Music Events',
      type: 'Event Management Company',
      description: 'Local music events',
      logoUrl: 'https://media.example.com/logo.png',
      country: 'Rwanda',
      city: 'Kigali',
      email: user.email,
      phone: user.phone,
      members: [{ title: 'Director', authorizationConfirmedAt: new Date() }],
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({}),
      },
      organization: {
        findFirst: jest.fn().mockResolvedValue(organization),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };

    await expect(createService(prisma).completeOnboarding('user-id'))
      .resolves.toEqual({ onboardingCompleted: true });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'organization-id' },
      data: { isPublished: true, isActive: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { onboardingCompletedAt: expect.any(Date), onboardingStep: 4 },
    });
  });
});
