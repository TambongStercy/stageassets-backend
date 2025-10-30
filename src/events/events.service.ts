import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, like } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { generateSlug, generateUniqueSlug } from './utils/slug.util';
import { AssetsService } from '../assets/assets.service';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

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

    // Get asset requirements for this event
    const assetRequirements = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.eventId, eventId));

    const totalAssetTypes = assetRequirements.length;
    const requiredAssetTypes = assetRequirements.filter((ar) => ar.isRequired).length;
    const optionalAssetTypes = totalAssetTypes - requiredAssetTypes;

    // Get all speakers for this event
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    const totalSpeakers = speakers.length;

    // Calculate expected vs received assets
    const totalExpectedAssets = totalSpeakers * totalAssetTypes;
    const totalRequiredAssets = totalSpeakers * requiredAssetTypes;
    const totalOptionalAssets = totalSpeakers * optionalAssetTypes;

    // Get all submissions for this event's speakers
    const speakerIds = speakers.map((s) => s.id);
    let totalReceivedAssets = 0;
    let totalRequiredAssetsReceived = 0;
    let totalOptionalAssetsReceived = 0;

    if (speakerIds.length > 0) {
      // Get submissions for all speakers
      const submissions: any[] = [];
      for (const speakerId of speakerIds) {
        const speakerSubmissions = await this.db
          .select()
          .from(schema.submissions)
          .where(eq(schema.submissions.speakerId, speakerId));
        submissions.push(...speakerSubmissions);
      }

      totalReceivedAssets = submissions.length;

      // Count required vs optional submissions
      const requiredAssetIds = assetRequirements
        .filter((ar) => ar.isRequired)
        .map((ar) => ar.id);

      for (const submission of submissions) {
        if (requiredAssetIds.includes(submission.assetRequirementId)) {
          totalRequiredAssetsReceived++;
        } else {
          totalOptionalAssetsReceived++;
        }
      }
    }

    // Speaker status counts
    const completedSpeakers = speakers.filter(
      (s) => s.submissionStatus === 'complete',
    ).length;
    const partialSpeakers = speakers.filter(
      (s) => s.submissionStatus === 'partial',
    ).length;
    const pendingSpeakers = speakers.filter(
      (s) => s.submissionStatus === 'pending',
    ).length;

    // Calculate percentages
    const overallProgress = totalExpectedAssets > 0
      ? Math.round((totalReceivedAssets / totalExpectedAssets) * 100)
      : 0;

    const requiredAssetsProgress = totalRequiredAssets > 0
      ? Math.round((totalRequiredAssetsReceived / totalRequiredAssets) * 100)
      : 0;

    const optionalAssetsProgress = totalOptionalAssets > 0
      ? Math.round((totalOptionalAssetsReceived / totalOptionalAssets) * 100)
      : 0;

    const speakerCompletionRate = totalSpeakers > 0
      ? Math.round((completedSpeakers / totalSpeakers) * 100)
      : 0;

    return {
      // Speaker stats
      speakers: {
        total: totalSpeakers,
        completed: completedSpeakers,
        partial: partialSpeakers,
        pending: pendingSpeakers,
        completionRate: speakerCompletionRate,
      },

      // Asset type stats
      assetTypes: {
        total: totalAssetTypes,
        required: requiredAssetTypes,
        optional: optionalAssetTypes,
      },

      // Overall asset progress
      assets: {
        expected: totalExpectedAssets,
        received: totalReceivedAssets,
        missing: totalExpectedAssets - totalReceivedAssets,
        progress: overallProgress,
      },

      // Required assets progress
      requiredAssets: {
        expected: totalRequiredAssets,
        received: totalRequiredAssetsReceived,
        missing: totalRequiredAssets - totalRequiredAssetsReceived,
        progress: requiredAssetsProgress,
      },

      // Optional assets progress
      optionalAssets: {
        expected: totalOptionalAssets,
        received: totalOptionalAssetsReceived,
        missing: totalOptionalAssets - totalOptionalAssetsReceived,
        progress: optionalAssetsProgress,
      },
    };
  }

  async getEventSubmissions(userId: number, eventId: number) {
    // Verify ownership
    await this.findOne(userId, eventId);

    // Get all speakers for this event
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    // Get all submissions for these speakers with asset requirement details
    const submissions: any[] = [];

    for (const speaker of speakers) {
      const speakerSubmissions = await this.db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.speakerId, speaker.id));

      // Get asset requirement details for each submission
      for (const submission of speakerSubmissions) {
        const [assetRequirement] = await this.db
          .select()
          .from(schema.assetRequirements)
          .where(eq(schema.assetRequirements.id, submission.assetRequirementId))
          .limit(1);

        submissions.push({
          id: submission.id,
          fileName: submission.fileName,
          fileUrl: submission.fileUrl,
          fileSize: submission.fileSize,
          mimeType: submission.mimeType,
          version: submission.version,
          createdAt: submission.createdAt,
          speaker: {
            id: speaker.id,
            firstName: speaker.firstName,
            lastName: speaker.lastName,
            email: speaker.email,
            submissionStatus: speaker.submissionStatus,
          },
          assetRequirement: {
            id: assetRequirement.id,
            label: assetRequirement.label,
            assetType: assetRequirement.assetType,
            isRequired: assetRequirement.isRequired,
          },
        });
      }
    }

    // Sort by creation date (newest first)
    submissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      total: submissions.length,
      submissions,
    };
  }

  async downloadAllAssets(userId: number, eventId: number): Promise<StreamableFile> {
    // Verify ownership
    const event = await this.findOne(userId, eventId);

    // Get all speakers for this event
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    if (speakers.length === 0) {
      throw new NotFoundException('No speakers found for this event');
    }

    // Get asset requirements to map requirement IDs to names
    const assetRequirements = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.eventId, eventId));

    const requirementMap = new Map(
      assetRequirements.map((ar) => [ar.id, ar.label]),
    );

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Create a passthrough stream
    const passThrough = new PassThrough();

    // Pipe archive to passthrough
    archive.pipe(passThrough);

    // Handle archive errors
    archive.on('error', (err) => {
      throw err;
    });

    // Process each speaker
    for (const speaker of speakers) {
      // Create folder name for speaker with capitalized first letters
      const firstName = this.capitalizeFirstLetter(speaker.firstName || '');
      const lastName = this.capitalizeFirstLetter(speaker.lastName || '');
      const speakerFolderName = `${firstName}_${lastName}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Get all submissions for this speaker
      const submissions = await this.db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.speakerId, speaker.id));

      if (submissions.length === 0) {
        // Create empty folder for speakers with no submissions
        archive.append('', { name: `${speakerFolderName}/.keep` });
        continue;
      }

      // Download and add each submission to the archive
      for (const submission of submissions) {
        const assetName = requirementMap.get(submission.assetRequirementId) || 'Unknown_Asset';
        const cleanAssetName = assetName.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Get file extension from original filename
        const fileExtension = submission.fileName.split('.').pop();
        const fileName = `${cleanAssetName}.${fileExtension}`;

        try {
          // Download file from URL or read from local path
          const fileBuffer = await this.getFileBuffer(submission.fileUrl, submission.storagePath);

          // Add to archive
          archive.append(fileBuffer, {
            name: `${speakerFolderName}/${fileName}`,
          });
        } catch (error) {
          console.error(`Failed to get file: ${submission.fileUrl}`, error);
          // Continue with other files even if one fails
        }
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Format event name: capitalize first letters and replace spaces with underscores
    const eventFileName = event.name
      .split(' ')
      .map(word => this.capitalizeFirstLetter(word))
      .join('_')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    console.log('Event name:', event.name);
    console.log('Formatted filename:', `${eventFileName}_Assets.zip`);

    // Return as StreamableFile
    return new StreamableFile(passThrough, {
      type: 'application/zip',
      disposition: `attachment; filename="${eventFileName}_Assets.zip"`,
    });
  }

  private capitalizeFirstLetter(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  private async getFileBuffer(fileUrl: string, storagePath: string): Promise<Buffer> {
    // Check if it's a URL (http/https) or a local path
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      // Download from URL
      return this.downloadFile(fileUrl);
    } else {
      // Read from local file system
      // storagePath contains the actual file path on disk
      return new Promise((resolve, reject) => {
        fs.readFile(storagePath, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    }
  }

  private async downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        response.on('error', (err) => {
          reject(err);
        });
      });
    });
  }
}
