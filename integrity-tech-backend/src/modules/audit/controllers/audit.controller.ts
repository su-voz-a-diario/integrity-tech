import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { Permissions } from '../../iam/decorators/permissions.decorator';
import { PermissionsGuard } from '../../iam/guards/permissions.guard';
import { PERMISSIONS } from '../../iam/permissions';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { AuditService } from '../services/audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AUDIT_READ)
  findEvents(@Req() req: any, @Query() query: AuditQueryDto) {
    return this.auditService.findEvents(req.user.organizationId, query);
  }
}
