import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetRequirementDto } from './create-asset-requirement.dto';

export class UpdateAssetRequirementDto extends PartialType(
  CreateAssetRequirementDto,
) {}
