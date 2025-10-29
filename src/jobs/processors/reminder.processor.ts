import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { DATABASE_CONNECTION } from '../../db/database.providers';
import { EmailsService } from '../../emails/emails.service';

interface ReminderJobData {
  speakerId: number;
  eventId: number;
}

@Processor('reminders')
export class ReminderProcessor {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private emailsService: EmailsService,
  ) {}

  @Process('send-reminder')
  async handleReminderJob(job: Job<ReminderJobData>) {
    const { speakerId, eventId } = job.data;

    try {
      // Get speaker details
      const [speaker] = await this.db
        .select()
        .from(schema.speakers)
        .where(eq(schema.speakers.id, speakerId))
        .limit(1);

      if (!speaker || speaker.submissionStatus === 'complete') {
        return { message: 'Speaker not found or already completed' };
      }

      // Get event details
      const [event] = await this.db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, eventId))
        .limit(1);

      if (!event) {
        return { message: 'Event not found' };
      }

      // Send reminder email
      const portalUrl = `${process.env.FRONTEND_URL}/portal/speakers/${speaker.accessToken}`;
      const speakerName = speaker.firstName
        ? `${speaker.firstName} ${speaker.lastName || ''}`
        : speaker.email;

      await this.emailsService.sendReminder(
        speaker.email,
        speakerName,
        event.name,
        event.deadline,
        portalUrl,
      );

      // Update speaker reminder count
      await this.db
        .update(schema.speakers)
        .set({
          lastReminderSentAt: new Date(),
          reminderCount: speaker.reminderCount + 1,
        })
        .where(eq(schema.speakers.id, speakerId));

      return { message: 'Reminder sent successfully' };
    } catch (error) {
      console.error('Error processing reminder job:', error);
      throw error;
    }
  }
}
