import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, MessagingModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
