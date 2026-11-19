import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { BookingsService } from './bookings.service';

class CreateBookingDto {
  @IsString()
  @MaxLength(160)
  eventTitle!: string;

  @IsDateString()
  eventDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

class UpdateBookingDto {
  @IsIn(['Accepted', 'Declined', 'Cancelled', 'Completed'])
  status!: 'Accepted' | 'Declined' | 'Cancelled' | 'Completed';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responseMessage?: string;
}

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.bookingsService.list(user.id);
  }

  @Post(':musicianId')
  async create(
    @CurrentUser() user: User,
    @Param('musicianId', new ParseUUIDPipe()) musicianId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(user.id, musicianId, dto);
  }

  @Patch(':bookingId')
  async update(
    @CurrentUser() user: User,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(user.id, bookingId, dto.status, dto.responseMessage);
  }
}
