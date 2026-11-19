import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { CommunitiesModule } from '../communities/communities.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [NotificationsModule, CommunitiesModule, StorageModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
