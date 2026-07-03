import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class AdverseImpactService {
  private readonly logger = new Logger(AdverseImpactService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula el Impacto Adverso (Regla del 80%) para un test psicométrico determinado,
   * comparando las tasas de selección (porcentaje arriba del percentil 50 de la población) 
   * entre diferentes grupos demográficos (por país).
   */
  async calculateAdverseImpact(testId: string): Promise<any> {
    // 1. Obtener todos los resultados de este test
    const resultados = await this.prisma.resultadoTest.findMany({
      where: { testId, irtCalculated: true },
      include: {
        attempt: true,
      },
    });

    if (resultados.length === 0) {
      return {
        testId,
        mensaje: 'No hay suficientes datos calculados para realizar el estudio de Impacto Adverso.',
        grupos: [],
      };
    }

    // 2. Consultar los usuarios asociados para obtener sus países
    const userIds = Array.from(new Set(resultados.map(r => r.attempt.userId)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pais: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // 3. Agrupar por país
    const groupsMap = new Map<string, number[]>();
    const totalThetas: number[] = [];

    for (const r of resultados) {
      if (r.theta === null || r.theta === undefined) continue;
      const user = userMap.get(r.attempt.userId);
      const pais = user?.pais || 'Global';
      const theta = Number(r.theta);
      totalThetas.push(theta);

      const list = groupsMap.get(pais) || [];
      list.push(theta);
      groupsMap.set(pais, list);
    }

    if (totalThetas.length === 0) {
      return {
        testId,
        mensaje: 'No hay suficientes thetas reales para realizar el estudio de Impacto Adverso.',
        grupos: [],
      };
    }

    // 4. Determinar el umbral de selección (usamos la mediana global de theta)
    totalThetas.sort((a, b) => a - b);
    const medianTheta = totalThetas[Math.floor(totalThetas.length / 2)];

    // 5. Calcular tasa de selección para cada grupo
    const groupsList: any[] = [];
    let referenceGroup: any = null;
    let maxSelectionRate = -1.0;

    for (const [pais, thetas] of groupsMap.entries()) {
      const sampleSize = thetas.length;
      if (sampleSize < 1) continue; // Muestra mínima

      const selectedCount = thetas.filter(t => t >= medianTheta).length;
      const selectionRate = selectedCount / sampleSize;

      const groupData = {
        grupo: pais,
        muestra: sampleSize,
        seleccionados: selectedCount,
        tasaSeleccion: selectionRate,
      };

      groupsList.push(groupData);

      // El grupo de referencia es el que tiene la tasa de selección más alta (grupo mayoritario/ventajoso)
      if (selectionRate > maxSelectionRate) {
        maxSelectionRate = selectionRate;
        referenceGroup = groupData;
      }
    }

    // 6. Calcular la Tasa de Impacto Adverso (AIR) comparando cada grupo con el de referencia
    const impactResults = groupsList.map(g => {
      const air = referenceGroup && referenceGroup.tasaSeleccion > 0.0
        ? (g.tasaSeleccion / referenceGroup.tasaSeleccion)
        : 1.0;

      // La regla de la EEOC (Regla del 80%) establece que un AIR < 0.80 indica posible impacto adverso
      const tieneImpactoAdverso = air < 0.80;

      return {
        ...g,
        tasaImpactoAdverso: Math.round(air * 1000) / 1000,
        alertaImpactoAdverso: tieneImpactoAdverso,
      };
    });

    // 7. Cargar flags de DIF asociados para complementar el análisis
    const difFlags = await this.prisma.parametrosItems.findMany({
      where: { testId, flagDif: true },
      select: { itemId: true },
    });

    return {
      testId,
      tasaMedianaReferencia: medianTheta,
      grupoReferencia: referenceGroup ? referenceGroup.grupo : 'Global',
      impactoAdversoDetectado: impactResults.some(r => r.alertaImpactoAdverso),
      analisisGrupos: impactResults,
      itemsSesgadosDIF: difFlags.map(f => f.itemId),
    };
  }
}
