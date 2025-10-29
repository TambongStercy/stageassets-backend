import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(speakerId: number, createSubmissionDto: CreateSubmissionDto) {
    // Get the latest previous submission for this speaker and asset
    const [latestPrevious] = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.speakerId, speakerId),
          eq(schema.submissions.assetRequirementId, createSubmissionDto.assetRequirementId),
          eq(schema.submissions.isLatest, true),
        ),
      )
      .limit(1);

    // Mark previous submissions as not latest
    await this.db
      .update(schema.submissions)
      .set({ isLatest: false })
      .where(
        and(
          eq(schema.submissions.speakerId, speakerId),
          eq(schema.submissions.assetRequirementId, createSubmissionDto.assetRequirementId),
        ),
      );

    // Get all previous submissions to calculate version
    const previousSubmissions = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.speakerId, speakerId),
          eq(schema.submissions.assetRequirementId, createSubmissionDto.assetRequirementId),
        ),
      );

    const version = previousSubmissions.length + 1;

    // Create new submission with reference to previous version
    const result = await this.db
      .insert(schema.submissions)
      .values({
        speakerId,
        ...createSubmissionDto,
        version,
        replacesSubmissionId: latestPrevious ? latestPrevious.id : null,
        isLatest: true,
        storageProvider: 'local',
      })
      .returning();

    const submission = result[0];

    return submission;
  }

  async findBySpeaker(speakerId: number) {
    return this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.speakerId, speakerId),
          eq(schema.submissions.isLatest, true),
        ),
      );
  }

  async findByEvent(eventId: number) {
    // Get all speakers for the event
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    const speakerIds = speakers.map(s => s.id);

    if (speakerIds.length === 0) {
      return [];
    }

    // Get all latest submissions for these speakers
    const submissions: any[] = [];
    for (const speakerId of speakerIds) {
      const speakerSubmissions = await this.findBySpeaker(speakerId);
      submissions.push(...speakerSubmissions);
    }

    return submissions;
  }

  async findOne(submissionId: number) {
    const [submission] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  async delete(submissionId: number) {
    await this.db
      .delete(schema.submissions)
      .where(eq(schema.submissions.id, submissionId));

    return { message: 'Submission deleted successfully' };
  }

  /**
   * Get version history for a specific asset requirement and speaker
   */
  async getVersionHistory(speakerId: number, assetRequirementId: number) {
    const versions = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.speakerId, speakerId),
          eq(schema.submissions.assetRequirementId, assetRequirementId),
        ),
      )
      .orderBy(schema.submissions.version);

    return versions;
  }

  /**
   * Get a specific version of a submission
   */
  async getVersion(submissionId: number) {
    const [submission] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission version not found');
    }

    return submission;
  }
}

