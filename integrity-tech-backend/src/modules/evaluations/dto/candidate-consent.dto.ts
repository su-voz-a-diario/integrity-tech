import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AcceptCandidateConsentDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/i)
  consentVersion?: string;
}
