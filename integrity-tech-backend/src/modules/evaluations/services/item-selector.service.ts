import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CatItem } from '@prisma/client';

@Injectable()
export class ItemSelectorService {
  private readonly logger = new Logger(ItemSelectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Selecciona el siguiente reactivo adaptativo utilizando la Máxima Información de Fisher (MII)
   * y control de exposición probabilístico basado en Sympson-Hetter.
   */
  async selectNextItem(
    bankId: string,
    organizationId: string,
    theta: number,
    excludeItemIds: string[],
    useExposureControl: boolean,
    maxExposureRate: number,
  ): Promise<CatItem> {
    // 1. Obtener todos los reactivos activos de este banco que no han sido administrados
    const items = await this.prisma.catItem.findMany({
      where: {
        bankId,
        isActive: true,
        id: { notIn: excludeItemIds },
      },
    });

    if (items.length === 0) {
      throw new Error('No hay reactivos disponibles en el banco de ítems.');
    }

    // 2. Calcular la información de Fisher para cada reactivo en el nivel theta actual
    const infoItems = items.map(item => ({
      item,
      info: this.calculateFisherInfo(item, theta),
    }));

    // Ordenar descendente por el nivel de información aportado
    infoItems.sort((a, b) => b.info - a.info);

    // Si no está activo el control de exposición, retornamos directamente el mejor ítem
    if (!useExposureControl) {
      return infoItems[0].item;
    }

    // 3. Aplicar control de exposición probabilístico (Sympson-Hetter)
    for (const { item } of infoItems) {
      // Registrar la elegibilidad del ítem (se incrementa timesEligible)
      const exposure = await this.prisma.catItemExposure.upsert({
        where: { itemId_organizationId: { itemId: item.id, organizationId } },
        update: { timesEligible: { increment: 1 } },
        create: {
          itemId: item.id,
          organizationId,
          timesEligible: 1,
          timesAdministered: 0,
        },
      });

      // Calcular tasa de exposición actual con suavizado para evitar división por cero
      const timesEligible = exposure.timesEligible || 1;
      const timesAdministered = exposure.timesAdministered || 0;
      const rate = timesAdministered / timesEligible;

      // Probabilidad de administración: si rate < maxExposureRate se presenta siempre.
      // Si es mayor, la probabilidad se escala inversamente proporcional para penalizarlo.
      const adminProb = rate < maxExposureRate ? 1.0 : Math.max(0.1, maxExposureRate / (rate || 1e-5));

      if (Math.random() < adminProb) {
        // Al seleccionarlo, incrementamos timesAdministered en la base de datos
        await this.prisma.catItemExposure.update({
          where: { itemId_organizationId: { itemId: item.id, organizationId } },
          data: { timesAdministered: { increment: 1 } },
        });

        // Actualizar la tasa de exposición histórica calculada en el registro
        const newAdministered = timesAdministered + 1;
        const newRate = newAdministered / timesEligible;
        await this.prisma.catItemExposure.update({
          where: { itemId_organizationId: { itemId: item.id, organizationId } },
          data: { exposureRate: newRate },
        });

        return item;
      }
    }

    // Fallback: Si todos los mejores fallan el sorteo probabilístico, retornamos el de mayor información
    const fallbackItem = infoItems[0].item;
    try {
      await this.prisma.catItemExposure.upsert({
        where: { itemId_organizationId: { itemId: fallbackItem.id, organizationId } },
        update: { timesAdministered: { increment: 1 }, timesEligible: { increment: 1 } },
        create: {
          itemId: fallbackItem.id,
          organizationId,
          timesEligible: 1,
          timesAdministered: 1,
          exposureRate: 1.0,
        },
      });
    } catch (err) {
      this.logger.warn(`Error al actualizar exposición del ítem de fallback: ${err.message}`);
    }

    return fallbackItem;
  }

  /**
   * Calcula la información de Fisher para un reactivo de 2PL/3PL/4PL en un theta dado.
   */
  private calculateFisherInfo(item: CatItem, theta: number): number {
    const a = item.discrimination;
    const b = item.difficulty;
    const c = item.guessing;
    
    // Modelo logístico de 3 parámetros (3PL):
    // P(theta) = c + (1 - c) * 1 / (1 + exp(-a * (theta - b)))
    const expTerm = Math.exp(-a * (theta - b));
    const P = c + (1.0 - c) / (1.0 + expTerm);
    const Q = 1.0 - P;

    // Fisher Information I(theta) = a^2 * ((P - c)^2 / (1 - c)^2) * (Q / P)
    // Para 2PL (donde c = 0): I(theta) = a^2 * P * Q
    const numerator = Math.pow(P - c, 2) * Q;
    const denominator = Math.pow(1.0 - c, 2) * P;

    if (denominator === 0 || P === 0) return 0;
    return Math.pow(a, 2) * (numerator / denominator);
  }
}
