import { forwardRef, Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from './services/audit.service';

@Module({
  imports: [forwardRef(() => IamModule)],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
