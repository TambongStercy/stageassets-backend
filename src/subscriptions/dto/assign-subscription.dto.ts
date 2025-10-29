import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class AssignSubscriptionDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsInt()
  @IsNotEmpty()
  planId: number;

  @IsDateString()
  @IsOptional()
  startDate?: string; // Defaults to now if not provided

  @IsDateString()
  @IsOptional()
  endDate?: string; // Null = active subscription

  @IsInt()
  @Min(0)
  @IsOptional()
  amountPaid?: number; // In cents, defaults to 0 for manual assignments

  @IsOptional()
  notes?: string; // Admin notes about this subscription
}
