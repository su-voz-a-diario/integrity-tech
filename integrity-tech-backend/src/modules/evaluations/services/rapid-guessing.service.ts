import { Injectable, Logger } from '@nestjs/common';
import { RAPID_GUESSING_RULES } from './evaluation-business-rules';

export interface ItemTypeTiming {
  testId: string;
  itemType: string;
  thresholdMs: number; // umbral por debajo del cual se considera adivinación
}

@Injectable()
export class RapidGuessingService {
  private readonly logger = new Logger(RapidGuessingService.name);

  private thresholds: Map<string, number> = new Map(RAPID_GUESSING_RULES.thresholds);

  /**
   * Determina si una respuesta es "rapid guess" según el tiempo y el tipo de ítem.
   */
  classify(testId: string, itemType: string | null, timeMs: number | null): 'solution' | 'guessing' {
    if (timeMs === null || timeMs === undefined || timeMs <= 0) {
      // Si no hay tiempo registrado, asumimos solución por defecto para resiliencia
      return 'solution';
    }

    const safeType = itemType || 'Global';
    const key = `${testId}_${safeType}`;
    
    const threshold = this.thresholds.get(key) || this.thresholds.get(`${testId}_Global`) || RAPID_GUESSING_RULES.defaultThresholdMs;
    
    return timeMs < threshold ? 'guessing' : 'solution';
  }

  /**
   * Recalibra los umbrales a partir de los tiempos reales de una muestra (p. ej., percentil 10).
   */
  async recalibrateThresholds(sampleData: { testId: string; itemType: string; times: number[] }[]): Promise<void> {
    for (const group of sampleData) {
      const { testId, itemType, times } = group;
      if (!times || times.length < RAPID_GUESSING_RULES.recalibrationMinimumSampleSize) continue;

      // Ordenar y extraer el percentil 10
      const sortedTimes = [...times].sort((a, b) => a - b);
      const index = Math.floor(sortedTimes.length * 0.10);
      const p10Value = sortedTimes[index] || RAPID_GUESSING_RULES.recalibrationFallbackP10Ms;
      
      const key = `${testId}_${itemType}`;
      const finalThreshold = Math.max(
        RAPID_GUESSING_RULES.recalibrationMinimumThresholdMs,
        Math.min(RAPID_GUESSING_RULES.recalibrationMaximumThresholdMs, p10Value),
      );
      this.thresholds.set(key, finalThreshold);
      
      this.logger.log(`Recalibrado umbral para ${key} a ${finalThreshold}ms (p10 sobre muestra de N=${times.length})`);
    }
  }
}
