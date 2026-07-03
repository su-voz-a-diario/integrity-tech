import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MaxJsonSize } from '../../../shared/validators/json-size.validator';

export class IndividualProctoringLogDto {
  @ApiProperty({ description: 'Tipo de evento de supervisión registrado por el navegador (ej: tab_focus_lost, student_idle)', example: 'tab_focus_lost' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  eventType: string;

  @ApiProperty({ description: 'Nivel de severidad o riesgo del evento conductual', enum: ['INFO', 'WARNING', 'CRITICAL'], example: 'WARNING' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['INFO', 'WARNING', 'CRITICAL'])
  riskLevel: string; // 'INFO', 'WARNING', 'CRITICAL'

  @ApiProperty({ description: 'Estampa de tiempo del evento', example: '16:45:10' })
  @IsDateString()
  @IsNotEmpty()
  timestamp: string; // ISO date string

  @ApiProperty({ 
    description: 'Información técnica adicional: secuencia correlativa y firma HMAC de seguridad del navegador', 
    example: { sequence: 2, trigger: 'window_blur', signature: 'sig-9bc88a8f1ff4f5e718884f938d8212e33' } 
  })
  @IsObject()
  @IsNotEmpty()
  @MaxJsonSize(8192)
  metadata: Record<string, any>;
}

export class ProctoringBatchDto {
  @ApiProperty({ type: [IndividualProctoringLogDto], description: 'Conjunto de logs de supervisión encolados localmente' })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => IndividualProctoringLogDto)
  logs: IndividualProctoringLogDto[];
}
