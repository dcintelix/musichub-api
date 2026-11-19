import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { GroupsService } from './groups.service';

class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

}

class UpdateGroupDto extends PartialType(CreateGroupDto) {}

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async list(@CurrentUser() user: User) {
    return this.groupsService.list(user.id);
  }

  @Get('community/:communityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listByCommunity(
    @CurrentUser() user: User,
    @Param('communityId') communityId: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.groupsService.listByCommunity(user.id, communityId, beforeId);
  }

  @Get(':groupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'groupId', type: String })
  async getById(@CurrentUser() user: User, @Param('groupId') groupId: string) {
    return this.groupsService.getById(groupId, user.id);
  }

  @Get(':groupId/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listMembers(
    @CurrentUser() user: User,
    @Param('groupId') groupId: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.groupsService.listMembers(user.id, groupId, beforeId);
  }

  @Post(':groupId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async join(@CurrentUser() user: User, @Param('groupId') groupId: string) {
    return this.groupsService.join(user.id, groupId);
  }

  @Post(':groupId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async leave(@CurrentUser() user: User, @Param('groupId') groupId: string) {
    return this.groupsService.leave(user.id, groupId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@CurrentUser() user: User, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Post(':groupId/conversation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async openConversation(@CurrentUser() user: User, @Param('groupId') groupId: string) {
    return this.groupsService.getOrCreateConversation(user.id, groupId);
  }

  @Patch(':groupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'groupId', type: String })
  async update(@CurrentUser() user: User, @Param('groupId') groupId: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(user.id, groupId, dto);
  }

  @Delete(':groupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'groupId', type: String })
  async remove(@CurrentUser() user: User, @Param('groupId') groupId: string) {
    return this.groupsService.remove(user.id, groupId);
  }
}
