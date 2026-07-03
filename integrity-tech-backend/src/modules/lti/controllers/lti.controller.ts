import { 
  Controller, 
  Post, 
  Get,
  Body, 
  Query,
  Res,
  HttpCode, 
  HttpStatus, 
  Logger,
  NotImplementedException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { LtiService } from '../services/lti.service';

@ApiTags('LTI v1.3 Integration (LMS Interoperability)')
@Controller('lti')
export class LtiController {
  private readonly logger = new Logger(LtiController.name);

  constructor(private readonly ltiService: LtiService) {}

  /**
   * Paso 1 del Lanzamiento LTI 1.3: Iniciación del Login OIDC (LMS -> Tool).
   * Puede ser GET o POST. Redirige al alumno al endpoint de autenticación del LMS.
   */
  @ApiOperation({ 
    summary: 'Iniciar login federado LTI OIDC', 
    description: 'Endpoint de redirección que inicia el protocolo OIDC de 3 pasos con Moodle/Canvas.' 
  })
  @ApiResponse({ status: 302, description: 'Redirección al portal de autenticación del LMS.' })
  @Get('login')
  async initiateLogin(
    @Query('iss') iss: string,
    @Query('login_hint') loginHint: string,
    @Query('target_link_uri') targetLinkUri: string,
    @Query('lti_message_hint') ltiMessageHint: string,
    @Res() res: Response
  ) {
    this.logger.log(`OIDC Login Init recibido del emisor: ${iss} | login_hint: ${loginHint}`);
    throw new NotImplementedException('LTI OIDC requiere configuración real de plataforma LMS antes de habilitarse.');
  }

  /**
   * Paso 3 del Lanzamiento LTI 1.3: Recepción de Token e Inicio de Sesión (LMS -> Tool).
   * Recibe el id_token (JWT) mediante un POST desde el navegador del estudiante.
   */
  @ApiOperation({ 
    summary: 'Procesar lanzamiento de examen LTI Launch', 
    description: 'Recibe el id_token firmado por el LMS, valida la sesión, auto-provisiona al estudiante en base de datos, inicializa el intento y lo redirige al visualizador del examen Next.js con un token local.' 
  })
  @ApiResponse({ status: 302, description: 'Redirección al visualizador del examen en el frontend Next.js.' })
  @Post('launch')
  @HttpCode(HttpStatus.FOUND)
  async ltiLaunch(
    @Body('id_token') idToken: string,
    @Body('state') state: string,
    @Res() res: Response
  ) {
    this.logger.log('POST /lti/launch recibido.');
    throw new NotImplementedException('LTI Launch requiere validación JWT/JWKS y mapeo real de recurso antes de habilitarse.');
  }
}
