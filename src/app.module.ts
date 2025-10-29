import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { SpeakersModule } from './speakers/speakers.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AssetsModule } from './assets/assets.module';
import { EmailsModule } from './emails/emails.module';
import { JobsModule } from './jobs/jobs.module';
import { AssetRequirementsModule } from './asset-requirements/asset-requirements.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 10, // 10 requests per minute
    }]),
    DatabaseModule,
    AuthModule,
    EventsModule,
    AssetRequirementsModule,
    SubscriptionPlansModule,
    SubscriptionsModule,
    UsersModule,
    ActivityLogsModule,
    RemindersModule,
    SpeakersModule,
    SubmissionsModule,
    AssetsModule,
    EmailsModule,
    JobsModule,
  ],
})
export class AppModule {}