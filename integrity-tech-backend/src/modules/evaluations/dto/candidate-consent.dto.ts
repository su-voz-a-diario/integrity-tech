import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptCandidateConsentDto {
  @ApiPropertyOptional({ description: 'Versión del consentimiento aceptado', example: 'candidate-consent-v1' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/i)
  consentVersion?: string;
}
