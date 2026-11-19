import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { MessagingService } from './messaging.service';

class CreateConversationDto {
  @IsUUID()
  targetUserId!: string;
}

class SendMessageDto {
  @IsOptional()
  @IsIn(['Text', 'Image', 'Video', 'Audio', 'Document'])
  type?: 'Text' | 'Image' | 'Video' | 'Audio' | 'Document';

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}

@ApiTags('messaging')
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listConversations(@CurrentUser() user: User, @Query('beforeId') beforeId?: string) {
    return this.messagingService.listConversations(user.id, beforeId);
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createConversation(@CurrentUser() user: User, @Body() dto: CreateConversationDto) {
    return this.messagingService.createConversation(user.id, dto);
  }

  @Get('conversations/:conversationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'conversationId', type: String })
  async getConversation(@CurrentUser() user: User, @Param('conversationId') conversationId: string) {
    return this.messagingService.getConversation(user.id, conversationId);
  }

  @Get('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'conversationId', type: String })
  async listMessages(
    @CurrentUser() user: User,
    @Param('conversationId') conversationId: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.messagingService.listMessages(user.id, conversationId, beforeId);
  }

  @Get('conversations/:conversationId/media/:mediaId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAttachmentUrl(
    @CurrentUser() user: User,
    @Param('conversationId') conversationId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.messagingService.getAttachmentUrl(user.id, conversationId, mediaId);
  }

  @Patch('conversations/:conversationId/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'conversationId', type: String })
  async markConversationAsRead(@CurrentUser() user: User, @Param('conversationId') conversationId: string) {
    return this.messagingService.markMessagesAsRead(user.id, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'conversationId', type: String })
  async sendMessage(
    @CurrentUser() user: User,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(user.id, conversationId, dto);
  }
}
