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

      // Generate portal URL and email content
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const portalUrl = `${frontendUrl}/portal/speakers/${speaker.accessToken}`;
      const speakerName = speaker.firstName
        ? `${speaker.firstName} ${speaker.lastName || ''}`
        : speaker.email;

      const emailSubject = `Reminder: Submit your assets for ${event.name}`;
      const emailBodyText = `Hi ${speakerName},\n\nThis is a friendly reminder to submit your speaker assets for ${event.name}.\n\nDeadline: ${event.deadline.toLocaleDateString()}\n\nAccess your submission portal here:\n${portalUrl}\n\nDon't miss the deadline!\n\nBest regards,\nThe StageAsset Team`;

      // Create reminder record in database
      const [reminderRecord] = await this.db
        .insert(schema.reminders)
        .values({
          speakerId,
          eventId,
          status: 'pending',
          scheduledFor: new Date(),
          emailSubject,
          emailBody: emailBodyText,
        })
        .returning();

      try {
        // Send reminder email
        await this.emailsService.sendReminder(
          speaker.email,
          speakerName,
          event.name,
          event.deadline,
          portalUrl,
        );

        // Mark reminder as sent
        await this.db
          .update(schema.reminders)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(schema.reminders.id, reminderRecord.id));

        // Update speaker reminder count
        await this.db
          .update(schema.speakers)
          .set({
            lastReminderSentAt: new Date(),
            reminderCount: speaker.reminderCount + 1,
          })
          .where(eq(schema.speakers.id, speakerId));

        return { message: 'Reminder sent successfully' };
      } catch (emailError) {
        // Mark reminder as failed if email sending fails
        await this.db
          .update(schema.reminders)
          .set({
            status: 'failed',
            errorMessage: emailError.message || 'Failed to send email',
          })
          .where(eq(schema.reminders.id, reminderRecord.id));

        throw emailError;
      }
    } catch (error) {
      console.error('Error processing reminder job:', error);
      throw error;
    }
  }
}
