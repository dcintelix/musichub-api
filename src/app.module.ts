import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfilesModule } from './profiles/profiles.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';
import { ProfessionsModule } from './professions/professions.module';
import { InstrumentsModule } from './instruments/instruments.module';
import { GenresModule } from './genres/genres.module';
import { LocationsModule } from './locations/locations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { VerificationModule } from './verification/verification.module';
import { CommunitiesModule } from './communities/communities.module';
import { PostsModule } from './posts/posts.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GroupsModule } from './groups/groups.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { ChatModule } from './chat/chat.module';
import { LandingPageModule } from './public/landing-page.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [AppConfig],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    StorageModule,
    HealthModule,
    EmailModule,
    ProfessionsModule,
    InstrumentsModule,
    GenresModule,
    LocationsModule,
    OrganizationsModule,
    VerificationModule,
    CommunitiesModule,
    PostsModule,
    MessagingModule,
    NotificationsModule,
    GroupsModule,
    OpportunitiesModule,
    ChatModule,
    LandingPageModule,
    BookingsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
