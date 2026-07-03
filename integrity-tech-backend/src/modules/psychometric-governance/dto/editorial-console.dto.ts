import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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
  @IsEnum(EditorialVersionModel)
  model: EditorialVersionModel;

  @IsUUID()
  versionId: string;

  @IsEnum(EditorialAction)
  action: EditorialAction;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class CreateVersionFromPublishedDto {
  @IsEnum(EditorialVersionModel)
  model: EditorialVersionModel;

  @IsUUID()
  sourceVersionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  newVersion: string;

  @IsObject()
  @IsOptional()
  @MaxJsonSize(8192)
  overrides?: Record<string, unknown>;
}

export class UpdateDraftVersionDto {
  @IsEnum(EditorialVersionModel)
  model: EditorialVersionModel;

  @IsUUID()
  versionId: string;

  @IsObject()
  @MaxJsonSize(8192)
  data: Record<string, unknown>;
}
