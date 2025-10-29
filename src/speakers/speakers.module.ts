import { Module } from '@nestjs/common';
import { SpeakersService } from './speakers.service';
import { SpeakersController, SpeakerPortalController } from './speakers.controller';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SpeakersService],
  controllers: [SpeakersController, SpeakerPortalController],
  exports: [SpeakersService],
})
export class SpeakersModule {}
