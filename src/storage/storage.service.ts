import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { MediaCategory, MediaVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type UploadedMediaFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

function isMediaCategory(value: string): value is MediaCategory {
  return Object.values(MediaCategory).some((category) => category === value);
}

function isMediaVisibility(value: string): value is MediaVisibility {
  return Object.values(MediaVisibility).some((visibility) => visibility === value);
}

function isAllowedMediaMimeType(value: string) {
  const mimeType = value.split(';', 1)[0].trim().toLowerCase();
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'video/mp4',
    'application/pdf',
  ].includes(mimeType);
}

@Injectable()
export class StorageService {
  private readonly s3: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('R2_REGION', 'auto'),
      endpoint: this.configService.get<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('R2_SECRET_ACCESS_KEY', ''),
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(
    userId: string,
    file: UploadedMediaFile | undefined,
    options: { category?: string; visibility?: string },
  ) {
    if (!file) {
      throw new BadRequestException('Select a file to upload.');
    }

    const bucket = this.configService.get<string>('R2_BUCKET_NAME');
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('R2 storage is not configured on the backend.');
    }

    if (!isAllowedMediaMimeType(file.mimetype)) {
      throw new BadRequestException('Unsupported file type.');
    }
    if (!file.size || file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('File must be no larger than 15MB.');
    }

    const category = options.category ?? MediaCategory.Portfolio;
    if (!isMediaCategory(category)) {
      throw new BadRequestException('Unsupported media category.');
    }
    const visibility = options.visibility ?? MediaVisibility.Private;
    if (!isMediaVisibility(visibility)) {
      throw new BadRequestException('Unsupported media visibility.');
    }

    const originalFilename = file.originalname.split(/[\\/]/).pop() || 'upload';
    const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'upload';
    const objectKey = `uploads/${userId}/${randomUUID()}-${safeFilename}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: file.buffer,
      ContentLength: file.size,
      ContentType: file.mimetype,
    }));

    const publicBaseUrl = this.configService.get<string>('R2_PUBLIC_BASE_URL')?.replace(/\/+$/, '');
    return this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        objectKey,
        originalFilename,
        mimeType: file.mimetype,
        fileSize: file.size,
        category,
        visibility,
        uploadStatus: 'Uploaded',
        url: visibility === MediaVisibility.Public && publicBaseUrl
          ? `${publicBaseUrl}/${objectKey}`
          : null,
      },
    });
  }

  async generateUploadUrl(userId: string, payload: { filename: string; mimeType: string; size: number; category?: string }) {
    const bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
    if (!bucket) {
      throw new BadRequestException('R2 bucket is not configured.');
    }

    if (!isAllowedMediaMimeType(payload.mimeType)) {
      throw new BadRequestException('Unsupported file type.');
    }

    if (payload.size > 15 * 1024 * 1024) {
      throw new BadRequestException('File exceeds 15MB limit.');
    }

    const objectKey = `uploads/${userId}/${randomUUID()}-${payload.filename.replace(/\s+/g, '-')}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: payload.mimeType,
      ACL: 'private',
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return {
      uploadUrl: url,
      objectKey,
      expiresIn: 300,
    };
  }

  async confirmUpload(userId: string, payload: { objectKey: string; originalFilename: string; mimeType: string; fileSize: number; category: string; visibility?: string }) {
    const bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
    const objectUrl = this.configService.get<string>('R2_PUBLIC_BASE_URL', '');

    const head = await this.s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: payload.objectKey,
      }),
    );

    if (!head.ContentLength || head.ContentLength !== payload.fileSize) {
      throw new BadRequestException('Uploaded object could not be verified.');
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        objectKey: payload.objectKey,
        originalFilename: payload.originalFilename,
        mimeType: payload.mimeType,
        fileSize: payload.fileSize,
        category: payload.category as any,
        visibility: (payload.visibility ?? 'Private') as any,
        uploadStatus: 'Uploaded',
        url: objectUrl ? `${objectUrl}/${payload.objectKey}` : null,
      },
    });

    return asset;
  }

  async deleteAsset(userId: string, mediaId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ownerId: userId, deletedAt: null },
    });

    if (!asset) {
      throw new BadRequestException('Media asset not found or not owned by this user.');
    }

    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    });

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.configService.get<string>('R2_BUCKET_NAME', ''),
        Key: asset.objectKey,
      }),
    );

    return { success: true };
  }

  async createPrivateDownloadUrl(objectKey: string) {
    const bucket = this.configService.get<string>('R2_BUCKET_NAME');
    if (!bucket) {
      throw new ServiceUnavailableException('R2 storage is not configured on the backend.');
    }

    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { expiresIn: 300 },
    );
  }
}
