import { IsUUID, IsNotEmpty, IsObject, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  response: Record<string, any>; // Estructura JSON dinámica de la respuesta

  @ApiProperty({ description: 'Tiempo de respuesta del candidato en milisegundos', required: false, example: 3500 })
  @IsNumber()
  @IsOptional()
  tiempoMs?: number;
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
  response: Record<string, any>;

  @IsNumber()
  @IsOptional()
  tiempoMs?: number;
}

export class SubmitProctoringLogDto {
  @IsUUID()
  @IsNotEmpty()
  attemptId: string;

  @IsNotEmpty()
  eventType: string;

  @IsObject()
  @IsNotEmpty()
  metadata: Record<string, any>;
}
