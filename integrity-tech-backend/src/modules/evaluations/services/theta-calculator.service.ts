import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../shared/database/prisma.service';
import { RapidGuessingService } from './rapid-guessing.service';

export interface ItemResponsePattern {
  itemId: string;
  response: number; // 0 o 1 para 2PL; 0, 1, 2, 3, 4 para GRM (Likert 5 puntos)
  tiempoMs?: number;
}

@Injectable()
export class ThetaCalculatorService implements OnModuleInit {
  private readonly logger = new Logger(ThetaCalculatorService.name);
  
  // Caché local en memoria de parámetros de ítems
  private parameterCache = new Map<string, any[]>();

  // Nodos estándar de cuadratura Gauss-Hermite para N=41 obtenidos mediante numpy.polynomial.hermite.hermgauss(41)
  // Nota: Para la estimación en el espacio theta (con prior N(0,1)), la abscisa de la cuadrícula es theta_j = x_j * sqrt(2)
  private readonly QUADRATURE_POINTS = [
    { x: -8.21300090, w: 9.387994849202574e-30 },
    { x: -7.52894546, w: 2.1158586395982885e-25 },
    { x: -6.96035840, w: 1.1578351508200676e-21 },
    { x: -6.45098460, w: 2.3781297746197172e-18 },
    { x: -5.97936500, w: 2.4578148962386923e-15 },
    { x: -5.53444134, w: 1.4027734139886367e-12 },
    { x: -5.10956963, w: 4.887204481232822e-10 },
    { x: -4.70035690, w: 1.0583344607736636e-7 },
    { x: -4.30369877, w: 0.0000145229783935 },
    { x: -3.91728985, w: 0.0001278149818817 },
    { x: -3.53934994, w: 0.0007412586716075 },
    { x: -3.16845945, w: 0.0030045437877209 },
    { x: -2.80345496, w: 0.0090710609383675 },
    { x: -2.44335955, w: 0.0203597473523588 },
    { x: -2.08733468, w: 0.0340321287955562 },
    { x: -1.73464561, w: 0.0424564887372798 },
    { x: -1.38463579, w: 0.0395353597463777 },
    { x: -1.03670725, w: 0.0274151743128913 },
    { x: -0.69030505, w: 0.0141641324707172 },
    { x: -0.34490446, w: 0.0054238561706692 },
    { x: 0.00000000, w: 0.0015383569612349 },
    { x: 0.34490446, w: 0.0054238561706692 },
    { x: 0.69030505, w: 0.0141641324707172 },
    { x: 1.03670725, w: 0.0274151743128913 },
    { x: 1.38463579, w: 0.0395353597463777 },
    { x: 1.73464561, w: 0.0424564887372798 },
    { x: 2.08733468, w: 0.0340321287955562 },
    { x: 2.44335955, w: 0.0203597473523588 },
    { x: 2.80345496, w: 0.0090710609383675 },
    { x: 3.16845945, w: 0.0030045437877209 },
    { x: 3.53934994, w: 0.0007412586716075 },
    { x: 3.91728985, w: 0.0001278149818817 },
    { x: 4.30369877, w: 0.0000145229783935 },
    { x: 4.70035690, w: 1.0583344607736636e-7 },
    { x: 5.10956963, w: 4.887204481232822e-10 },
    { x: 5.53444134, w: 1.4027734139886367e-12 },
    { x: 5.97936500, w: 2.4578148962386923e-15 },
    { x: 6.45098460, w: 2.3781297746197172e-18 },
    { x: 6.96035840, w: 1.1578351508200676e-21 },
    { x: 7.52894546, w: 2.1158586395982885e-25 },
    { x: 8.21300090, w: 9.387994849202574e-30 },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly rapidGuessing: RapidGuessingService,
  ) {}

  async onModuleInit() {
    await this.loadAllParameters();
  }

