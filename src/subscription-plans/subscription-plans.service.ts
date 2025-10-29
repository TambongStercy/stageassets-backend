import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createDto: CreateSubscriptionPlanDto) {
    // Check if plan name already exists
    const [existingPlan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.name, createDto.name))
      .limit(1);

    if (existingPlan) {
      throw new ConflictException(
        `Plan with name "${createDto.name}" already exists`,
      );
    }

    // Convert features array to JSON string for storage
    const dataToInsert: any = {
      ...createDto,
      features: createDto.features ? JSON.stringify(createDto.features) : null,
    };

    const [plan] = await this.db
      .insert(schema.subscriptionPlans)
      .values(dataToInsert)
      .returning();

    return this.formatPlan(plan);
  }

  async findAll() {
    const plans = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .orderBy(schema.subscriptionPlans.priceMonthly);

    return plans.map((plan) => this.formatPlan(plan));
  }

  async findAllActive() {
    const plans = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.isActive, true))
      .orderBy(schema.subscriptionPlans.priceMonthly);

    return plans.map((plan) => this.formatPlan(plan));
  }

  async findOne(id: number) {
    const [plan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, id))
      .limit(1);

    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    return this.formatPlan(plan);
  }

  async update(id: number, updateDto: UpdateSubscriptionPlanDto) {
    // Check if plan exists
    const [existingPlan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, id))
      .limit(1);

    if (!existingPlan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    // If updating name, check for conflicts
    if (updateDto.name && updateDto.name !== existingPlan.name) {
      const [nameConflict] = await this.db
        .select()
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.name, updateDto.name))
        .limit(1);

      if (nameConflict) {
        throw new ConflictException(
          `Plan with name "${updateDto.name}" already exists`,
        );
      }
    }

    // Convert features array to JSON string if provided
    const dataToUpdate: any = {
      ...updateDto,
      features: updateDto.features
        ? JSON.stringify(updateDto.features)
        : undefined,
      updatedAt: new Date(),
    };

    const [updatedPlan] = await this.db
      .update(schema.subscriptionPlans)
      .set(dataToUpdate)
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();

    return this.formatPlan(updatedPlan);
  }

  async remove(id: number) {
    // Check if plan exists
    const [existingPlan] = await this.db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.id, id))
      .limit(1);

    if (!existingPlan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }

    // Don't actually delete, just mark as inactive
    // This preserves historical data and subscription history
    const [deactivatedPlan] = await this.db
      .update(schema.subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();

    return {
      message: `Subscription plan "${existingPlan.displayName}" has been deactivated`,
      plan: this.formatPlan(deactivatedPlan),
    };
  }

  /**
   * Helper to parse JSON features back to array
   */
  private formatPlan(plan: any) {
    return {
      ...plan,
      features: plan.features ? JSON.parse(plan.features) : null,
    };
  }
}
