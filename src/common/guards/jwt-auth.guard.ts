import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);
    const authenticated = result instanceof Observable ? await lastValueFrom(result) : await result;
    if (!authenticated) return false;

    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      user?: { id?: string };
    }>();
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0].replace(/\/+$/, '');
    if (this.isOnboardingRoute(request.method, path)) return true;

    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    if (!user.onboardingCompletedAt) {
      throw new ForbiddenException('Complete your account setup before using the platform.');
    }

    return true;
  }

  private isOnboardingRoute(method: string, path: string) {
    return (
      (method === 'GET' && path.endsWith('/auth/me')) ||
      (method === 'POST' && path.endsWith('/auth/onboarding/complete')) ||
      (method === 'PATCH' && path.endsWith('/auth/onboarding/account-type')) ||
      (method === 'PATCH' && path.endsWith('/auth/onboarding/progress')) ||
      ((method === 'GET' || method === 'PATCH') && path.endsWith('/profiles/me')) ||
      (method === 'POST' && path.endsWith('/profiles')) ||
      (path.includes('/profiles/me/') && ['GET', 'POST', 'PUT', 'DELETE'].includes(method)) ||
      (method === 'GET' && path.endsWith('/professions')) ||
      (method === 'GET' && (path.endsWith('/instruments') || path.endsWith('/genres'))) ||
      (method === 'PATCH' && path.endsWith('/users/me/profile')) ||
      (method === 'GET' && path.endsWith('/organizations/managed')) ||
      (method === 'POST' && path.endsWith('/organizations')) ||
      (method === 'PATCH' && /^.*\/organizations\/[^/]+$/.test(path)) ||
      (method === 'POST' && path.endsWith('/uploads'))
    );
  }
}
