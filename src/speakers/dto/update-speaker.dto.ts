import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateSpeakerDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  company?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  jobTitle?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
