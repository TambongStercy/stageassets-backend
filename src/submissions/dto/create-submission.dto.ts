import { IsInt, IsString, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class CreateSubmissionDto {
  @IsInt()
  assetRequirementId: number;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsInt()
  @Min(1)
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  storagePath: string;

  @IsInt()
  @IsOptional()
  imageWidth?: number;

  @IsInt()
  @IsOptional()
  imageHeight?: number;
}
