import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController, PortalController } from './events.controller';
import { DatabaseModule } from '../db/database.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [DatabaseModule, AssetsModule],
  providers: [EventsService],
  controllers: [EventsController, PortalController],
  exports: [EventsService],
})
export class EventsModule {}
