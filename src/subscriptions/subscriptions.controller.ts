import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Admin endpoints for managing user subscriptions
 * TODO: Add admin role guard when role-based auth is implemented
 */
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Assign a subscription plan to a user (manual assignment)
   */
  @Post('assign')
  async assignSubscription(@Body() assignDto: AssignSubscriptionDto) {
    return this.subscriptionsService.assignSubscription(assignDto);
  }

  /**
   * Get user's current active subscription
   */
  @Get('users/:userId/current')
  async getCurrentSubscription(@Param('userId', ParseIntPipe) userId: number) {
    return this.subscriptionsService.getCurrentSubscription(userId);
  }

  /**
   * Get subscription history for a user
   */
  @Get('users/:userId/history')
  async getSubscriptionHistory(@Param('userId', ParseIntPipe) userId: number) {
    return this.subscriptionsService.getSubscriptionHistory(userId);
  }

  /**
   * Cancel user's active subscription
   */
  @Delete('users/:userId/cancel')
  async cancelSubscription(@Param('userId', ParseIntPipe) userId: number) {
    return this.subscriptionsService.cancelSubscription(userId);
  }
}
