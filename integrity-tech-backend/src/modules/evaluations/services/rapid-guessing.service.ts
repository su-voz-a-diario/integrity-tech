import { Injectable, Logger } from '@nestjs/common';

export interface ItemTypeTiming {
  testId: string;
  itemType: string;
  thresholdMs: number; // umbral por debajo del cual se considera adivinación
}

@Injectable()
export class RapidGuessingService {
  private readonly logger = new Logger(RapidGuessingService.name);

  // Umbrales iniciales basados en investigación (Wise & Ma, 2012)
  // Se pueden recalibrar con los percentiles 10 de los tiempos de una muestra de referencia
  private thresholds: Map<string, number> = new Map([
    ['IT2_AC10_verbal', 3000],
    ['IT2_AC10_numerico', 2500],
    ['IT2_AC10_abstracto', 2000],
    ['IT2_I_SJT', 4000],
    ['IT2_I_Global', 2000],
    ['IT2_P10_Global', 1500],
    ['IT2_CB10_Global', 3500],
  ]);

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
    
    // Buscar umbral exacto o caer en fallback del test general, o fallback general de 3 segundos
    const threshold = this.thresholds.get(key) || this.thresholds.get(`${testId}_Global`) || 3000;
    
    return timeMs < threshold ? 'guessing' : 'solution';
  }

  /**
   * Recalibra los umbrales a partir de los tiempos reales de una muestra (p. ej., percentil 10).
   */
  async recalibrateThresholds(sampleData: { testId: string; itemType: string; times: number[] }[]): Promise<void> {
    for (const group of sampleData) {
      const { testId, itemType, times } = group;
      if (!times || times.length < 5) continue;

      // Ordenar y extraer el percentil 10
      const sortedTimes = [...times].sort((a, b) => a - b);
      const index = Math.floor(sortedTimes.length * 0.10);
      const p10Value = sortedTimes[index] || 1500; // Cota mínima de 1.5s por seguridad
      
      const key = `${testId}_${itemType}`;
      const finalThreshold = Math.max(1000, Math.min(10000, p10Value)); // Acotar entre 1s y 10s
      this.thresholds.set(key, finalThreshold);
      
      this.logger.log(`Recalibrado umbral para ${key} a ${finalThreshold}ms (p10 sobre muestra de N=${times.length})`);
    }
  }
}
