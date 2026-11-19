import { Body, Controller, Delete, Get, Param, ParseArrayPipe, Post, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

class CreateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  stageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  biography?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @IsOptional()
  @IsIn(['Beginner', 'Intermediate', 'Advanced', 'Professional'])
  skillLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  customGenres?: string[];

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsIn(['Public', 'Private', 'Unlisted'])
  visibility?: string;

  @IsOptional()
  @IsIn(['DirectMessage', 'Email', 'Phone'])
  contactPreference?: string;

  @IsOptional()
  @IsIn(['OpenToBooking', 'InquireFirst', 'NotAvailable'])
  bookingPreference?: string;
}

class AvailabilityItemDto {
  @IsIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  dayOfWeek!: string;

  @ValidateIf((item: AvailabilityItemDto) => item.isAvailable !== false)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @ValidateIf((item: AvailabilityItemDto) => item.isAvailable !== false)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

class PortfolioItemDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  mediaUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class InstrumentAssociationDto {
  @IsUUID()
  instrumentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  skillLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;
}

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async discover(@Query('search') search?: string) {
    return this.profilesService.discoverProfiles(search);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyProfile(@CurrentUser() user: User) {
    return this.profilesService.getMyProfile(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createProfile(@CurrentUser() user: User, @Body() dto: CreateProfileDto) {
    return this.profilesService.createProfile(user.id, dto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateProfile(@CurrentUser() user: User, @Body() dto: CreateProfileDto) {
    return this.profilesService.updateProfile(user.id, dto);
  }

  @Get('me/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAvailability(@CurrentUser() user: User) {
    return this.profilesService.getAvailability(user.id);
  }

  @Put('me/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async setAvailability(
    @CurrentUser() user: User,
    @Body(new ParseArrayPipe({
      items: AvailabilityItemDto,
      whitelist: true,
      forbidNonWhitelisted: true,
    })) dto: AvailabilityItemDto[],
  ) {
    return this.profilesService.setAvailability(user.id, dto);
  }

  @Get('me/portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPortfolio(@CurrentUser() user: User) {
    return this.profilesService.getPortfolio(user.id);
  }

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addPortfolioItem(@CurrentUser() user: User, @Body() dto: PortfolioItemDto) {
    return this.profilesService.addPortfolioItem(user.id, dto);
  }

  @Post('me/professions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addProfession(@CurrentUser() user: User, @Body('professionId') professionId: string) {
    return this.profilesService.addProfession(user.id, professionId);
  }

  @Delete('me/professions/:professionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeProfession(@CurrentUser() user: User, @Param('professionId') professionId: string) {
    return this.profilesService.removeProfession(user.id, professionId);
  }

  @Post('me/instruments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addInstrument(@CurrentUser() user: User, @Body() dto: InstrumentAssociationDto) {
    return this.profilesService.addInstrument(user.id, dto.instrumentId, dto);
  }

  @Delete('me/instruments/:instrumentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeInstrument(@CurrentUser() user: User, @Param('instrumentId') instrumentId: string) {
    return this.profilesService.removeInstrument(user.id, instrumentId);
  }

  @Post('me/genres')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addGenre(@CurrentUser() user: User, @Body('genreId') genreId: string) {
    return this.profilesService.addGenre(user.id, genreId);
  }

  @Delete('me/genres/:genreId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeGenre(@CurrentUser() user: User, @Param('genreId') genreId: string) {
    return this.profilesService.removeGenre(user.id, genreId);
  }
}
