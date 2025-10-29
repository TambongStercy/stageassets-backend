import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, like } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { generateSlug, generateUniqueSlug } from './utils/slug.util';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private assetsService: AssetsService,
  ) {}

  async create(
    userId: number,
    createEventDto: CreateEventDto,
    logo?: Express.Multer.File,
  ) {
    const { name, deadline, eventDate, logoUrl, ...rest } = createEventDto;

    // Handle logo upload
    let uploadedLogoUrl = logoUrl; // Use provided URL if no file uploaded
    if (logo) {
      const { fileUrl } = await this.assetsService.saveFile(logo, 'event-logos');
      uploadedLogoUrl = fileUrl;
    }

    // Generate unique slug
    const baseSlug = generateSlug(name);
    const existingSlugs = await this.db
      .select({ slug: schema.events.slug })
      .from(schema.events)
      .where(like(schema.events.slug, `${baseSlug}%`));

    const slug = generateUniqueSlug(
      baseSlug,
      existingSlugs.map((e) => e.slug),
    );

    // Create event
    const [event] = await this.db
      .insert(schema.events)
      .values({
        userId,
        name,
        slug,
        deadline: new Date(deadline),
        eventDate: eventDate ? new Date(eventDate) : null,
        logoUrl: uploadedLogoUrl,
        ...rest,
      })
      .returning();

    return event;
  }

  async findAll(userId: number, includeArchived = false) {
    const conditions = includeArchived
      ? [eq(schema.events.userId, userId)]
      : [eq(schema.events.userId, userId), eq(schema.events.isArchived, false)];

    const events = await this.db
      .select()
      .from(schema.events)
      .where(and(...conditions))
      .orderBy(desc(schema.events.createdAt));

    return events;
  }

  async findOne(userId: number, eventId: number) {
    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check ownership
    if (event.userId !== userId) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }

  async findBySlug(slug: string) {
    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.slug, slug))
      .limit(1);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async update(
    userId: number,
    eventId: number,
    updateEventDto: UpdateEventDto,
    logo?: Express.Multer.File,
  ) {
    // Verify ownership
    await this.findOne(userId, eventId);

    const updateData: any = { ...updateEventDto };

    // Handle logo upload
    if (logo) {
      const { fileUrl } = await this.assetsService.saveFile(logo, 'event-logos');
      updateData.logoUrl = fileUrl;
    }

    // Convert date strings to Date objects
    if (updateEventDto.deadline) {
      updateData.deadline = new Date(updateEventDto.deadline);
    }
    if (updateEventDto.eventDate) {
      updateData.eventDate = new Date(updateEventDto.eventDate);
    }
    if (updateEventDto.archivedAt) {
      updateData.archivedAt = new Date(updateEventDto.archivedAt);
    }

    updateData.updatedAt = new Date();

    const [updatedEvent] = await this.db
      .update(schema.events)
      .set(updateData)
      .where(eq(schema.events.id, eventId))
      .returning();

    return updatedEvent;
  }

  async archive(userId: number, eventId: number) {
    // Verify ownership
    await this.findOne(userId, eventId);

    const [archivedEvent] = await this.db
      .update(schema.events)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();

    return archivedEvent;
  }

  async delete(userId: number, eventId: number) {
    // Verify ownership
    await this.findOne(userId, eventId);

    await this.db.delete(schema.events).where(eq(schema.events.id, eventId));

    return { message: 'Event deleted successfully' };
  }

  async getEventStats(userId: number, eventId: number) {
    // Verify ownership
    await this.findOne(userId, eventId);

    // Get total speakers
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    const totalSpeakers = speakers.length;
    const completedSpeakers = speakers.filter(
      (s) => s.submissionStatus === 'complete',
    ).length;
    const partialSpeakers = speakers.filter(
      (s) => s.submissionStatus === 'partial',
    ).length;
    const pendingSpeakers = speakers.filter(
      (s) => s.submissionStatus === 'pending',
    ).length;

    return {
      totalSpeakers,
      completedSpeakers,
      partialSpeakers,
      pendingSpeakers,
      completionRate:
        totalSpeakers > 0
          ? Math.round((completedSpeakers / totalSpeakers) * 100)
          : 0,
    };
  }
}
