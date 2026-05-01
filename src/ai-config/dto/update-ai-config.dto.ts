import { PartialType } from '@nestjs/mapped-types';
import { CreateAiConfigDto } from './create-ai-config.dto';

export class UpdateAiConfigDto extends PartialType(CreateAiConfigDto) {}
