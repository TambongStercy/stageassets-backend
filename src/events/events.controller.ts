import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanLimitsGuard } from '../common/guards/plan-limits.guard';
import { CheckPlanLimit } from '../common/decorators/check-plan-limits.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(PlanLimitsGuard)
  @CheckPlanLimit('event_creation')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed for logo'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Request() req,
    @Body() createEventDto: CreateEventDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.eventsService.create(req.user.id, createEventDto, logo);
  }

  @Get()
  async findAll(
    @Request() req,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const includeArchivedBool = includeArchived === 'true';
    return this.eventsService.findAll(req.user.id, includeArchivedBool);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findOne(req.user.id, id);
  }

  @Get(':id/stats')
  async getStats(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.eventsService.getEventStats(req.user.id, id);
  }

  @Get(':id/submissions')
  async getSubmissions(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.eventsService.getEventSubmissions(req.user.id, id);
  }

  @Get(':id/download-assets')
  async downloadAssets(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.eventsService.downloadAllAssets(req.user.id, id);
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed for logo'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEventDto: UpdateEventDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.eventsService.update(req.user.id, id, updateEventDto, logo);
  }

  @Put(':id/archive')
  async archive(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.eventsService.archive(req.user.id, id);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.eventsService.delete(req.user.id, id);
  }
}

// Public controller for speaker portal access (no auth required)
@Controller('portal')
export class PortalController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events/:slug')
  async getEventBySlug(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }
}
