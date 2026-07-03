import { IsUUID, IsNotEmpty, IsObject, IsNumber, IsOptional, Max, Min, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaxJsonSize } from '../../../shared/validators/json-size.validator';

/**
   * DTO para el cuerpo de la petición (request body)
   */
export class SubmitAnswerBodyDto {
  @ApiProperty({ description: 'Identificador único de la pregunta a responder (UUIDv7)', example: '018f2f2f-1a2b-7abc-bdef-0123456789ab' })
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({ 
    description: 'Payload dinámico de respuesta (ej: { selectedOptionId: "opt-1" } o { value: 4 })',
    example: { selectedOptionId: 'opt-correcta' }
  })
  @IsObject()
  @IsNotEmpty()
  @MaxJsonSize(4096)
  response: Record<string, any>; // Estructura JSON dinámica de la respuesta

  @ApiProperty({ description: 'Tiempo de respuesta del candidato en milisegundos', required: false, example: 3500 })
  @IsNumber()
  @Min(0)
  @Max(24 * 60 * 60 * 1000)
  @IsOptional()
  tiempoMs?: number;

  @ApiProperty({ description: 'Versión gobernada del reactivo, si la sesión la proporcionó', required: false })
  @IsUUID()
  @IsOptional()
  itemVersionId?: string;
}

/**
 * DTO interno que contiene toda la estructura consolidada para la cola de Redis
 */
export class SubmitAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  attemptId: string;

  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @IsObject()
  @IsNotEmpty()
  @MaxJsonSize(4096)
  response: Record<string, any>;

  @IsNumber()
  @Min(0)
  @Max(24 * 60 * 60 * 1000)
  @IsOptional()
  tiempoMs?: number;

  @IsUUID()
  @IsOptional()
  itemVersionId?: string | null;
}

export class SubmitProctoringLogDto {
  @IsUUID()
  @IsNotEmpty()
  attemptId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  eventType: string;

  @IsObject()
  @IsNotEmpty()
  @MaxJsonSize(8192)
  metadata: Record<string, any>;
}
