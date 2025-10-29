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
import { AssetRequirementsService } from './asset-requirements.service';
import { CreateAssetRequirementDto } from './dto/create-asset-requirement.dto';
import { UpdateAssetRequirementDto } from './dto/update-asset-requirement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Protected endpoints for event managers
@Controller('events/:eventId/asset-requirements')
@UseGuards(JwtAuthGuard)
export class AssetRequirementsController {
  constructor(
    private readonly assetRequirementsService: AssetRequirementsService,
  ) {}

  @Post()
  async create(
    @Request() req,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() createDto: CreateAssetRequirementDto,
  ) {
    return this.assetRequirementsService.create(
      req.user.id,
      eventId,
      createDto,
    );
  }

  @Get()
  async findAll(
    @Request() req,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.assetRequirementsService.findAllByEvent(req.user.id, eventId);
  }

  @Get(':requirementId')
  async findOne(
    @Request() req,
    @Param('requirementId', ParseIntPipe) requirementId: number,
  ) {
    return this.assetRequirementsService.findOne(req.user.id, requirementId);
  }

  @Put(':requirementId')
  async update(
    @Request() req,
    @Param('requirementId', ParseIntPipe) requirementId: number,
    @Body() updateDto: UpdateAssetRequirementDto,
  ) {
    return this.assetRequirementsService.update(
      req.user.id,
      requirementId,
      updateDto,
    );
  }

  @Delete(':requirementId')
  async delete(
    @Request() req,
    @Param('requirementId', ParseIntPipe) requirementId: number,
  ) {
    return this.assetRequirementsService.delete(req.user.id, requirementId);
  }
}

// Public endpoint for speakers to view requirements
@Controller('portal/events/:eventId/asset-requirements')
export class PublicAssetRequirementsController {
  constructor(
    private readonly assetRequirementsService: AssetRequirementsService,
  ) {}

  @Get()
  async findAll(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.assetRequirementsService.findAllByEventPublic(eventId);
  }
}
