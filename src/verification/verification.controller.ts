import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { VerificationService } from './verification.service';

class CreateVerificationDto {
  type!: string;
  notes?: string;
}

class ReviewVerificationDto {
  status!: string;
  notes?: string;
  reviewedBy?: string;
}

@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async list(@CurrentUser() user: User) {
    return this.verificationService.listByUser(user.id);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@CurrentUser() user: User, @Body() dto: CreateVerificationDto) {
    return this.verificationService.create(user.id, dto);
  }

  @Post(':recordId/review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async review(@Param('recordId') recordId: string, @Body() dto: ReviewVerificationDto) {
    return this.verificationService.review(recordId, dto);
  }
}
