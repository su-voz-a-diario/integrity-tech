import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuditQueryDto {
  @ApiPropertyOptional({ description: 'Tipo de recurso auditado', example: 'ExamAttempt' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Identificador del recurso auditado' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceId?: string;

  @ApiPropertyOptional({ description: 'ID del usuario actor' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ description: 'Fecha ISO inicial para filtrar eventos', example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha ISO final para filtrar eventos', example: '2026-07-03T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
