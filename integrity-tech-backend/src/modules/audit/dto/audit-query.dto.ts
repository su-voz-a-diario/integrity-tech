import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceId?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
