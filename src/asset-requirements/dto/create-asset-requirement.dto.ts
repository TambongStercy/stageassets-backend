import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateAssetRequirementDto {
  @IsEnum(['headshot', 'bio', 'presentation', 'logo', 'other'])
  assetType: 'headshot' | 'bio' | 'presentation' | 'logo' | 'other';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  acceptedFileTypes?: string[]; // e.g., [".jpg", ".png", ".pdf"]

  @IsInt()
  @Min(1)
  @IsOptional()
  maxFileSizeMb?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  minImageWidth?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  minImageHeight?: number;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
