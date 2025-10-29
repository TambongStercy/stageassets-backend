import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Protected endpoints for managing subscription plans (admin only)
 * TODO: Add admin role guard when role-based auth is implemented
 */
@Controller('subscription-plans')
@UseGuards(JwtAuthGuard)
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Post()
  async create(@Body() createDto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlansService.create(createDto);
  }

  @Get()
  async findAll() {
    return this.subscriptionPlansService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionPlansService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlansService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionPlansService.remove(id);
  }
}

/**
 * Public endpoints for viewing available plans
 */
@Controller('portal/subscription-plans')
export class PublicSubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  async findAllActive() {
    return this.subscriptionPlansService.findAllActive();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionPlansService.findOne(id);
  }
}
