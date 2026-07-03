import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { PERMISSIONS, Permissions, PermissionsGuard } from '../../iam';
import { AttemptService } from '../services/attempt.service';

@ApiTags('Evaluations (Motor de Evaluación)')
@ApiBearerAuth()
@Controller('evaluations')
export class AttemptsController {
  constructor(private readonly attemptService: AttemptService) {}

  @ApiOperation({
    summary: 'Listar todos los intentos de evaluación para la consola del reclutador',
    description: 'Devuelve una lista consolidada de intentos de exámenes incluyendo datos de candidatos (IAM) y títulos (Exams).',
  })
  @ApiResponse({ status: 200, description: 'Listado de intentos devuelto con éxito.' })
  @Get('attempts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ATTEMPTS_READ)
  getAttempts(@Req() req: any) {
    return this.attemptService.listAttempts(req.user.organizationId);
  }
}
