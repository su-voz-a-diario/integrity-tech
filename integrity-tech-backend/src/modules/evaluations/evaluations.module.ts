import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IamModule } from '../iam';
import { EvaluationController } from './controllers/evaluation.controller';
import { PsicometriaController } from './controllers/psicometria.controller';
import { EvaluationQueueProducer } from './services/evaluation-queue.producer';
import { AnswersQueueProcessor } from './services/answers-queue.processor';
import { ProctoringQueueProcessor } from './services/proctoring-queue.processor';
import { IgaCalculatorService } from './services/iga-calculator.service';
import { ThetaCalculatorService } from './services/theta-calculator.service';
import { CronCalibrationService } from './services/cron-calibration.service';
import { PersonFitService } from './services/person-fit.service';
import { CatService } from './services/cat.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { AdverseImpactService } from './services/adverse-impact.service';
import { RoiService } from './services/roi.service';
import { ContinuousNormingService } from './services/continuous-norming.service';
import { RapidGuessingService } from './services/rapid-guessing.service';

@Module({
  imports: [
    IamModule, // Necesario para que JwtAuthGuard pueda inyectar IamFacade
    BullModule.registerQueue(
      {
        name: 'answers-queue',
      },
      {
        name: 'proctoring-queue',
      },
    ),
  ],
  controllers: [
    EvaluationController, // Registramos el controlador HTTP REST
    PsicometriaController,
  ],
  providers: [
    EvaluationQueueProducer,
    AnswersQueueProcessor,
    ProctoringQueueProcessor,
    IgaCalculatorService,
    ThetaCalculatorService,
    CronCalibrationService,
    PersonFitService,
    CatService,
    ReportGeneratorService,
    AdverseImpactService,
    RoiService,
    ContinuousNormingService,
    RapidGuessingService,
  ],
  exports: [
    EvaluationQueueProducer,
    IgaCalculatorService,
    ThetaCalculatorService,
    CronCalibrationService,
    PersonFitService,
    CatService,
    ReportGeneratorService,
    AdverseImpactService,
    RoiService,
    ContinuousNormingService,
    RapidGuessingService,
  ],
})
export class EvaluationsModule {}
