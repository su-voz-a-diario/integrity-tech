import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ArchiveService } from './services/archive.service';
import { BackupRecoveryService } from './services/backup-recovery.service';
import { CriticalAssetVersionService } from './services/critical-asset-version.service';
import { DataDeletionService } from './services/data-deletion.service';
import { DataExportService } from './services/data-export.service';
import { RetentionService } from './services/retention.service';

@Module({
  imports: [AuditModule],
  providers: [
    ArchiveService,
    RetentionService,
    DataDeletionService,
    DataExportService,
    CriticalAssetVersionService,
    BackupRecoveryService,
  ],
  exports: [
    ArchiveService,
    RetentionService,
    DataDeletionService,
    DataExportService,
    CriticalAssetVersionService,
    BackupRecoveryService,
  ],
})
export class DataGovernanceModule {}
