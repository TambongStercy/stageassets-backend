import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../db/database.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [DatabaseModule, AssetsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
