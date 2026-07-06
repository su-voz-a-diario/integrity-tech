import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
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




export class CreateItemDto {
  @ApiProperty({ description: 'Código único del reactivo dentro de la organización', maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  itemCode: string;


  @ApiPropertyOptional({ description: 'Texto visible del reactivo', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'Tipo de respuesta reutilizable', example: 'LIKERT_5_AGREEMENT', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  responseType?: string;

  @ApiPropertyOptional({ description: 'Indica si el reactivo invierte la escala' })
  @IsBoolean()
  @IsOptional()
  isReverseScored?: boolean;

  @ApiPropertyOptional({ description: 'Orden sugerido en el banco', minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: 'Notas del autor del reactivo', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  authorNotes?: string;

  @ApiPropertyOptional({ description: 'Constructo medido', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  constructMeasured?: string;

  @ApiPropertyOptional({ description: 'Conducta observable asociada', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  observableBehavior?: string;

  @ApiPropertyOptional({ description: 'Hipótesis científica del reactivo', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  itemHypothesis?: string;

  @ApiPropertyOptional({ description: 'Fuente científica', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  scientificSource?: string;

  @ApiPropertyOptional({ description: 'Referencia bibliográfica', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  bibliographyReference?: string;

  @ApiPropertyOptional({ description: 'DOI opcional', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  doi?: string;

  @ApiPropertyOptional({ description: 'Versión inicial del reactivo', example: '1.0.0', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsOptional()
  version?: string;

  @ApiProperty({ description: 'Contenido estructurado del reactivo' })
  @IsObject()
  @MaxJsonSize(8192)
  stemJson: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Clave de scoring protegida' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(4096)
  scoringKeyJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Etiquetas del reactivo' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(4096)
  tags?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Idioma del reactivo', maxLength: 10 })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Dimensión/categoría', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Competencia asociada', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  competency?: string;

  @ApiPropertyOptional({ description: 'Escala asociada', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  scale?: string;

  @ApiPropertyOptional({ description: 'Subescala asociada', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  subscale?: string;

  @ApiPropertyOptional({ description: 'Dificultad estimada' })
  @IsNumber()
  @IsOptional()
  difficulty?: number;

  @ApiPropertyOptional({ description: 'Discriminación estimada' })
  @IsNumber()
  @IsOptional()
  discrimination?: number;

  @ApiPropertyOptional({ description: 'Tiempo esperado en segundos', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  expectedTimeSeconds?: number;
}

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Código único de la evaluación dentro de la organización', maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: 'Nombre público de la evaluación', maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Descripción breve de la evaluación', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Nombre corto para navegación y reportes', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  shortName?: string;

  @ApiPropertyOptional({ description: 'Descripción científica completa', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  @IsOptional()
  scientificDescription?: string;

  @ApiPropertyOptional({ description: 'Objetivo del constructo evaluado', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  constructObjective?: string;

  @ApiPropertyOptional({ description: 'Instrucciones para el candidato', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  @IsOptional()
  candidateInstructions?: string;

  @ApiPropertyOptional({ description: 'Tiempo estimado en minutos', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedTimeMinutes?: number;

  @ApiPropertyOptional({ description: 'Autor científico o responsable', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  author?: string;

  @ApiPropertyOptional({ description: 'Referencias científicas estructuradas' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(4096)
  scientificReferences?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Idioma principal', maxLength: 10 })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Factores científicos de la evaluación' })
  @IsArray()
  @ArrayMaxSize(100)
  @IsOptional()
  factors?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Facetas científicas de la evaluación' })
  @IsArray()
  @ArrayMaxSize(300)
  @IsOptional()
  facets?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Catálogo de tipos de respuesta usado por la evaluación' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsOptional()
  responseTypes?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Configuración de corrección, aleatorización y cortes' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(8192)
  scoringConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Configuración de reportes' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(8192)
  reportConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Configuración futura de normas y baremos' })
  @IsObject()
  @IsOptional()
  @MaxJsonSize(8192)
  normingConfig?: Record<string, unknown>;

}

export class AssessmentVersionItemLinkDto {
  @ApiProperty({ description: 'ID de la versión de reactivo gobernada' })
  @IsUUID()
  itemVersionId: string;

  @ApiPropertyOptional({ description: 'Orden dentro de la evaluación', minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Peso del reactivo dentro de la evaluación', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: 'Rol del reactivo dentro de la evaluación', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  role?: string;
}

export class SetAssessmentVersionItemsDto {
  @ApiProperty({ type: [AssessmentVersionItemLinkDto], description: 'Reactivos vinculados a la versión de evaluación' })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AssessmentVersionItemLinkDto)
  items: AssessmentVersionItemLinkDto[];
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
