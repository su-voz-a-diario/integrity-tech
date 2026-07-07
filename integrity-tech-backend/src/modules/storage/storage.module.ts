import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DataGovernanceModule } from '../data-governance/data-governance.module';
import { IamModule } from '../iam';
import { FilesController } from './files.controller';
import { LocalPrivateStorageProvider } from './providers/local-private-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GcsStorageProvider } from './providers/gcs-storage.provider';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [AuditModule, DataGovernanceModule, IamModule],
  controllers: [FilesController],
  providers: [StorageService, LocalPrivateStorageProvider, S3StorageProvider, GcsStorageProvider],
  exports: [StorageService],
})
export class StorageModule {}
