import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { TriggerReminderDto } from './dto/trigger-reminder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Reminder management endpoints
 * Protected - requires authentication
 */
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /**
   * Get reminder history for a specific event
   */
  @Get('events/:eventId')
  async getEventReminders(
    @Request() req,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.remindersService.getEventReminders(req.user.id, eventId);
  }

  /**
   * Get reminder history for a specific speaker
   */
  @Get('speakers/:speakerId')
  async getSpeakerReminders(
    @Request() req,
    @Param('speakerId', ParseIntPipe) speakerId: number,
  ) {
    return this.remindersService.getSpeakerReminders(
      req.user.id,
      speakerId,
    );
  }

  /**
   * Get all failed reminders for user's events
   */
  @Get('failed')
  async getFailedReminders(@Request() req) {
    return this.remindersService.getFailedReminders(req.user.id);
  }

  /**
   * Manually trigger a reminder for a speaker
   */
  @Post('trigger')
  async triggerReminder(@Request() req, @Body() triggerDto: TriggerReminderDto) {
    return this.remindersService.triggerReminder(req.user.id, triggerDto);
  }

  /**
   * Retry a failed reminder
   */
  @Post(':reminderId/retry')
  async retryFailedReminder(
    @Request() req,
    @Param('reminderId', ParseIntPipe) reminderId: number,
  ) {
    return this.remindersService.retryFailedReminder(req.user.id, reminderId);
  }
}
