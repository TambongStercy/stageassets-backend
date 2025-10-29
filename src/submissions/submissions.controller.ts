import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

// Public endpoints for speaker submissions (accessed via speaker portal)
@Controller('portal/speakers/:speakerId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  async create(
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @Body() createSubmissionDto: CreateSubmissionDto,
  ) {
    return this.submissionsService.create(speakerId, createSubmissionDto);
  }

  @Get()
  async findBySpeaker(@Param('speakerId', ParseIntPipe) speakerId: number) {
    return this.submissionsService.findBySpeaker(speakerId);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.submissionsService.delete(id);
  }

  /**
   * Get version history for a specific asset requirement
   */
  @Get('asset-requirements/:assetRequirementId/versions')
  async getVersionHistory(
    @Param('speakerId', ParseIntPipe) speakerId: number,
    @Param('assetRequirementId', ParseIntPipe) assetRequirementId: number,
  ) {
    return this.submissionsService.getVersionHistory(speakerId, assetRequirementId);
  }

  /**
   * Get a specific version of a submission
   */
  @Get('versions/:submissionId')
  async getVersion(@Param('submissionId', ParseIntPipe) submissionId: number) {
    return this.submissionsService.getVersion(submissionId);
  }
}
