import { IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class TriggerReminderDto {
  @IsInt()
  @IsNotEmpty()
  speakerId: number;

  @IsString()
  @IsOptional()
  emailSubject?: string;

  @IsString()
  @IsOptional()
  emailBody?: string;
}
