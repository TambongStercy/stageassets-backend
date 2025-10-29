import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  isArchived?: boolean;

  @IsDateString()
  @IsOptional()
  archivedAt?: string;
}
