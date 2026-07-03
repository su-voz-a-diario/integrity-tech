import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RateLimit } from '../../../shared/security/rate-limit.decorator';
import { RateLimitGuard } from '../../../shared/security/rate-limit.guard';
import { AcceptCandidateConsentDto } from '../dto/candidate-consent.dto';
import { AttemptOwnerGuard } from '../guards/attempt-owner.guard';
import { CandidateConsentService } from '../services/candidate-consent.service';

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class CandidateConsentController {
  constructor(private readonly consentService: CandidateConsentService) {}

  @ApiOperation({ summary: 'Consultar consentimiento del candidato para un intento' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @Get('attempts/:attemptId/consent')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  getConsent(@Req() req: Request & { user: any }, @Param('attemptId', ParseUUIDPipe) attemptId: string) {
    return this.consentService.getConsentStatus(attemptId, req.user, this.extractRequestMetadata(req));
  }

  @ApiOperation({ summary: 'Aceptar consentimiento del candidato para iniciar evaluación' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @Post('attempts/:attemptId/consent')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard, RateLimitGuard)
  @RateLimit({ scope: 'candidate-consent', limit: 10, windowMs: 60_000 })
  acceptConsent(
    @Req() req: Request & { user: any },
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() body: AcceptCandidateConsentDto,
  ) {
    return this.consentService.acceptConsent(attemptId, req.user, body, this.extractRequestMetadata(req));
  }

  private extractRequestMetadata(req: Request) {
    return {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    };
  }
}
