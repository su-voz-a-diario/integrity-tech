import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AttemptOwnerGuard } from '../guards/attempt-owner.guard';
import { SessionService } from '../services/session.service';

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationSessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiOperation({ summary: 'Obtener datos reales de la sesión de examen del candidato' })
  @ApiParam({ name: 'attemptId', description: 'ID único del intento de evaluación (UUIDv7)', type: String })
  @Get('attempts/:attemptId/session')
  @UseGuards(JwtAuthGuard, AttemptOwnerGuard)
  getAttemptSession(@Req() req: any, @Param('attemptId', ParseUUIDPipe) attemptId: string) {
    return this.sessionService.getAttemptSession(attemptId, req.user, this.extractRequestMetadata(req));
  }

  private extractRequestMetadata(req: any) {
    return {
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
    };
  }
}
