import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { OpportunityApplicationStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { OpportunitiesService } from './opportunities.service';

class CreateOpportunityDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}

class CreateApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  coverLetter?: string;
}

class UpdateApplicationDto {
  @IsIn([OpportunityApplicationStatus.Accepted, OpportunityApplicationStatus.Rejected])
  status!: 'Accepted' | 'Rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewMessage?: string;
}

@ApiTags('opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  async list() {
    return this.opportunitiesService.list();
  }

  @Get(':opportunityId')
  async getById(@Param('opportunityId') opportunityId: string) {
    return this.opportunitiesService.getById(opportunityId);
  }

  @Get(':opportunityId/applications/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyApplication(@CurrentUser() user: User, @Param('opportunityId') opportunityId: string) {
    return this.opportunitiesService.getApplication(user.id, opportunityId);
  }

  @Post(':opportunityId/applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async apply(
    @CurrentUser() user: User,
    @Param('opportunityId') opportunityId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.opportunitiesService.apply(user.id, opportunityId, dto);
  }

  @Delete(':opportunityId/applications/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async withdrawApplication(@CurrentUser() user: User, @Param('opportunityId') opportunityId: string) {
    return this.opportunitiesService.withdrawApplication(user.id, opportunityId);
  }

  @Get(':opportunityId/applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listApplications(@CurrentUser() user: User, @Param('opportunityId') opportunityId: string) {
    return this.opportunitiesService.listApplications(user.id, opportunityId);
  }

  @Patch(':opportunityId/applications/:applicationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateApplication(
    @CurrentUser() user: User,
    @Param('opportunityId') opportunityId: string,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.opportunitiesService.updateApplication(user.id, opportunityId, applicationId, dto.status, dto.reviewMessage);
  }

  @Get('applications/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listMyApplications(@CurrentUser() user: User) {
    return this.opportunitiesService.listMyApplications(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@CurrentUser() user: User, @Body() dto: CreateOpportunityDto) {
    return this.opportunitiesService.create(user.id, dto);
  }

  @Patch(':opportunityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(
    @CurrentUser() user: User,
    @Param('opportunityId') opportunityId: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(user.id, opportunityId, dto);
  }

  @Delete(':opportunityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@CurrentUser() user: User, @Param('opportunityId') opportunityId: string) {
    return this.opportunitiesService.remove(user.id, opportunityId);
  }
}
