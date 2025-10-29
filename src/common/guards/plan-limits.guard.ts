import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { DATABASE_CONNECTION } from '../../db/database.providers';
import {
  CHECK_PLAN_LIMIT_KEY,
  PlanLimitType,
} from '../decorators/check-plan-limits.decorator';

@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if plan limits are enabled in environment
    const planLimitsEnabled = process.env.ENABLE_PLAN_LIMITS === 'true';

    if (!planLimitsEnabled) {
      // Plan limits disabled - allow all operations
      return true;
    }

    const limitType = this.reflector.getAllAndOverride<PlanLimitType>(
      CHECK_PLAN_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!limitType) {
      // No limit check required
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new BadRequestException('User not authenticated');
    }

    const userId = user.id;

    // Get user's current subscription plan
    const [userRecord] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!userRecord) {
      throw new BadRequestException('User not found');
    }

    // If user has no subscription plan, deny access
    if (!userRecord.currentPlanId) {
      throw new ForbiddenException(
        'You need an active subscription plan to perform this action. Please subscribe to a plan.',
      );
    }

    // Get the subscription plan details
    const [plan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, userRecord.currentPlanId))
      .limit(1);

    if (!plan) {
      throw new ForbiddenException(
        'Your subscription plan could not be found. Please contact support.',
      );
    }

    // Check limits based on limit type
    if (limitType === 'event_creation') {
      return this.checkEventCreationLimit(userId, plan);
    } else if (limitType === 'speaker_invitation') {
      return this.checkSpeakerInvitationLimit(request, plan);
    }

    return true;
  }

  /**
   * Check if user has reached their maximum active events limit
   */
  private async checkEventCreationLimit(
    userId: number,
    plan: any,
  ): Promise<boolean> {
    // Count active (non-archived) events for this user
    const activeEvents = await this.db
      .select()
      .from(schema.events)
      .where(
        and(eq(schema.events.userId, userId), eq(schema.events.isArchived, false)),
      );

    const activeEventCount = activeEvents.length;

    if (activeEventCount >= plan.maxActiveEvents) {
      throw new ForbiddenException(
        `You have reached your plan's limit of ${plan.maxActiveEvents} active event(s). ` +
          `Please archive existing events or upgrade your plan.`,
      );
    }

    return true;
  }

  /**
   * Check if event has reached maximum speakers per event limit
   */
  private async checkSpeakerInvitationLimit(
    request: any,
    plan: any,
  ): Promise<boolean> {
    // Get eventId from request params
    const eventId = parseInt(request.params.eventId);

    if (!eventId || isNaN(eventId)) {
      throw new BadRequestException('Invalid event ID');
    }

    // Count speakers for this event
    const speakers = await this.db
      .select()
      .from(schema.speakers)
      .where(eq(schema.speakers.eventId, eventId));

    const speakerCount = speakers.length;

    if (speakerCount >= plan.maxSpeakersPerEvent) {
      throw new ForbiddenException(
        `This event has reached the maximum of ${plan.maxSpeakersPerEvent} speaker(s) allowed by your plan. ` +
          `Please upgrade your plan to invite more speakers.`,
      );
    }

    return true;
  }
}
