import { IsInt, Min, Max, IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitFeedbackDto {
  @ApiProperty({ description: 'Calificación NPS de la experiencia de 0 a 10', minimum: 0, maximum: 10, example: 9 })
  @IsInt()
  @Min(0)
  @Max(10)
  npsScore: number;

  @ApiPropertyOptional({ description: 'Comentario cualitativo sobre la experiencia técnica del alumno', maxLength: 1000, example: 'El temporizador cargó rápido y las preguntas Likert se respondieron sin lag.' })
  @IsString()
  @IsOptional()
  @Length(0, 1000)
  feedbackText?: string;
}
