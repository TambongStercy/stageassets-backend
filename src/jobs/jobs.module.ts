import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReminderProcessor } from './processors/reminder.processor';
import { EmailsModule } from '../emails/emails.module';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'reminders',
    }),
    EmailsModule,
    DatabaseModule,
  ],
  providers: [ReminderProcessor],
  exports: [BullModule],
})
export class JobsModule {}
