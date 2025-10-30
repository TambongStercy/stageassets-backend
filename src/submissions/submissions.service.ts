import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
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
    // Get the asset requirement to validate against
    const [assetRequirement] = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.id, createSubmissionDto.assetRequirementId))
      .limit(1);

    if (!assetRequirement) {
      throw new NotFoundException('Asset requirement not found');
    }

    // Validate the submission against requirements
    await this.validateSubmission(createSubmissionDto, assetRequirement);

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

    // Update speaker's submission status
    await this.updateSpeakerSubmissionStatus(speakerId);

    return submission;
  }

  /**
   * Validate submission against asset requirements
   */
  private async validateSubmission(
    submission: CreateSubmissionDto,
    requirement: any,
  ) {
    const errors: string[] = [];

    // Validate file size
    if (requirement.maxFileSizeMb) {
      const maxSizeBytes = requirement.maxFileSizeMb * 1024 * 1024;
      if (submission.fileSize > maxSizeBytes) {
        errors.push(
          `File size exceeds maximum allowed size of ${requirement.maxFileSizeMb}MB`,
        );
      }
    }

    // Validate file type
    if (requirement.acceptedFileTypes) {
      const acceptedTypes = JSON.parse(requirement.acceptedFileTypes);
      const fileExtension = '.' + submission.fileName.split('.').pop()?.toLowerCase();

      if (!acceptedTypes.includes(fileExtension)) {
        errors.push(
          `File type not accepted. Allowed types: ${acceptedTypes.join(', ')}`,
        );
      }
    }

    // Validate image dimensions (if applicable)
    if (submission.imageWidth && submission.imageHeight) {
      if (requirement.minImageWidth && submission.imageWidth < requirement.minImageWidth) {
        errors.push(
          `Image width (${submission.imageWidth}px) is below minimum required width of ${requirement.minImageWidth}px`,
        );
      }

      if (requirement.minImageHeight && submission.imageHeight < requirement.minImageHeight) {
        errors.push(
          `Image height (${submission.imageHeight}px) is below minimum required height of ${requirement.minImageHeight}px`,
        );
      }
    } else if (requirement.minImageWidth || requirement.minImageHeight) {
      // Image dimensions are required but not provided
      if (submission.mimeType.startsWith('image/')) {
        errors.push(
          `Image dimensions are required. Minimum dimensions: ${requirement.minImageWidth || 0}x${requirement.minImageHeight || 0}px`,
        );
      }
    }

    // If there are validation errors, throw exception
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }
  }

  /**
   * Update speaker's submission status based on their submissions
   */
  private async updateSpeakerSubmissionStatus(speakerId: number) {
    // Get the speaker
    const [speaker] = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.id, speakerId))
      .limit(1);

    if (!speaker) {
      return;
    }

    // Get all asset requirements for the event
    const assetRequirements = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.eventId, speaker.eventId));

    // Get all required asset requirements
    const requiredAssets = assetRequirements.filter((ar) => ar.isRequired);

    // Get speaker's latest submissions
    const submissions = await this.db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.speakerId, speakerId),
          eq(schema.submissions.isLatest, true),
        ),
      );

    // Calculate submission status
    let newStatus: 'pending' | 'partial' | 'complete';

    if (submissions.length === 0) {
      newStatus = 'pending';
    } else if (requiredAssets.length === 0) {
      // If no required assets, any submission means complete
      newStatus = 'complete';
    } else {
      // Check if all required assets are submitted
      const submittedRequirementIds = submissions.map(
        (s) => s.assetRequirementId,
      );
      const requiredAssetIds = requiredAssets.map((ra) => ra.id);

      const allRequiredSubmitted = requiredAssetIds.every((id) =>
        submittedRequirementIds.includes(id),
      );

      if (allRequiredSubmitted) {
        newStatus = 'complete';
      } else {
        newStatus = 'partial';
      }
    }

    // Update speaker's submission status
    await this.db
      .update(schema.speakers)
      .set({
        submissionStatus: newStatus,
        submittedAt: newStatus === 'complete' ? new Date() : speaker.submittedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.speakers.id, speakerId));
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
    // Get the submission to find the speaker
    const [submission] = await this.db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const speakerId = submission.speakerId;

    // Delete the submission
    await this.db
      .delete(schema.submissions)
      .where(eq(schema.submissions.id, submissionId));

    // Update speaker's submission status
    await this.updateSpeakerSubmissionStatus(speakerId);

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

