import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, SQL } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { TriggerReminderDto } from './dto/trigger-reminder.dto';
import { EmailsService } from '../emails/emails.service';

@Injectable()
export class RemindersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private emailsService: EmailsService,
  ) {}

  /**
   * Get reminder history for a specific event
   */
  async getEventReminders(userId: number, eventId: number) {
    // Verify event ownership
    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.userId !== userId) {
      throw new ForbiddenException('You do not have access to this event');
    }

    // Get all reminders for this event
    const reminders = await this.db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.eventId, eventId))
      .orderBy(desc(schema.reminders.createdAt));

    // Get speaker details for each reminder
    const remindersWithSpeakers = await Promise.all(
      reminders.map(async (reminder) => {
        const [speaker] = await this.db
          .select()
          .from(schema.speakers)
          .where(eq(schema.speakers.id, reminder.speakerId))
          .limit(1);

        return {
          ...reminder,
          speaker: speaker
            ? {
                id: speaker.id,
                email: speaker.email,
                firstName: speaker.firstName,
                lastName: speaker.lastName,
              }
            : null,
        };
      }),
    );

    return remindersWithSpeakers;
  }

  /**
   * Get reminder history for a specific speaker
   */
  async getSpeakerReminders(userId: number, speakerId: number) {
    // Verify speaker ownership through event
    const [speaker] = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.id, speakerId))
      .limit(1);

    if (!speaker) {
      throw new NotFoundException('Speaker not found');
    }

    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, speaker.eventId))
      .limit(1);

    if (!event || event.userId !== userId) {
      throw new ForbiddenException('You do not have access to this speaker');
    }

    // Get all reminders for this speaker
    const reminders = await this.db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.speakerId, speakerId))
      .orderBy(desc(schema.reminders.createdAt));

    return reminders;
  }

  /**
   * Get all failed reminders for user's events
   */
  async getFailedReminders(userId: number) {
    // Get all events for this user
    const events = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.userId, userId));

    const eventIds = events.map((e) => e.id);

    if (eventIds.length === 0) {
      return [];
    }

    // Get all failed reminders for these events
    const conditions: SQL[] = [eq(schema.reminders.status, 'failed')];

    const failedReminders = await this.db
      .select()
      .from(schema.reminders)
      .where(and(...conditions))
      .orderBy(desc(schema.reminders.createdAt));

    // Filter by eventIds (since drizzle doesn't have a clean 'in' operator for this case)
    const filteredReminders = failedReminders.filter((r) =>
      eventIds.includes(r.eventId),
    );

    // Get speaker and event details
    const remindersWithDetails = await Promise.all(
      filteredReminders.map(async (reminder) => {
        const [speaker] = await this.db
          .select()
          .from(schema.speakers)
          .where(eq(schema.speakers.id, reminder.speakerId))
          .limit(1);

        const [event] = await this.db
          .select()
          .from(schema.events)
          .where(eq(schema.events.id, reminder.eventId))
          .limit(1);

        return {
          ...reminder,
          speaker: speaker
            ? {
                id: speaker.id,
                email: speaker.email,
                firstName: speaker.firstName,
                lastName: speaker.lastName,
              }
            : null,
          event: event
            ? {
                id: event.id,
                name: event.name,
                slug: event.slug,
              }
            : null,
        };
      }),
    );

    return remindersWithDetails;
  }

  /**
   * Manually trigger a reminder for a speaker
   */
  async triggerReminder(userId: number, triggerDto: TriggerReminderDto) {
    const { speakerId, emailSubject, emailBody } = triggerDto;

    // Verify speaker ownership through event
    const [speaker] = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.id, speakerId))
      .limit(1);

    if (!speaker) {
      throw new NotFoundException('Speaker not found');
    }

    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, speaker.eventId))
      .limit(1);

    if (!event || event.userId !== userId) {
      throw new ForbiddenException('You do not have access to this speaker');
    }

    // Generate portal URL for the speaker
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const portalUrl = `${frontendUrl}/portal/speakers/${speaker.accessToken}`;

    // Create a reminder record
    const result = await this.db
      .insert(schema.reminders)
      .values({
        speakerId,
        eventId: speaker.eventId,
        status: 'pending',
        scheduledFor: new Date(), // Schedule immediately
        emailSubject:
          emailSubject || `Reminder: Submit your assets for ${event.name}`,
        emailBody:
          emailBody ||
          `Hi ${speaker.firstName || 'there'},\n\nThis is a reminder to submit your assets for the event "${event.name}".\n\nDeadline: ${event.deadline.toLocaleDateString()}\n\nAccess your submission portal here:\n${portalUrl}\n\nDon't miss the deadline!\n\nBest regards,\nThe StageAsset Team`,
      })
      .returning();

    const reminder = result[0];

    try {
      // Actually send the email
      const speakerName = speaker.firstName
        ? `${speaker.firstName} ${speaker.lastName || ''}`.trim()
        : 'there';

      await this.emailsService.sendReminder(
        speaker.email,
        speakerName,
        event.name,
        event.deadline,
        portalUrl,
      );

      // Mark reminder as sent
      const updateResult = await this.db
        .update(schema.reminders)
        .set({
          status: 'sent',
          sentAt: new Date(),
        })
        .where(eq(schema.reminders.id, reminder.id))
        .returning();

      const sentReminder = updateResult[0];

      // Update speaker's reminder count and last sent timestamp
      await this.db
        .update(schema.speakers)
        .set({
          reminderCount: speaker.reminderCount + 1,
          lastReminderSentAt: new Date(),
        })
        .where(eq(schema.speakers.id, speakerId));

      return {
        message: 'Reminder sent successfully',
        reminder: sentReminder,
      };
    } catch (emailError) {
      // Mark reminder as failed if email sending fails
      await this.db
        .update(schema.reminders)
        .set({
          status: 'failed',
          errorMessage: emailError.message || 'Failed to send email',
        })
        .where(eq(schema.reminders.id, reminder.id));

      throw new BadRequestException('Failed to send reminder email: ' + emailError.message);
    }
  }

  /**
   * Retry a failed reminder
   */
  async retryFailedReminder(userId: number, reminderId: number) {
    // Get the reminder
    const [reminder] = await this.db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.id, reminderId))
      .limit(1);

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    // Verify ownership through event
    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, reminder.eventId))
      .limit(1);

    if (!event || event.userId !== userId) {
      throw new ForbiddenException('You do not have access to this reminder');
    }

    if (reminder.status !== 'failed') {
      throw new BadRequestException('Can only retry failed reminders');
    }

    // Update reminder status to pending and reschedule
    const result = await this.db
      .update(schema.reminders)
      .set({
        status: 'sent',
        sentAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.reminders.id, reminderId))
      .returning();

    const updatedReminder = result[0];

    return {
      message: 'Reminder retried successfully',
      reminder: updatedReminder,
    };
  }
}
