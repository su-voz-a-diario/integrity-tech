import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../audit/services/audit.service';

@Injectable()
export class BackupRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async recordBackupEvent(input: {
    organizationId?: string;
    eventType: 'BACKUP_PLANNED' | 'BACKUP_COMPLETED' | 'RESTORE_TESTED' | 'INTEGRITY_CHECKED';
    scope: 'DATABASE' | 'TENANT' | 'AUDIT' | 'SNAPSHOTS';
    status: 'PLANNED' | 'COMPLETED' | 'FAILED';
    integrityHash?: string;
    storageRef?: string;
    metadata?: Record<string, unknown>;
  }) {
    const event = await (this.prisma as any).backupRecoveryEvent.create({
      data: {
        organizationId: input.organizationId || null,
        eventType: input.eventType,
        scope: input.scope,
        status: input.status,
        integrityHash: input.integrityHash || null,
        storageRef: input.storageRef || null,
        metadata: input.metadata || undefined,
      },
    });

    await this.audit.record({
      organizationId: input.organizationId,
      actorType: 'SYSTEM',
      action: `data.backup.${input.eventType.toLowerCase()}`,
      resourceType: input.scope,
      resourceId: event.id,
      metadata: {
        status: input.status,
        hasIntegrityHash: Boolean(input.integrityHash),
      },
    });

    return event;
  }

  backupReadinessChecklist() {
    return {
      requiredControls: [
        'Backups cifrados en reposo',
        'Separación de credenciales de producción y respaldo',
        'Pruebas periódicas de restauración',
        'Verificación de integridad por hash',
        'Runbook de recuperación por tenant y base completa',
      ],
      notImplementedHere: [
        'Proveedor cloud',
        'Almacenamiento externo',
        'Automatización de snapshots',
        'Restauración operacional',
      ],
    };
  }
}
