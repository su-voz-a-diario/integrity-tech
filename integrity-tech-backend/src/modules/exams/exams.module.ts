import { Module } from '@nestjs/common';
import { IamModule } from '../iam';
import { ExamController } from './controllers/exam.controller';
import { ExamService } from './services/exam.service';

@Module({
  imports: [
    IamModule, // Importamos el módulo de identidad (sólo expone la IamFacade al exterior)
  ],
  controllers: [
    ExamController,
  ],
  providers: [
    ExamService,
  ],
  exports: [
    ExamService, // Hacemos público ExamService por si el módulo evaluations requiere consumir lógica de exámenes
  ],
})
export class ExamsModule {}
