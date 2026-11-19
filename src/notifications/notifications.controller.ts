import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async list(@CurrentUser() user: User, @Query('beforeId') beforeId?: string) {
    return this.notificationsService.list(user.id, beforeId);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async unreadCount(@CurrentUser() user: User) {
    return { unreadCount: await this.notificationsService.countUnread(user.id) };
  }

  @Get(':notificationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getById(@CurrentUser() user: User, @Param('notificationId') notificationId: string) {
    return this.notificationsService.getById(user.id, notificationId);
  }

  @Patch(':notificationId/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'notificationId', type: String })
  async markAsRead(@CurrentUser() user: User, @Param('notificationId') notificationId: string) {
    return this.notificationsService.markAsRead(user.id, notificationId);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async markAllAsRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
