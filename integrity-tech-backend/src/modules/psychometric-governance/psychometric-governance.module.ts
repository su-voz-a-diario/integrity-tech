import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam';
import { EditorialConsoleController } from './controllers/editorial-console.controller';
import { EditorialConsoleService } from './services/editorial-console.service';
import { PsychometricVersioningService } from './services/psychometric-versioning.service';
import { PsychometricWorkflowService } from './services/psychometric-workflow.service';
import { ScientificTraceService } from './services/scientific-trace.service';
import { EvaluationGovernanceResolverService } from './services/evaluation-governance-resolver.service';

@Module({
  imports: [AuditModule, IamModule],
  controllers: [EditorialConsoleController],
  providers: [
    EditorialConsoleService,
    PsychometricWorkflowService,
    PsychometricVersioningService,
    ScientificTraceService,
    EvaluationGovernanceResolverService,
  ],
  exports: [
    EditorialConsoleService,
    PsychometricWorkflowService,
    PsychometricVersioningService,
    ScientificTraceService,
    EvaluationGovernanceResolverService,
  ],
})
export class PsychometricGovernanceModule {}
