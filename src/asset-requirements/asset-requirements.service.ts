import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { CreateAssetRequirementDto } from './dto/create-asset-requirement.dto';
import { UpdateAssetRequirementDto } from './dto/update-asset-requirement.dto';

@Injectable()
export class AssetRequirementsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(
    userId: number,
    eventId: number,
    createDto: CreateAssetRequirementDto,
  ) {
    // Verify user owns the event
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

    // Convert acceptedFileTypes array to JSON string for storage
    const dataToInsert: any = {
      ...createDto,
      eventId,
      acceptedFileTypes: createDto.acceptedFileTypes
        ? JSON.stringify(createDto.acceptedFileTypes)
        : null,
    };

    const [assetRequirement] = await this.db
      .insert(schema.assetRequirements)
      .values(dataToInsert)
      .returning();

    return this.formatAssetRequirement(assetRequirement);
  }

  async findAllByEvent(userId: number, eventId: number) {
    // Verify user owns the event
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

    const requirements = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.eventId, eventId))
      .orderBy(asc(schema.assetRequirements.sortOrder));

    return requirements.map((req) => this.formatAssetRequirement(req));
  }

  // Public endpoint for speakers to see requirements
  async findAllByEventPublic(eventId: number) {
    const requirements = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.eventId, eventId))
      .orderBy(asc(schema.assetRequirements.sortOrder));

    return requirements.map((req) => this.formatAssetRequirement(req));
  }

  async findOne(userId: number, requirementId: number) {
    const [requirement] = await this.db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.id, requirementId))
      .limit(1);

    if (!requirement) {
      throw new NotFoundException('Asset requirement not found');
    }

    // Verify ownership via event
    const [event] = await this.db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, requirement.eventId))
      .limit(1);

    if (!event || event.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this asset requirement',
      );
    }

    return this.formatAssetRequirement(requirement);
  }

  async update(
    userId: number,
    requirementId: number,
    updateDto: UpdateAssetRequirementDto,
  ) {
    // Verify ownership
    await this.findOne(userId, requirementId);

    const updateData: any = { ...updateDto };

    // Convert acceptedFileTypes array to JSON string if provided
    if (updateDto.acceptedFileTypes) {
      updateData.acceptedFileTypes = JSON.stringify(updateDto.acceptedFileTypes);
    }

    const [updated] = await this.db
      .update(schema.assetRequirements)
      .set(updateData)
      .where(eq(schema.assetRequirements.id, requirementId))
      .returning();

    return this.formatAssetRequirement(updated);
  }

  async delete(userId: number, requirementId: number) {
    // Verify ownership
    await this.findOne(userId, requirementId);

    await this.db
      .delete(schema.assetRequirements)
      .where(eq(schema.assetRequirements.id, requirementId));

    return { message: 'Asset requirement deleted successfully' };
  }

  // Helper method to parse JSON string back to array
  private formatAssetRequirement(requirement: any) {
    return {
      ...requirement,
      acceptedFileTypes: requirement.acceptedFileTypes
        ? JSON.parse(requirement.acceptedFileTypes)
        : null,
    };
  }
}
