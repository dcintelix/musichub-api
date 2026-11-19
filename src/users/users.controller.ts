import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './user.entity';

class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;
}

class UpdateOnboardingIdentityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsUUID()
  avatarMediaId?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateOnboardingIdentity(
    @CurrentUser() user: User,
    @Body() dto: UpdateOnboardingIdentityDto,
  ) {
    return this.usersService.updateOnboardingIdentity(user.id, dto);
  }

  @Get('me/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPreferences(@CurrentUser() user: User) {
    return this.usersService.getPreferences(user.id);
  }

  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updatePreferences(@CurrentUser() user: User, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(user.id, dto);
  }

  @Get('me/following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listFollowing(@CurrentUser() user: User) {
    return this.usersService.listFollowing(user.id);
  }

  @Get('me/followers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listFollowers(@CurrentUser() user: User) {
    return this.usersService.listFollowers(user.id);
  }

  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async follow(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.usersService.follow(user.id, userId);
  }

  @Delete(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async unfollow(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.usersService.unfollow(user.id, userId);
  }

  @Get('me/saved-opportunities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listSavedOpportunities(@CurrentUser() user: User) {
    return this.usersService.listSavedOpportunities(user.id);
  }

  @Post('me/saved-opportunities/:opportunityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async saveOpportunity(@CurrentUser() user: User, @Param('opportunityId') opportunityId: string) {
    return this.usersService.saveOpportunity(user.id, opportunityId);
  }

  @Delete('me/saved-opportunities/:opportunityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async unsaveOpportunity(@CurrentUser() user: User, @Param('opportunityId') opportunityId: string) {
    return this.usersService.unsaveOpportunity(user.id, opportunityId);
  }
}
