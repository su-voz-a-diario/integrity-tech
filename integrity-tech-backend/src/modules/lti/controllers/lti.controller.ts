import { 
  Controller, 
  Post, 
  Get,
  Body, 
  Query,
  Res,
  HttpCode, 
  HttpStatus, 
  Logger
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

    // MOCK: Generar un código 'state' y 'nonce' y guardarlos en Redis
    const state = 'state-temp-uuid-123';
    const nonce = 'nonce-temp-random-456';
    
    // Obtener la URL de autenticación del LMS (en producción se lee de los clientes registrados)
    const lmsAuthUrl = `${iss}/oauth2/auth`;
    
    const redirectUrl = `${lmsAuthUrl}?` + new URLSearchParams({
      scope: 'openid',
      response_type: 'id_token',
      response_mode: 'form_post',
      prompt: 'none',
      client_id: 'integrity-tech-client-id-001',
      redirect_uri: targetLinkUri, // Enlace de retorno (nuestro /lti/launch)
      login_hint: loginHint,
      lti_message_hint: ltiMessageHint,
      state,
      nonce
    }).toString();

    this.logger.log(`Redirigiendo estudiante al LMS OIDC Auth endpoint: ${redirectUrl}`);
    return res.redirect(redirectUrl);
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
    this.logger.log('POST /lti/launch recibido. Procesando id_token JWT...');

    // 1. Validar el token LTI
    const claims = await this.ltiService.validateIdToken(idToken);

    // 2. Auto-provisionar usuario en IAM
    const user = await this.ltiService.provisionUser(claims);

    // 3. Resolver examen local a partir del recurso LMS
    const exam = await this.ltiService.resolveExamFromResourceLink(
      claims['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id
    );

    // 4. Crear el intento local y guardar mapeo de notas LTI AGS
    const attempt = await this.ltiService.initializeLtiAttempt(user.id, exam.id, claims);

    // 5. Generar token de sesión local para el frontend
    const localToken = await this.ltiService.generateSessionToken(user.id);

    // 6. Redirigir al visualizador de Next.js
    const frontendUrl = `http://localhost:3000/exam/${attempt.id}?token=${localToken}`;
    this.logger.log(`Lanzamiento LTI exitoso. Redirigiendo alumno al frontend: ${frontendUrl}`);
    
    return res.redirect(frontendUrl);
  }
}
