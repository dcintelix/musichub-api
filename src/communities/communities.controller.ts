import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { CommunitiesService } from './communities.service';

class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['Public', 'Private'])
  type?: string;
}

class UpdateCommunityDto extends PartialType(CreateCommunityDto) {}

@ApiTags('communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async list(@CurrentUser() user: User) {
    return this.communitiesService.list(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@CurrentUser() user: User, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.create(user.id, dto);
  }

  @Get(':communityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getById(@CurrentUser() user: User, @Param('communityId') communityId: string) {
    return this.communitiesService.getById(communityId, user.id);
  }

  @Patch(':communityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@CurrentUser() user: User, @Param('communityId') communityId: string, @Body() dto: UpdateCommunityDto) {
    return this.communitiesService.update(user.id, communityId, dto);
  }

  @Post(':communityId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async join(@CurrentUser() user: User, @Param('communityId') communityId: string) {
    return this.communitiesService.joinCommunity(user.id, communityId);
  }

  @Post(':communityId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async leave(@CurrentUser() user: User, @Param('communityId') communityId: string) {
    return this.communitiesService.leaveCommunity(user.id, communityId);
  }

  @Get(':communityId/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async members(
    @CurrentUser() user: User,
    @Param('communityId') communityId: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.communitiesService.listMembers(user.id, communityId, beforeId);
  }

  @Get(':communityId/membership')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async membership(@CurrentUser() user: User, @Param('communityId') communityId: string) {
    const community = await this.communitiesService.getById(communityId, user.id);
    return community.members[0] ?? null;
  }

  @Get(':communityId/requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async requests(@CurrentUser() user: User, @Param('communityId') communityId: string) {
    return this.communitiesService.listRequests(user.id, communityId);
  }

  @Post(':communityId/requests/:requestId/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async approveRequest(@CurrentUser() user: User, @Param('communityId') communityId: string, @Param('requestId') requestId: string) {
    return this.communitiesService.respondToRequest(user.id, communityId, requestId, 'approve');
  }

  @Post(':communityId/requests/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async rejectRequest(@CurrentUser() user: User, @Param('communityId') communityId: string, @Param('requestId') requestId: string) {
    return this.communitiesService.respondToRequest(user.id, communityId, requestId, 'reject');
  }

  @Delete(':communityId/members/:memberId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeMember(@CurrentUser() user: User, @Param('communityId') communityId: string, @Param('memberId') memberId: string) {
    return this.communitiesService.removeMember(user.id, communityId, memberId);
  }
}
