import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RateLimit } from '../../../shared/security/rate-limit.decorator';
import { RateLimitGuard } from '../../../shared/security/rate-limit.guard';
import { AttemptOwnerGuard } from '../guards/attempt-owner.guard';
import { FinalizeService } from '../services/finalize.service';

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationFinalizeController {
  constructor(private readonly finalizeService: FinalizeService) {}

  @ApiOperation({ summary: 'Finalizar intento de evaluación de forma idempotente' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @Post('attempts/:attemptId/finalize')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard, RateLimitGuard)
  @RateLimit({ scope: 'attempt-finalize', limit: 5, windowMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  finalizeAttempt(@Req() req: any, @Param('attemptId', ParseUUIDPipe) attemptId: string) {
    return this.finalizeService.finalizeAttempt(attemptId, req.user, this.extractRequestMetadata(req));
  }

  private extractRequestMetadata(req: any) {
    return {
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
    };
  }
}
