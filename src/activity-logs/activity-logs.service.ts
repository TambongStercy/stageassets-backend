import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, lte, sql, SQL } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@Injectable()
export class ActivityLogsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create an activity log entry
   */
  async create(createDto: CreateActivityLogDto) {
    const dataToInsert: any = {
      ...createDto,
      metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : null,
    };

    const [log] = await this.db
      .insert(schema.activityLogs)
      .values(dataToInsert)
      .returning();

    return this.formatLog(log);
  }

  /**
   * Get all activity logs with optional filters
   */
  async findAll(filters?: {
    userId?: number;
    eventId?: number;
    speakerId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const {
      userId,
      eventId,
      speakerId,
      action,
      startDate,
      endDate,
      limit = 100,
    } = filters || {};

    const conditions: SQL[] = [];

    if (userId) {
      conditions.push(eq(schema.activityLogs.userId, userId));
    }

    if (eventId) {
      conditions.push(eq(schema.activityLogs.eventId, eventId));
    }

    if (speakerId) {
      conditions.push(eq(schema.activityLogs.speakerId, speakerId));
    }

    if (action) {
      conditions.push(eq(schema.activityLogs.action, action));
    }

    if (startDate) {
      conditions.push(gte(schema.activityLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(schema.activityLogs.createdAt, new Date(endDate)));
    }

    const logs = await this.db
      .select()
      .from(schema.activityLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);

    return logs.map((log) => this.formatLog(log));
  }

  /**
   * Get activity logs for a specific event
   */
  async findByEvent(eventId: number, limit: number = 50) {
    const logs = await this.db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.eventId, eventId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);

    return logs.map((log) => this.formatLog(log));
  }

  /**
   * Get activity logs for a specific user
   */
  async findByUser(userId: number, limit: number = 50) {
    const logs = await this.db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.userId, userId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);

    return logs.map((log) => this.formatLog(log));
  }

  /**
   * Get activity logs for a specific speaker
   */
  async findBySpeaker(speakerId: number, limit: number = 50) {
    const logs = await this.db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.speakerId, speakerId))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);

    return logs.map((log) => this.formatLog(log));
  }

  /**
   * Helper to parse JSON metadata back to object
   */
  private formatLog(log: any) {
    return {
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    };
  }
}
