import { Module } from '@nestjs/common';
import { AssetRequirementsService } from './asset-requirements.service';
import {
  AssetRequirementsController,
  PublicAssetRequirementsController,
} from './asset-requirements.controller';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AssetRequirementsService],
  controllers: [
    AssetRequirementsController,
    PublicAssetRequirementsController,
  ],
  exports: [AssetRequirementsService],
})
export class AssetRequirementsModule {}
