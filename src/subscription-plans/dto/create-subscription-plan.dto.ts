import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string; // 'free', 'starter', 'professional', 'agency'

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string; // 'Professional Plan'

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  priceMonthly: number; // Store in cents: $99 = 9900

  @IsInt()
  @Min(0)
  @IsOptional()
  priceYearly?: number; // Optional annual discount

  @IsInt()
  @Min(1)
  maxActiveEvents: number;

  @IsInt()
  @Min(1)
  maxSpeakersPerEvent: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[]; // ["branded_portal", "auto_reminders", "priority_support"]

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
