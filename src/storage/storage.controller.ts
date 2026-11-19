import { Body, Controller, Delete, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

class GenerateUploadDto {
  filename!: string;
  mimeType!: string;
  size!: number;
  category?: string;
}

class ConfirmUploadDto {
  objectKey!: string;
  originalFilename!: string;
  mimeType!: string;
  fileSize!: number;
  category!: string;
  visibility?: string;
}

type UploadedMediaFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@ApiTags('storage')
@Controller('uploads')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        category: { type: 'string' },
        visibility: { type: 'string', enum: ['Public', 'Private'] },
      },
    },
  })
  async uploadFile(
    @CurrentUser() user: User,
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() dto: { category?: string; visibility?: string },
  ) {
    return this.storageService.uploadFile(user.id, file, dto);
  }

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async generateUploadUrl(@CurrentUser() user: User, @Body() dto: GenerateUploadDto) {
    return this.storageService.generateUploadUrl(user.id, dto);
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async confirmUpload(@CurrentUser() user: User, @Body() dto: ConfirmUploadDto) {
    return this.storageService.confirmUpload(user.id, dto);
  }

  @Delete(':mediaId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteAsset(@CurrentUser() user: User, @Param('mediaId') mediaId: string) {
    return this.storageService.deleteAsset(user.id, mediaId);
  }
}
