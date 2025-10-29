import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MaxLength,
} from 'class-validator';

export class CreateActivityLogDto {
  @IsInt()
  @IsOptional()
  userId?: number;

  @IsInt()
  @IsOptional()
  eventId?: number;

  @IsInt()
  @IsOptional()
  speakerId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string; // 'event_created', 'speaker_invited', 'submission_uploaded', etc.

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  metadata?: any; // Will be JSON stringified

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
