import { Injectable, Logger } from '@nestjs/common';
import { ThetaCalculatorService } from './theta-calculator.service';

@Injectable()
export class CatService {
  private readonly logger = new Logger(CatService.name);

  constructor(private readonly thetaService: ThetaCalculatorService) {}

  /**
   * Selecciona el siguiente ítem con la Máxima Información del Ítem (MII) en el theta provisional.
   * Retorna shouldStop = true si se alcanza el criterio de parada (SE < 0.35 o 15 ítems respondidos).
   */
  async selectNextItem(
    testId: string,
    answeredItemIds: string[],
    currentTheta: number,
    provisionalSe: number,
  ): Promise<{ nextItemId: string | null; shouldStop: boolean }> {
    // 1. Criterios de parada
    const maxItems = 15; // Límite de longitud máxima de la prueba adaptativa
    if (answeredItemIds.length >= maxItems) {
      return { nextItemId: null, shouldStop: true };
    }

    if (provisionalSe < 0.35 && answeredItemIds.length >= 5) {
      // Si el error estándar es lo suficientemente bajo y se respondieron al menos 5 ítems para estabilidad
      return { nextItemId: null, shouldStop: true };
    }

    // 2. Obtener todos los ítems activos para el test
    const allItems = await this.thetaService.getCachedParameters(testId);
    if (!allItems || allItems.length === 0) {
      return { nextItemId: null, shouldStop: true };
    }

    // 3. Filtrar ítems no respondidos
    const remainingItems = allItems.filter(item => !answeredItemIds.includes(item.itemId));
    if (remainingItems.length === 0) {
      return { nextItemId: null, shouldStop: true };
    }

    // 4. Buscar el ítem que maximiza la información en currentTheta
    let bestItem: any = null;
    let maxInfo = -1.0;

    for (const item of remainingItems) {
      const info = this.calculateItemInformation(item, currentTheta);
      if (info > maxInfo) {
        maxInfo = info;
        bestItem = item;
      }
    }

    return {
      nextItemId: bestItem ? bestItem.itemId : null,
      shouldStop: false,
    };
  }

  /**
   * Calcula la función de información del ítem (I_j(theta)) en un nivel de habilidad dado.
   */
  private calculateItemInformation(item: any, theta: number): number {
    const a = item.parametroA;
    const model = item.modelo;

    if (model === '2PL') {
      const b = item.parametroB ?? 0.0;
      const exponente = -a * (theta - b);
      const probCorrect = 1.0 / (1.0 + Math.exp(exponente));
      // I(theta) = a^2 * P(theta) * Q(theta)
      return (a ** 2) * probCorrect * (1.0 - probCorrect);
    } 
    else { // GRM
      const thresholds = [item.parametroC1, item.parametroC2, item.parametroC3, item.parametroC4].filter(t => t !== null && t !== undefined);
      const numCategories = thresholds.length + 1;
      const delta = 0.005;

      // Calcular información mediante aproximación numérica: sum_k (dP_k/dtheta)^2 / P_k
      let itemInfo = 0.0;

      for (let cat = 0; cat < numCategories; cat++) {
        const prob = this.thetaService.evaluarProbabilidadItemAtTheta(item, theta, cat);
        if (prob > 1e-10) {
          const probPlus = this.thetaService.evaluarProbabilidadItemAtTheta(item, theta + delta, cat);
          const probMinus = this.thetaService.evaluarProbabilidadItemAtTheta(item, theta - delta, cat);
          const derivative = (probPlus - probMinus) / (2.0 * delta);
          itemInfo += (derivative ** 2) / prob;
        }
      }

      return itemInfo;
    }
  }
}
