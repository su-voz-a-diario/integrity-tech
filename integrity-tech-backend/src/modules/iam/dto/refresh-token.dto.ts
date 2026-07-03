import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token de sesión revocable', minLength: 32, maxLength: 512 })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken: string;
}
