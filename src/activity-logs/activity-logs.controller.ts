import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Activity logs endpoints
 * Protected - requires authentication
 */
@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  /**
   * Create a new activity log entry
   * Note: Typically called internally by other services, but exposed for manual logging
   */
  @Post()
  async create(@Body() createDto: CreateActivityLogDto) {
    return this.activityLogsService.create(createDto);
  }

  /**
   * Get all activity logs with optional filters
   */
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('eventId') eventId?: string,
    @Query('speakerId') speakerId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogsService.findAll({
      userId: userId ? parseInt(userId) : undefined,
      eventId: eventId ? parseInt(eventId) : undefined,
      speakerId: speakerId ? parseInt(speakerId) : undefined,
      action,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Get activity logs for a specific event
   */
  @Get('events/:eventId')
  async findByEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogsService.findByEvent(
      eventId,
      limit ? parseInt(limit) : undefined,
    );
  }

  /**
   * Get activity logs for a specific user
   */
  @Get('users/:userId')
  async findByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogsService.findByUser(
      userId,
      limit ? parseInt(limit) : undefined,
    );
  }

  /**
   * Get activity logs for a specific speaker
   */
  @Get('speakers/:speakerId')
  async findBySpeaker(
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogsService.findBySpeaker(
      speakerId,
      limit ? parseInt(limit) : undefined,
    );
  }
}
