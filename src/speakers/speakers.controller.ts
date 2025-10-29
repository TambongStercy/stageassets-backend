import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { SpeakersService } from './speakers.service';
import { InviteSpeakerDto } from './dto/invite-speaker.dto';
import { UpdateSpeakerDto } from './dto/update-speaker.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanLimitsGuard } from '../common/guards/plan-limits.guard';
import { CheckPlanLimit } from '../common/decorators/check-plan-limits.decorator';

// Protected endpoints for event managers
@Controller('events/:eventId/speakers')
@UseGuards(JwtAuthGuard)
export class SpeakersController {
  constructor(private readonly speakersService: SpeakersService) {}

  @Post()
  @UseGuards(PlanLimitsGuard)
  @CheckPlanLimit('speaker_invitation')
  async inviteSpeaker(
    @Request() req,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() inviteSpeakerDto: InviteSpeakerDto,
  ) {
    return this.speakersService.inviteSpeaker(
      req.user.id,
      eventId,
      inviteSpeakerDto,
    );
  }

  @Get()
  async findAll(
    @Request() req,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.speakersService.findAllByEvent(req.user.id, eventId);
  }

  @Get(':speakerId')
  async findOne(
    @Request() req,
    @Param('speakerId', ParseIntPipe) speakerId: number,
  ) {
    return this.speakersService.findOne(req.user.id, speakerId);
  }

  @Put(':speakerId')
  async update(
    @Request() req,
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @Body() updateSpeakerDto: UpdateSpeakerDto,
  ) {
    return this.speakersService.update(req.user.id, speakerId, updateSpeakerDto);
  }

  @Delete(':speakerId')
  async delete(
    @Request() req,
    @Param('speakerId', ParseIntPipe) speakerId: number,
  ) {
    return this.speakersService.delete(req.user.id, speakerId);
  }

  @Post(':speakerId/resend-invitation')
  async resendInvitation(
    @Request() req,
    @Param('speakerId', ParseIntPipe) speakerId: number,
  ) {
    return this.speakersService.resendInvitation(req.user.id, speakerId);
  }
}

// Public endpoints for speaker portal (no auth required)
@Controller('portal/speakers')
export class SpeakerPortalController {
  constructor(private readonly speakersService: SpeakersService) {}

  @Get(':accessToken')
  async getSpeakerByToken(@Param('accessToken') accessToken: string) {
    return this.speakersService.findByAccessToken(accessToken);
  }

  @Put(':accessToken')
  async updateProfile(
    @Param('accessToken') accessToken: string,
    @Body() updateSpeakerDto: UpdateSpeakerDto,
  ) {
    return this.speakersService.updateByToken(accessToken, updateSpeakerDto);
  }
}
