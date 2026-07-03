import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { PERMISSIONS, Permissions, PermissionsGuard } from '../../iam';
import { RateLimit } from '../../../shared/security/rate-limit.decorator';
import { RateLimitGuard } from '../../../shared/security/rate-limit.guard';
import { ClaimAccessCodeDto, CreateInvitationDto, VerifyAccessCodeDto } from '../dto/evaluation-flow.dto';
import { InvitationService } from '../services/invitation.service';

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class InvitationsController {
  constructor(private readonly invitationService: InvitationService) {}

  @ApiOperation({ summary: 'Crear invitación y clave de acceso para un candidato' })
  @ApiResponse({ status: 201, description: 'Invitación creada con éxito.' })
  @Post('invitations')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.INVITATIONS_CREATE)
  createInvitation(@Req() req: any, @Body() body: CreateInvitationDto) {
    return this.invitationService.createInvitation(req.user, body, this.extractRequestMetadata(req));
  }

  @ApiOperation({ summary: 'Verificar la validez de una clave de acceso' })
  @ApiResponse({ status: 200, description: 'Código de acceso válido.' })
  @Post('invitations/verify')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'invitation-verify', limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  verifyInvitation(@Req() req: any, @Body() body: VerifyAccessCodeDto) {
    return this.invitationService.verifyInvitation(body, this.extractRequestMetadata(req));
  }

  @ApiOperation({ summary: 'Reclamar clave de acceso e iniciar examen' })
  @ApiResponse({ status: 201, description: 'Intento de evaluación iniciado.' })
  @Post('invitations/claim')
  @UseGuards(RateLimitGuard)
  @RateLimit({ scope: 'invitation-claim', limit: 5, windowMs: 60_000 })
  @HttpCode(HttpStatus.CREATED)
  claimInvitation(@Req() req: any, @Body() body: ClaimAccessCodeDto) {
    return this.invitationService.claimInvitation(body, this.extractRequestMetadata(req));
  }

  private extractRequestMetadata(req: any) {
    return {
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
    };
  }
}
