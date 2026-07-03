import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CatSession, CatItem, CatConfig } from '@prisma/client';
import { ItemSelectorService } from './item-selector.service';
import { ThetaEstimatorService } from './theta-estimator.service';

@Injectable()
export class CatService {
  private readonly logger = new Logger(CatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly itemSelector: ItemSelectorService,
    private readonly thetaEstimator: ThetaEstimatorService,
  ) {}

  /**
   * API pública legacy usada por endpoints psicométricos avanzados.
   * Mantiene la selección delegada al ItemSelectorService para no duplicar lógica CAT.
   */
  async selectNextItem(
    testId: string,
    answeredItemIds: string[] = [],
    currentTheta = 0,
    provisionalSe?: number,
  ): Promise<{ nextItemId: string; shouldStop: boolean; provisionalSe?: number; item: CatItem }> {
    const config = await this.prisma.catConfig.findFirst({
      where: {
        OR: [
          { bankId: testId },
          { bank: { id: testId } },
          { bank: { name: testId } },
        ],
      },
      include: { bank: true },
    });

    if (!config) {
      throw new NotFoundException(`Configuración CAT no encontrada para el test: ${testId}`);
    }

    const shouldStop = answeredItemIds.length >= config.maxItems || (provisionalSe !== undefined && answeredItemIds.length >= config.minItems && provisionalSe <= config.stoppingSe);
    if (shouldStop) {
      return {
        nextItemId: '',
        shouldStop: true,
        provisionalSe,
        item: null as unknown as CatItem,
      };
    }

    const item = await this.itemSelector.selectNextItem(
      config.bankId,
      config.organizationId,
      currentTheta,
      answeredItemIds,
      config.exposureControl,
      config.maxExposureRate,
    );

    return {
      nextItemId: item.id,
      shouldStop: false,
      provisionalSe,
      item,
    };
  }

  /**
   * Inicia una sesión adaptativa computerizada (CAT) para un usuario.
   */
  async startSession(configId: string, userId: string, organizationId: string): Promise<CatSession & { firstItem: CatItem }> {
    const config = await this.prisma.catConfig.findFirst({
      where: { id: configId, organizationId },
    });
    if (!config) {
      throw new NotFoundException(`Configuración CAT no encontrada: ${configId}`);
    }

    // Calcular theta inicial según la configuración prior del puesto
    const initialTheta = await this.getInitialTheta(config, userId);

    // Seleccionar primer ítem de forma segura
    const firstItem = await this.itemSelector.selectNextItem(
      config.bankId,
      organizationId,
      initialTheta,
      [],
      config.exposureControl,
      config.maxExposureRate,
    );

    // Crear la sesión CAT persistiendo el currentItemId activo para validación de seguridad
    const session = await this.prisma.catSession.create({
      data: {
        userId,
        bankId: config.bankId,
        configId: config.id,
        status: 'IN_PROGRESS',
        currentItemId: firstItem.id,
      },
    });

    return {
      ...session,
      firstItem,
    };
  }

