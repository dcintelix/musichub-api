import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProfessionsService } from './professions.service';

class CreateProfessionDto {
  name!: string;
  category?: string;
  description?: string;
}

@ApiTags('professions')
@Controller('professions')
export class ProfessionsController {
  constructor(private readonly professionsService: ProfessionsService) {}

  @Get()
  async list() {
    return this.professionsService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreateProfessionDto) {
    return this.professionsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@Param('id') id: string, @Body() dto: Partial<CreateProfessionDto> & { isActive?: boolean }) {
    return this.professionsService.update(id, dto);
  }
}