  @Cron('0 */30 * * * *') // Cada 30 minutos
  async handleCacheCron() {
    this.logger.log('Refrescando caché de parámetros psicométricos por cron periódico...');
    await this.loadAllParameters();
  }

  /**
   * Carga todos los parámetros desde la base de datos a la caché en memoria.
   */
  async loadAllParameters() {
    try {
      const allParams = await this.prisma.parametrosItems.findMany({
        where: { activo: true },
      });
      const tempMap = new Map<string, any[]>();
      for (const p of allParams) {
        const cacheKey = `${p.organizationId}:${p.testId}`;
        const arr = tempMap.get(cacheKey) || [];
        arr.push(p);
        tempMap.set(cacheKey, arr);
      }
      this.parameterCache = tempMap;
      this.logger.log(`Parámetros de ítems cargados en caché. Test indexados: ${tempMap.size}`);
    } catch (err) {
      this.logger.error(`Error al precargar parámetros psicométricos en caché: ${err.message}`);
    }
  }

  /**
   * Invalida la caché de parámetros y fuerza su recarga. Debe llamarse tras una recalibración.
   */
  async clearCache() {
    await this.loadAllParameters();
    this.logger.log('Caché de parámetros de ítems invalidada y recargada de forma explícita.');
  }

  /**
   * Estima el nivel de habilidad latente (theta) de un candidato
   * utilizando la estimación de Esperanza A Posteriori (EAP).
   */
  async calcularTheta(testId: string, respuestas: ItemResponsePattern[], organizationId?: string): Promise<{ theta: number; error: number; thetaT: number; thetaCi: number; engagement: number }> {
    const start = Date.now();
    
    if (respuestas.length === 0) {
      throw new BadRequestException(`No existen respuestas reales para calcular theta del test ${testId}.`);
    }

    // 1. Obtener los parámetros de los ítems (desde caché o base de datos)
    const cacheKey = organizationId ? `${organizationId}:${testId}` : testId;
    let dbParams = this.parameterCache.get(cacheKey);
    if (!dbParams) {
      dbParams = await this.prisma.parametrosItems.findMany({
        where: { testId, activo: true, ...(organizationId ? { organizationId } : {}) },
      });
      this.parameterCache.set(cacheKey, dbParams);
    }

    // Mapear a una estructura en memoria indexada por itemId para velocidad de búsqueda
    const paramsMap = new Map<string, any>();
    for (const p of dbParams) {
      paramsMap.set(p.itemId, p);
    }

    // Consultar el tipo de pregunta para el filtrado de tiempos
    const questionIds = respuestas.map(r => r.itemId);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, type: true },
    });
    const questionTypeMap = new Map(questions.map(q => [q.id, q.type]));

    // 2. Filtrar respuestas válidas y clasificar rapid guessing
    let effortItemsCount = 0;
    const itemsValidos = respuestas
      .filter(r => paramsMap.has(r.itemId) && r.response !== null && r.response !== undefined)
      .map(r => {
        const p = paramsMap.get(r.itemId);
        const qType = questionTypeMap.get(r.itemId) || 'Global';
        
        // Clasificar
        const classification = this.rapidGuessing.classify(testId, qType, r.tiempoMs ?? null);
        const isSolution = classification === 'solution';
        if (isSolution) {
          effortItemsCount++;
        }

        const thresholds: number[] = [];
        if (p.modelo === 'GRM') {
          if (p.parametroC1 !== null) thresholds.push(p.parametroC1);
          if (p.parametroC2 !== null) thresholds.push(p.parametroC2);
          if (p.parametroC3 !== null) thresholds.push(p.parametroC3);
          if (p.parametroC4 !== null) thresholds.push(p.parametroC4);
        }
        return {
          itemId: r.itemId,
          modelo: p.modelo as '2PL' | 'GRM',
          a: p.parametroA,
          b: p.parametroB ?? 0.0,
          thresholds,
          response: r.response,
          isSolution,
        };
      });

    if (itemsValidos.length === 0) {
      this.logger.warn(`No se encontraron parámetros calibrados para el test ${testId}.`);
      throw new BadRequestException(`No existen parámetros calibrados reales para calcular theta del test ${testId}.`);
    }

    const totalItems = itemsValidos.length;
    const engagement = totalItems > 0 ? (effortItemsCount / totalItems) : 1.0;

    // 3. Ejecutar cuadratura numérica Gauss-Hermite
    const logLikelihoods = new Array(this.QUADRATURE_POINTS.length).fill(0);
    const thetas = new Array(this.QUADRATURE_POINTS.length).fill(0);

    for (let j = 0; j < this.QUADRATURE_POINTS.length; j++) {
      const q = this.QUADRATURE_POINTS[j];
      const theta = q.x * Math.sqrt(2); // Escalar al prior N(0,1)
      thetas[j] = theta;

      let logL = 0.0;
      for (const item of itemsValidos) {
        if (!item.isSolution) {
          // Wise & DeMars (2006) effort-moderated: ignoramos respuestas de rapid guessing
          continue;
        }
        const prob = this.evaluarProbabilidadItem(item, theta);
        logL += Math.log(Math.max(prob, 1e-12));
      }
      logLikelihoods[j] = logL;
    }

    // Prevención de subdesbordamiento numérico restando el log-likelihood máximo
    const maxLogL = Math.max(...logLikelihoods);
    
    let sumNum = 0.0;
    let sumDen = 0.0;

    for (let j = 0; j < this.QUADRATURE_POINTS.length; j++) {
      const q = this.QUADRATURE_POINTS[j];
      const theta = thetas[j];
      const likelihood = Math.exp(logLikelihoods[j] - maxLogL);
      const postWeight = likelihood * q.w;

      sumNum += theta * postWeight;
      sumDen += postWeight;
    }

    const thetaEstRaw = sumDen > 0 ? (sumNum / sumDen) : 0.0;
    
    // Aplicar coeficientes de equiparación psicométrica (Test Equating)
    let equatedTheta = thetaEstRaw;
    if (organizationId) {
      try {
        const coef = await this.prisma.equatingCoefficients.findFirst({
          where: { organizationId, testId },
          orderBy: { fechaCreacion: 'desc' },
        });
        if (coef) {
          equatedTheta = Number(coef.coeficienteA) * thetaEstRaw + Number(coef.coeficienteB);
          this.logger.log(`Aplicada equiparación (Test Equating) para ${testId}: theta ajustado de ${thetaEstRaw.toFixed(3)} a ${equatedTheta.toFixed(3)} (A=${coef.coeficienteA}, B=${coef.coeficienteB})`);
        }
      } catch (err) {
        this.logger.warn(`Error al consultar equating_coefficients para ${testId}: ${err.message}`);
      }
    }

    const thetaEst = Math.min(4.0, Math.max(-4.0, equatedTheta));

    // Calcular desviación estándar posterior (error de estimación)
    let sumNum2 = 0.0;
    for (let j = 0; j < this.QUADRATURE_POINTS.length; j++) {
      const q = this.QUADRATURE_POINTS[j];
      const theta = thetas[j];
      const likelihood = Math.exp(logLikelihoods[j] - maxLogL);
      const postWeight = likelihood * q.w;

      sumNum2 += Math.pow(theta - thetaEst, 2) * postWeight;
    }

    const posteriorVar = sumDen > 0 ? (sumNum2 / sumDen) : 1.0;
    const errorEst = Math.sqrt(posteriorVar);

    const duration = Date.now() - start;
    const thetaFinal = Math.round(thetaEst * 1000) / 1000;
    const errorFinal = Math.round(errorEst * 1000) / 1000;
    
    const thetaT = Math.round((50.0 + 10.0 * thetaFinal) * 1000) / 1000;
    const thetaCi = Math.round((100.0 + 15.0 * thetaFinal) * 1000) / 1000;

    this.logger.log(`Theta calculado (effort-moderated): ${thetaFinal} (T: ${thetaT}, CI: ${thetaCi}) | Error: ${errorFinal} | Engagement: ${(engagement * 100).toFixed(0)}% | Items: ${itemsValidos.length} | Tiempo: ${duration}ms`);

    return {
      theta: thetaFinal,
      error: errorFinal,
      thetaT,
      thetaCi,
      engagement: Math.round(engagement * 10000) / 10000,
    };
  }

  /**
   * Calcula la probabilidad de obtener una respuesta específica dado un theta.
   */
  private evaluarProbabilidadItem(item: any, theta: number): number {
    if (item.modelo === '2PL') {
      const exponente = -item.a * (theta - item.b);
      const probCorrecto = 1.0 / (1.0 + Math.exp(exponente));
      const prob = item.response === 1 ? probCorrecto : (1.0 - probCorrecto);
      return Math.max(prob, 1e-15);
    } else {
      // Modelo de Respuesta Graduada (GRM) de Samejima
      const thresholds = item.thresholds;
      const m = thresholds.length; // Número de cortes (categorías - 1)
      
      // Asegurar que la respuesta es un entero entre 0 y m
      const category = Math.max(0, Math.min(m, Math.round(item.response)));
      
      // Calcular probabilidades acumuladas P*_k(theta)
      const cumProbs = new Array(m + 2);
      cumProbs[0] = 1.0; // P*_0 = 1
      for (let k = 0; k < m; k++) {
        cumProbs[k + 1] = 1.0 / (1.0 + Math.exp(-item.a * (theta - thresholds[k])));
      }
      cumProbs[m + 1] = 0.0; // P*_{m+1} = 0

      // P_k = P*_k - P*_{k+1}
      const p = cumProbs[category] - cumProbs[category + 1];
      return Math.max(p, 1e-15);
    }
  }

  /**
   * Evalúa la probabilidad de respuesta para un ítem en un theta específico con una categoría dada.
   */
  public evaluarProbabilidadItemAtTheta(item: any, theta: number, response: number): number {
    const tempItem = {
      ...item,
      a: item.parametroA,
      b: item.parametroB ?? 0.0,
      thresholds: [item.parametroC1, item.parametroC2, item.parametroC3, item.parametroC4].filter(t => t !== null && t !== undefined),
      response
    };
    return this.evaluarProbabilidadItem(tempItem, theta);
  }

  /**
   * Calcula la curva de información del test (TIF) y el error estándar condicional.
   */
  async getTestInformation(testId: string, organizationId?: string): Promise<{ theta: number; information: number; se: number | null }[]> {
    const cacheKey = organizationId ? `${organizationId}:${testId}` : testId;
    let params = this.parameterCache.get(cacheKey);
    if (!params) {
      params = await this.prisma.parametrosItems.findMany({
        where: { testId, ...(organizationId ? { organizationId } : {}) },
      });
      this.parameterCache.set(cacheKey, params);
    }

    const thetaRange = Array.from({ length: 61 }, (_, i) => -3 + i * 0.1); // -3.0 a 3.0, paso 0.1

    return thetaRange.map(theta => {
      let info = 0.0;
      for (const item of params) {
        if (item.modelo === '2PL') {
          const exponente = -item.parametroA * (theta - (item.parametroB ?? 0.0));
          const p = 1.0 / (1.0 + Math.exp(exponente));
          const q = 1.0 - p;
          info += item.parametroA ** 2 * p * q;
        } else { // GRM
          const thresholds: number[] = [item.parametroC1, item.parametroC2, item.parametroC3, item.parametroC4].filter(t => t !== null && t !== undefined);
          const delta = 0.001;
          let info_item = 0.0;
          for (let k = 0; k <= thresholds.length; k++) {
            const prob = this.evaluarProbabilidadItemAtTheta(item, theta, k);
            if (prob > 1e-10) {
              const probPlus = this.evaluarProbabilidadItemAtTheta(item, theta + delta, k);
              const probMinus = this.evaluarProbabilidadItemAtTheta(item, theta - delta, k);
              const deriv = (probPlus - probMinus) / (2.0 * delta);
              info_item += (deriv ** 2) / prob;
            }
          }
          info += info_item;
        }
      }
      return {
        theta: Math.round(theta * 10) / 10,
        information: Math.round(info * 1000) / 1000,
        se: info > 0.001 ? Math.round((1.0 / Math.sqrt(info)) * 1000) / 1000 : null,
      };
    });
  }

  /**
   * Calcula la fiabilidad marginal del test (basada en la Teoría de Respuesta al Ítem)
   * integrando la función de información contra el prior normal estándar.
   */
  async computeMarginalReliability(testId: string, organizationId?: string): Promise<number> {
    const cacheKey = organizationId ? `${organizationId}:${testId}` : testId;
    let params = this.parameterCache.get(cacheKey);
    if (!params) {
      params = await this.prisma.parametrosItems.findMany({
        where: { testId, ...(organizationId ? { organizationId } : {}) },
      });
      this.parameterCache.set(cacheKey, params);
    }
    
    if (params.length === 0) return 0.0;

    let totalVarTheta = 0.0;
    let expectedErrorVar = 0.0;
    let den = 0.0;
    const priorMean = 0.0;

    for (const gh of this.QUADRATURE_POINTS) {
      const theta = gh.x * Math.sqrt(2);
      const w = gh.w;
      const prior = w; // Los QUADRATURE_POINTS ya están ponderados y escalados para el prior normal estándar

      let info = 0.0;
      for (const item of params) {
        if (item.modelo === '2PL') {
          const exponente = -item.parametroA * (theta - (item.parametroB ?? 0.0));
          const p = 1.0 / (1.0 + Math.exp(exponente));
          const q = 1.0 - p;
          info += item.parametroA ** 2 * p * q;
        } else { // GRM
          const thresholds: number[] = [item.parametroC1, item.parametroC2, item.parametroC3, item.parametroC4].filter(t => t !== null && t !== undefined);
          const delta = 0.001;
          let info_item = 0.0;
          for (let k = 0; k <= thresholds.length; k++) {
            const prob = this.evaluarProbabilidadItemAtTheta(item, theta, k);
            if (prob > 1e-10) {
              const probPlus = this.evaluarProbabilidadItemAtTheta(item, theta + delta, k);
              const probMinus = this.evaluarProbabilidadItemAtTheta(item, theta - delta, k);
              const deriv = (probPlus - probMinus) / (2.0 * delta);
              info_item += (deriv ** 2) / prob;
            }
          }
          info += info_item;
        }
      }

      const se2 = info > 0.001 ? (1.0 / info) : 10.0; // cota para evitar varianzas de error infinitas
      totalVarTheta += (theta - priorMean) ** 2 * prior;
      expectedErrorVar += se2 * prior;
      den += prior;
    }

    const varTheta = den > 0.0 ? (totalVarTheta / den) : 1.0;
    const avgErrorVar = den > 0.0 ? (expectedErrorVar / den) : 1.0;
    const rel = varTheta / (varTheta + avgErrorVar);
    return Math.round(Math.max(0.0, Math.min(0.999, rel)) * 1000) / 1000;
  }

  /**
   * Obtiene los parámetros de ítems para un test_id cargados en caché.
   */
  async getCachedParameters(testId: string, organizationId?: string): Promise<any[]> {
    const cacheKey = organizationId ? `${organizationId}:${testId}` : testId;
    let params = this.parameterCache.get(cacheKey);
    if (!params || params.length === 0) {
      params = await this.prisma.parametrosItems.findMany({
        where: { testId, activo: true, ...(organizationId ? { organizationId } : {}) },
      });
      if (params.length > 0) {
        this.parameterCache.set(cacheKey, params);
      }
    }
    return params || [];
  }
}
