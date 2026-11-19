import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [ChatModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
