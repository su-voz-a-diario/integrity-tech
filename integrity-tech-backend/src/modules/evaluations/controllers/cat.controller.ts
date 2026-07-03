import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CatService } from '../services/cat.service';

class StartCatSessionDto {
  configId: string;
  userId: string;
}

class SubmitCatResponseDto {
  itemId: string;
  response: string;
  responseTimeMs: number;
}

@ApiTags('CAT (Computerized Adaptive Testing Engine)')
@ApiBearerAuth()
@Controller('evaluations/cat')
@UseGuards(JwtAuthGuard)
export class CatController {
  constructor(private readonly catService: CatService) {}

  @ApiOperation({ summary: 'Iniciar una sesión adaptativa computerizada (CAT)' })
  @ApiResponse({ status: 201, description: 'Sesión iniciada con éxito. Devuelve la sesión y el primer reactivo.' })
  @Post('sessions')
  async startSession(@Req() req: any, @Body() body: StartCatSessionDto) {
    const organizationId = req.user.organizationId;
    return this.catService.startSession(body.configId, body.userId, organizationId);
  }

  @ApiOperation({ summary: 'Enviar respuesta al reactivo adaptativo activo' })
  @ApiResponse({ status: 200, description: 'Respuesta procesada. Devuelve el siguiente reactivo o finalización.' })
  @Post('sessions/:sessionId/response')
  async submitResponse(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitCatResponseDto,
  ) {
    const organizationId = req.user.organizationId;
    return this.catService.processResponse(
      sessionId,
      organizationId,
      body.itemId,
      body.response,
      body.responseTimeMs,
    );
  }
}
