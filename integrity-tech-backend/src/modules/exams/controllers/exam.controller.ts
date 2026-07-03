import { Controller, Get, Post, Body, Headers, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { ExamService } from '../services/exam.service';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { PERMISSIONS, Permissions, PermissionsGuard } from '../../iam';

@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}


  /**
   * Endpoint para listar evaluaciones publicadas disponibles para invitaciones.
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.INVITATIONS_CREATE)
  async listPublished(@Req() req: any) {
    return this.examService.listPublishedExams(req.user.organizationId);
  }

  /**
   * Endpoint para que un docente cree un examen.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.ADMIN_MANAGE)
  async create(
    @Headers('authorization') authHeader: string,
    @Body('title') title: string,
    @Body('description') description: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.examService.createExam(token, title, description);
  }

  /**
   * Endpoint para que un estudiante inicie la toma de un examen.
   */
  @Post('attempts')
  @UseGuards(JwtAuthGuard)
  async startAttempt(
    @Headers('authorization') authHeader: string,
    @Body('examId') examId: string,
  ) {
    const token = this.extractToken(authHeader);
    if (!examId) throw new BadRequestException('El campo examId es obligatorio.');
    return this.examService.startExamAttempt(token, examId);
  }

  /**
   * Método auxiliar para extraer el Bearer token del header de autorización
   */
  private extractToken(authHeader: string): string {
    if (!authHeader) {
      throw new BadRequestException('Falta la cabecera de Autorización HTTP.');
    }
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new BadRequestException('Formato de autorización inválido. Use "Bearer <token>".');
    }
    return token;
  }
}
