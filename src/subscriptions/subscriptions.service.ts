import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Assign a subscription plan to a user (manual assignment by admin)
   */
  async assignSubscription(assignDto: AssignSubscriptionDto) {
    const { userId, planId, startDate, endDate, amountPaid, notes } =
      assignDto;

    // Verify user exists
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify plan exists
    const [plan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundException(
        `Subscription plan with ID ${planId} not found`,
      );
    }

    // End any currently active subscriptions for this user
    await this.db
      .update(schema.subscriptionHistory)
      .set({
        endDate: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.subscriptionHistory.userId, userId),
          isNull(schema.subscriptionHistory.endDate),
        ),
      );

    // Create new subscription history entry
    const result = await this.db
      .insert(schema.subscriptionHistory)
      .values({
        userId,
        planId,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        amountPaid: amountPaid || 0,
        currency: 'USD',
        billingCycle: 'manual', // Since this is manual assignment
        status: 'active',
        notes: notes || null,
      })
      .returning();

    const newSubscription = result[0];

    // Update user's current subscription references
    await this.db
      .update(schema.users)
      .set({
        currentPlanId: planId,
        currentSubscriptionId: newSubscription.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    return {
      ...newSubscription,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
      },
    };
  }

  /**
   * Get user's current active subscription
   */
  async getCurrentSubscription(userId: number) {
    // Verify user exists
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get current subscription if exists
    if (!user.currentSubscriptionId) {
      return {
        message: 'User has no active subscription',
        subscription: null,
      };
    }

    const [subscription] = await this.db
      .select()
      .from(schema.subscriptionHistory)
      .where(eq(schema.subscriptionHistory.id, user.currentSubscriptionId))
      .limit(1);

    if (!subscription) {
      return {
        message: 'User has no active subscription',
        subscription: null,
      };
    }

    // Get plan details
    const [plan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, subscription.planId))
      .limit(1);

    return {
      ...subscription,
      plan: plan
        ? {
            ...plan,
            features: plan.features ? JSON.parse(plan.features) : null,
          }
        : null,
    };
  }

  /**
   * Get subscription history for a user
   */
  async getSubscriptionHistory(userId: number) {
    // Verify user exists
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get all subscription history entries
    const subscriptions = await this.db
      .select()
      .from(schema.subscriptionHistory)
      .where(eq(schema.subscriptionHistory.userId, userId))
      .orderBy(desc(schema.subscriptionHistory.createdAt));

    // Fetch plan details for each subscription
    const subscriptionsWithPlans = await Promise.all(
      subscriptions.map(async (sub) => {
        const [plan] = await this.db
          .select()
          .from(schema.subscriptionPlans)
          .where(eq(schema.subscriptionPlans.id, sub.planId))
          .limit(1);

        return {
          ...sub,
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                displayName: plan.displayName,
                priceMonthly: plan.priceMonthly,
              }
            : null,
        };
      }),
    );

    return subscriptionsWithPlans;
  }

  /**
   * Cancel a user's active subscription
   */
  async cancelSubscription(userId: number) {
    // Verify user exists
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.currentSubscriptionId) {
      throw new BadRequestException('User has no active subscription to cancel');
    }

    // End the current subscription
    const [canceledSubscription] = await this.db
      .update(schema.subscriptionHistory)
      .set({
        endDate: new Date(),
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptionHistory.id, user.currentSubscriptionId))
      .returning();

    // Clear user's current subscription references
    await this.db
      .update(schema.users)
      .set({
        currentPlanId: null,
        currentSubscriptionId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    return {
      message: 'Subscription canceled successfully',
      subscription: canceledSubscription,
    };
  }
}
