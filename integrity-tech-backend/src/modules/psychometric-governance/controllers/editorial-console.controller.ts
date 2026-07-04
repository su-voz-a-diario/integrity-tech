import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { CurrentUser, Permissions, PermissionsGuard, PERMISSIONS, SessionUser } from '../../iam';
import {
  CreateAssessmentDto,
  CreateVersionFromPublishedDto,
  EditorialActionDto,
  SetAssessmentVersionItemsDto,
  UpdateDraftVersionDto,
} from '../dto/editorial-console.dto';
import { EditorialConsoleService } from '../services/editorial-console.service';

@ApiTags('Psychometric Governance Editorial Console')
@ApiBearerAuth()
@Controller('psychometric-governance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EditorialConsoleController {
  constructor(private readonly consoleService: EditorialConsoleService) {}

  @Post('assessments')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  @ApiOperation({ summary: 'Crear evaluación gobernada con versión inicial DRAFT' })
  createAssessment(@CurrentUser() user: SessionUser, @Body() body: CreateAssessmentDto) {
    return this.consoleService.createAssessment(user, body);
  }

  @Get('assessments')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Listar pruebas gobernadas del tenant' })
  listAssessments(@CurrentUser() user: SessionUser) {
    return this.consoleService.listAssessments(user);
  }

  @Get('assessments/:assessmentId')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Ver detalle de prueba gobernada' })
  getAssessment(@CurrentUser() user: SessionUser, @Param('assessmentId') assessmentId: string) {
    return this.consoleService.getAssessment(user, assessmentId);
  }

  @Get('assessments/:assessmentId/versions')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Listar versiones de una prueba gobernada' })
  listAssessmentVersions(@CurrentUser() user: SessionUser, @Param('assessmentId') assessmentId: string) {
    return this.consoleService.listAssessmentVersions(user, assessmentId);
  }

  @Get('assessment-versions/:assessmentVersionId/detail')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Ver detalle profundo de versión de prueba' })
  getAssessmentVersionDetail(@CurrentUser() user: SessionUser, @Param('assessmentVersionId') assessmentVersionId: string) {
    return this.consoleService.getAssessmentVersionDetail(user, assessmentVersionId);
  }

  @Put('assessment-versions/:assessmentVersionId/items')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  @ApiOperation({ summary: 'Vincular reactivos a una versión editable de evaluación' })
  setAssessmentVersionItems(
    @CurrentUser() user: SessionUser,
    @Param('assessmentVersionId') assessmentVersionId: string,
    @Body() body: SetAssessmentVersionItemsDto,
  ) {
    return this.consoleService.setAssessmentVersionItems(user, assessmentVersionId, body);
  }

  @Get('items')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Listar banco de reactivos gobernado' })
  listItems(@CurrentUser() user: SessionUser) {
    return this.consoleService.listItems(user);
  }

  @Get('item-versions/:itemVersionId')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Ver versión de reactivo con datos sensibles redactados' })
  getItemVersion(@CurrentUser() user: SessionUser, @Param('itemVersionId') itemVersionId: string) {
    return this.consoleService.getItemVersion(user, itemVersionId);
  }

  @Get('item-versions/:itemVersionId/detail')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Ver detalle profundo de versión de reactivo' })
  getItemVersionDetail(@CurrentUser() user: SessionUser, @Param('itemVersionId') itemVersionId: string) {
    return this.consoleService.getItemVersionDetail(user, itemVersionId);
  }

  @Get('versions/:model/:versionId/history')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Ver historial editorial de una versión' })
  getEditorialHistory(
    @CurrentUser() user: SessionUser,
    @Param('model') model: string,
    @Param('versionId') versionId: string,
  ) {
    return this.consoleService.getEditorialHistory(user, model, versionId);
  }

  @Get('versions/:model/:versionId/readiness')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_READ)
  @ApiOperation({ summary: 'Validar si una versión está lista para publicarse' })
  validateVersionReadiness(
    @CurrentUser() user: SessionUser,
    @Param('model') model: string,
    @Param('versionId') versionId: string,
  ) {
    return this.consoleService.validateVersionReadiness(user, model, versionId);
  }

  @Patch('versions')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  @ApiOperation({ summary: 'Actualizar versión editable no publicada' })
  updateDraftVersion(@CurrentUser() user: SessionUser, @Body() body: UpdateDraftVersionDto) {
    return this.consoleService.updateDraftVersion(user, body);
  }

  @Post('workflow')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  @ApiOperation({ summary: 'Ejecutar acción de workflow editorial' })
  executeWorkflowAction(@CurrentUser() user: SessionUser, @Body() body: EditorialActionDto) {
    return this.consoleService.executeWorkflowAction(user, body);
  }

  @Post('versions/from-published')
  @Permissions(PERMISSIONS.PSYCHOMETRICS_WRITE)
  @ApiOperation({ summary: 'Crear nueva versión editable desde una versión publicada' })
  createVersionFromPublished(@CurrentUser() user: SessionUser, @Body() body: CreateVersionFromPublishedDto) {
    return this.consoleService.createVersionFromPublished(user, body);
  }
}
