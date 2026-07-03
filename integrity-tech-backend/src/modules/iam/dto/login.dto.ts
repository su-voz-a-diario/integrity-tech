import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Correo del usuario staff', example: 'admin@integrity.demo' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ description: 'Contraseña del usuario staff', minLength: 8, maxLength: 200, example: 'IntegrityDemo123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;

  @ApiPropertyOptional({ description: 'Slug de la organización para resolver el tenant', example: 'demo-org' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9][a-z0-9-]{0,253}[a-z0-9]$/i)
  organizationSlug?: string;
}
