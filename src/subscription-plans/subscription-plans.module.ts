import { Module } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import {
  SubscriptionPlansController,
  PublicSubscriptionPlansController,
} from './subscription-plans.controller';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    SubscriptionPlansController,
    PublicSubscriptionPlansController,
  ],
  providers: [SubscriptionPlansService],
  exports: [SubscriptionPlansService],
})
export class SubscriptionPlansModule {}
