import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class RecalcularIgaDto {
  @ApiProperty({ description: 'ID del perfil de puesto a asignar (UUID)', example: 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', required: false })
  @IsUUID()
  @IsOptional()
  perfilId?: string;
}

export class SubmitSnapshotDto {
  @ApiProperty({ description: 'Imagen capturada de la webcam codificada en Base64', example: 'data:image/jpeg;base64,...' })
  @IsString()
  @MaxLength(750000)
  image: string;
}

export class CreateInvitationDto {
  @ApiProperty({ description: 'Nombre completo del candidato', example: 'Sofía Valenzuela' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  candidateName: string;

  @ApiProperty({ description: 'Correo electrónico del candidato', example: 'sofia.valenzuela@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ description: 'ID del examen asignado', example: '018f2f2f-1a2b-7abc-bdef-0123456789ab' })
  @IsUUID()
  examId: string;
}

export class VerifyAccessCodeDto {
  @ApiProperty({ description: 'Código o llave de acceso de 6 dígitos', example: 'IT-987654' })
  @IsString()
  @MaxLength(9)
  @Matches(/^IT-\d{6}$/i)
  accessCode: string;
}

export class ClaimAccessCodeDto {
  @ApiProperty({ description: 'Código o llave de acceso de 6 dígitos', example: 'IT-987654' })
  @IsString()
  @MaxLength(9)
  @Matches(/^IT-\d{6}$/i)
  accessCode: string;

  @ApiProperty({ description: 'Nombre del candidato', example: 'Sofía Valenzuela' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  candidateName: string;

  @ApiProperty({ description: 'Correo electrónico del candidato', example: 'sofia.valenzuela@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;
}