  /**
   * Procesa la respuesta de un candidato a un reactivo y devuelve el siguiente reactivo o finaliza.
   */
  async processResponse(
    sessionId: string,
    organizationId: string,
    itemId: string,
    response: string,
    responseTimeMs: number,
  ): Promise<{ completed: boolean; nextItem?: CatItem; finalTheta?: number; finalSe?: number }> {
    const session = await this.prisma.catSession.findUnique({
      where: { id: sessionId },
      include: {
        config: true,
        responses: { orderBy: { position: 'asc' } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Sesión CAT no encontrada: ${sessionId}`);
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Esta sesión adaptativa ya ha finalizado.');
    }

    // 🔬 CONTROL DE SEGURIDAD EXTREMO: Validar que el candidato responda al ítem activo presentado
    if (session.currentItemId !== itemId) {
      throw new BadRequestException('El reactivo enviado no coincide con el reactivo activo de la sesión.');
    }

    const currentItem = await this.prisma.catItem.findUnique({
      where: { id: itemId },
    });
    if (!currentItem) {
      throw new NotFoundException(`Reactivo no encontrado: ${itemId}`);
    }

    const config = session.config;

    // 1. Detectar falta de esfuerzo (Rapid Guessing)
    const isRapid = responseTimeMs < config.rapidGuessingThresholdMs;

    // Obtener estimación de theta actual o prior inicial
    let thetaPrev = 0.0;
    let sePrev = 1.0;
    if (session.responses.length > 0) {
      const lastResponse = session.responses[session.responses.length - 1];
      thetaPrev = lastResponse.thetaAfter ?? 0.0;
      sePrev = lastResponse.seAfter ?? 1.0;
    } else {
      thetaPrev = await this.getInitialTheta(config, session.userId);
    }

    // 2. Estimar nuevo theta mediante EAP
    const isCorrect = this.evaluateCorrectness(currentItem, response);
    let thetaAfter = thetaPrev;
    let seAfter = sePrev;

    if (!isRapid) {
      const eapResult = this.thetaEstimator.estimateEAP(thetaPrev, sePrev, currentItem, isCorrect);
      thetaAfter = eapResult.theta;
      seAfter = eapResult.se;
    } else {
      this.logger.warn(`Respuesta marcada como adivinación rápida en sesión ${sessionId}. Ignorando en theta.`);
    }

    // 3. Registrar respuesta
    const position = session.responses.length + 1;
    await this.prisma.catResponse.create({
      data: {
        sessionId,
        itemId,
        position,
        response,
        isCorrect: currentItem.type === 'cognitive' ? isCorrect : null,
        responseTimeMs,
        rapidGuess: isRapid,
        thetaAfter,
        seAfter,
      },
    });

    // 4. Evaluar criterios de parada
    const validResponsesCount = session.responses.filter(r => !r.rapidGuess).length + (isRapid ? 0 : 1);
    const totalResponsesCount = position;

    const elapsedSeconds = (Date.now() - session.startTime.getTime()) / 1000;
    const timeLimitExceeded = config.maxTimeSeconds ? (elapsedSeconds >= config.maxTimeSeconds) : false;

    // Criterios: longitud máxima, error estándar objetivo, tiempo límite excedido
    const reachedMaxItems = validResponsesCount >= config.maxItems;
    const reachedMinItemsWithPrecision = validResponsesCount >= config.minItems && seAfter <= config.stoppingSe;

    if (reachedMaxItems || reachedMinItemsWithPrecision || timeLimitExceeded) {
      // Finalizar sesión CAT
      const status = timeLimitExceeded ? 'TERMINATED_BY_TIME' : 'COMPLETED';
      await this.prisma.catSession.update({
        where: { id: sessionId },
        data: {
          status,
          endTime: new Date(),
          finalTheta: thetaAfter,
          finalSe: seAfter,
          itemsAdministered: totalResponsesCount,
          currentItemId: null, // Limpiar reactivo activo
          log: {
            validItems: validResponsesCount,
            totalItems: totalResponsesCount,
            elapsedSeconds,
            finalTheta: thetaAfter,
            finalSe: seAfter,
          },
        },
      });

      return {
        completed: true,
        finalTheta: thetaAfter,
        finalSe: seAfter,
      };
    }

    // 5. Seleccionar siguiente reactivo si no ha finalizado
    const excludedIds = session.responses.map(r => r.itemId).concat(itemId);
    
    // Si se permite compensar adivinaciones rápidas añadiendo reactivos extras, aumentamos la tolerancia
    const targetTheta = thetaAfter;
    const nextItem = await this.itemSelector.selectNextItem(
      session.bankId,
      organizationId,
      targetTheta,
      excludedIds,
      config.exposureControl,
      config.maxExposureRate,
    );

    // Actualizar reactivo activo en la sesión para el siguiente ciclo
    await this.prisma.catSession.update({
      where: { id: sessionId },
      data: {
        currentItemId: nextItem.id,
      },
    });

    return {
      completed: false,
      nextItem,
    };
  }

  /**
   * Evalúa si una respuesta cognitiva es correcta comparándola con correctAnswer.
   */
  private evaluateCorrectness(item: CatItem, response: string): boolean {
    const content = item.content as any;
    if (!content || !content.correctAnswer) return false;
    return String(content.correctAnswer).trim().toLowerCase() === String(response).trim().toLowerCase();
  }

  /**
   * Obtiene la habilidad inicial según el perfil de puesto del usuario o nivel educativo.
   */
  private async getInitialTheta(config: CatConfig, userId: string): Promise<number> {
    if (config.firstItemMethod === 'PRIOR_JOB_PROFILE') {
      // Intentar resolver perfil
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tipoPuesto: true },
      });
      if (user?.tipoPuesto) {
        if (user.tipoPuesto.toLowerCase().includes('gerente') || user.tipoPuesto.toLowerCase().includes('director')) {
          return 0.5; // Mayor theta inicial para cargos altos
        }
      }
    } else if (config.firstItemMethod === 'PRIOR_EDUCATION') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { nivelEducativo: true },
      });
      if (user?.nivelEducativo) {
        if (user.nivelEducativo.toLowerCase().includes('universitario') || user.nivelEducativo.toLowerCase().includes('posgrado')) {
          return 0.3;
        }
      }
    }
    return 0.0; // PRIOR_MEDIUM por defecto
  }
}
