import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { InviteSpeakerDto } from './dto/invite-speaker.dto';
import { UpdateSpeakerDto } from './dto/update-speaker.dto';
import { generateAccessToken } from './utils/token.util';

@Injectable()
export class SpeakersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async inviteSpeaker(
    userId: number,
    eventId: number,
    inviteSpeakerDto: InviteSpeakerDto,
  ) {
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

    // Check if speaker already exists for this event
    const existingSpeaker = await this.db
      .select()
      .from(schema.speakers)
      .where(
        and(
          eq(schema.speakers.eventId, eventId),
          eq(schema.speakers.email, inviteSpeakerDto.email),
        ),
      )
      .limit(1);

    if (existingSpeaker.length > 0) {
      throw new ConflictException(
        'Speaker with this email already invited to this event',
      );
    }

    // Generate unique access token
    const accessToken = generateAccessToken();

    // Create speaker
    const [speaker] = await this.db
      .insert(schema.speakers)
      .values({
        eventId,
        ...inviteSpeakerDto,
        accessToken,
        submissionStatus: 'pending',
        reminderCount: 0,
      })
      .returning();

    return speaker;
  }

  async findAllByEvent(userId: number, eventId: number) {
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

    // Get all speakers for the event
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    return speakers;
  }

  async findOne(userId: number, speakerId: number) {
    const [speaker] = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.id, speakerId))
      .limit(1);

    if (!speaker) {
      throw new NotFoundException('Speaker not found');
    }

    // Verify event ownership
    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, speaker.eventId))
      .limit(1);

    if (!event || event.userId !== userId) {
      throw new ForbiddenException('You do not have access to this speaker');
    }

    return speaker;
  }

  async findByAccessToken(accessToken: string) {
    const [speaker] = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.accessToken, accessToken))
      .limit(1);

    if (!speaker) {
      throw new NotFoundException('Invalid access token');
    }

    return speaker;
  }

  async update(
    userId: number,
    speakerId: number,
    updateSpeakerDto: UpdateSpeakerDto,
  ) {
    // Verify ownership
    await this.findOne(userId, speakerId);

    const [updatedSpeaker] = await this.db
      .update(schema.speakers)
      .set({
        ...updateSpeakerDto,
        updatedAt: new Date(),
      })
      .where(eq(schema.speakers.id, speakerId))
      .returning();

    return updatedSpeaker;
  }

  async updateByToken(accessToken: string, updateSpeakerDto: UpdateSpeakerDto) {
    const speaker = await this.findByAccessToken(accessToken);

    const [updatedSpeaker] = await this.db
      .update(schema.speakers)
      .set({
        ...updateSpeakerDto,
        updatedAt: new Date(),
      })
      .where(eq(schema.speakers.id, speaker.id))
      .returning();

    return updatedSpeaker;
  }

  async updateSubmissionStatus(
    speakerId: number,
    status: 'pending' | 'partial' | 'complete',
  ) {
    const updateData: any = {
      submissionStatus: status,
      updatedAt: new Date(),
    };

    if (status === 'complete') {
      updateData.submittedAt = new Date();
    }

    const [updatedSpeaker] = await this.db
      .update(schema.speakers)
      .set(updateData)
      .where(eq(schema.speakers.id, speakerId))
      .returning();

    return updatedSpeaker;
  }

  async delete(userId: number, speakerId: number) {
    // Verify ownership
    await this.findOne(userId, speakerId);

    await this.db.delete(schema.speakers).where(eq(schema.speakers.id, speakerId));

    return { message: 'Speaker deleted successfully' };
  }

  async resendInvitation(userId: number, speakerId: number) {
    const speaker = await this.findOne(userId, speakerId);

    // This would typically trigger an email to be sent
    // For now, we'll just return the speaker data
    // The email sending will be implemented in the EmailsModule

    return {
      message: 'Invitation resent successfully',
      speaker,
    };
  }
}
