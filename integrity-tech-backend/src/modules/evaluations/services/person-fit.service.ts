import { Injectable, Logger } from '@nestjs/common';
import { ThetaCalculatorService, ItemResponsePattern } from './theta-calculator.service';

@Injectable()
export class PersonFitService {
  private readonly logger = new Logger(PersonFitService.name);

  constructor(private readonly thetaService: ThetaCalculatorService) {}

  /**
   * Calcula el estadístico de ajuste de persona lz estandarizado.
   * Si lz < -2.0, se clasifica como patrón aberrante (inconsistencias o random responder).
   */
  async calculatePersonFit(
    testId: string,
    patterns: ItemResponsePattern[],
    theta: number,
  ): Promise<{ lz: number; aberrante: boolean }> {
    const items = await this.thetaService.getCachedParameters(testId);
    if (!items || items.length === 0 || patterns.length === 0) {
      return { lz: 0.0, aberrante: false };
    }

    const itemMap = new Map<string, any>();
    for (const item of items) {
      itemMap.set(item.itemId, item);
    }

    let logLikelihood = 0.0;
    let expectedLogLikelihood = 0.0;
    let varianceLogLikelihood = 0.0;

    for (const p of patterns) {
      const item = itemMap.get(p.itemId);
      if (!item) continue;

      const model = item.modelo; // '2PL' o 'GRM'
      const response = p.response;

      if (model === '2PL') {
        const probCorrect = this.thetaService.evaluarProbabilidadItemAtTheta(item, theta, 1);
        const prob = response === 1 ? probCorrect : (1.0 - probCorrect);
        
        const logP = Math.log(Math.max(1e-15, prob));
        logLikelihood += logP;

        // E(log L) = P * log(P) + (1-P) * log(1-P)
        const logPCorrect = Math.log(Math.max(1e-15, probCorrect));
        const logPIncorrect = Math.log(Math.max(1e-15, 1.0 - probCorrect));
        expectedLogLikelihood += probCorrect * logPCorrect + (1.0 - probCorrect) * logPIncorrect;

        // Var(log L) = P * (1-P) * [log(P / (1-P))]^2
        const pRatio = Math.log(Math.max(1e-15, probCorrect / Math.max(1e-15, 1.0 - probCorrect)));
        varianceLogLikelihood += probCorrect * (1.0 - probCorrect) * (pRatio ** 2);
      } 
      else { // GRM
        const thresholds = [item.parametroC1, item.parametroC2, item.parametroC3, item.parametroC4].filter(t => t !== null && t !== undefined);
        const numCategories = thresholds.length + 1;

        // Probabilidad observada para la respuesta dada
        const probObs = this.thetaService.evaluarProbabilidadItemAtTheta(item, theta, response);
        logLikelihood += Math.log(Math.max(1e-15, probObs));

        // Calcular E(log L) y Var(log L) sobre todas las categorías posibles para este ítem en theta
        let expectedItemLog = 0.0;
        let expectedItemLog2 = 0.0;

        for (let cat = 0; cat < numCategories; cat++) {
          const probCat = this.thetaService.evaluarProbabilidadItemAtTheta(item, theta, cat);
          const logPCat = Math.log(Math.max(1e-15, probCat));

          expectedItemLog += probCat * logPCat;
          expectedItemLog2 += probCat * (logPCat ** 2);
        }

        expectedLogLikelihood += expectedItemLog;
        varianceLogLikelihood += (expectedItemLog2 - (expectedItemLog ** 2));
      }
    }

    let lz = 0.0;
    if (varianceLogLikelihood > 1e-6) {
      lz = (logLikelihood - expectedLogLikelihood) / Math.sqrt(varianceLogLikelihood);
    }

    // Acotar lz para evitar infinitos numéricos
    lz = Math.max(-10.0, Math.min(10.0, lz));
    const aberrante = lz < -2.0;

    return {
      lz: Math.round(lz * 1000) / 1000,
      aberrante,
    };
  }
}
