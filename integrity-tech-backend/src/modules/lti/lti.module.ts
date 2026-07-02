import { Module } from '@nestjs/common';
import { LtiController } from './controllers/lti.controller';
import { LtiService } from './services/lti.service';
import { LtiAgsService } from './services/lti-ags.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { IamModule } from '../iam';

@Module({
  imports: [
    DatabaseModule, // Acceso a PrismaService
    IamModule,
  ],
  controllers: [
    LtiController,
  ],
  providers: [
    LtiService,
    LtiAgsService,
  ],
  exports: [
    LtiService,
    LtiAgsService,
  ],
})
export class LtiModule {}
