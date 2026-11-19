import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [OrganizationsModule, ChatModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
