import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaxJsonSize } from '../../../shared/validators/json-size.validator';

export enum EditorialVersionModel {
  AssessmentVersion = 'assessmentVersion',
  ItemVersion = 'itemVersion',
  NormGroupVersion = 'normGroupVersion',
  ScoringModelVersion = 'scoringModelVersion',
  ReportTemplateVersion = 'reportTemplateVersion',
}

export enum EditorialAction {
  RequestInternalReview = 'request_internal_review',
  RequestPsychologistReview = 'request_psychologist_review',
  Approve = 'approve',
  Publish = 'publish',
  Retire = 'retire',
  ReturnToDraft = 'return_to_draft',
}

export class EditorialActionDto {
  @ApiProperty({ enum: EditorialVersionModel, description: 'Tipo de versión editorial sobre la que se ejecuta la acción' })
  @IsEnum(EditorialVersionModel)
  model: EditorialVersionModel;

  @ApiProperty({ description: 'ID de la versión editorial objetivo' })
  @IsUUID()
  versionId: string;

  @ApiProperty({ enum: EditorialAction, description: 'Acción editorial solicitada' })
  @IsEnum(EditorialAction)
  action: EditorialAction;

  @ApiPropertyOptional({ description: 'Razón o comentario requerido para acciones críticas', maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class CreateVersionFromPublishedDto {
  @ApiProperty({ enum: EditorialVersionModel, description: 'Tipo de versión publicada a duplicar' })
  @IsEnum(EditorialVersionModel)
  model: EditorialVersionModel;

  @ApiProperty({ description: 'ID de la versión publicada fuente' })
  @IsUUID()
  sourceVersionId: string;

  @ApiProperty({ description: 'Nueva etiqueta de versión', example: '1.1.0', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  newVersion: string;

  @ApiPropertyOptional({ description: 'Sobrescrituras controladas para la nueva versión DRAFT' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(8192)
  overrides?: Record<string, unknown>;
}

export class UpdateDraftVersionDto {
  @ApiProperty({ enum: EditorialVersionModel, description: 'Tipo de versión editable' })
  @IsEnum(EditorialVersionModel)
  model: EditorialVersionModel;

  @ApiProperty({ description: 'ID de la versión DRAFT o INTERNAL_REVIEW' })
  @IsUUID()
  versionId: string;

  @ApiProperty({ description: 'Datos editables de la versión no publicada' })
  @IsObject()
  @MaxJsonSize(8192)
  data: Record<string, unknown>;
}
