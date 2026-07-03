import { Injectable, Logger } from '@nestjs/common';
import { CatItem } from '@prisma/client';

@Injectable()
export class ThetaEstimatorService {
  private readonly logger = new Logger(ThetaEstimatorService.name);

  // Nodos estándar de cuadratura Gauss-Hermite para N=41 optimizados para EAP
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

  /**
   * Estima el nuevo theta y error estándar usando Esperanza A Posteriori (EAP)
   * secuencial dado el prior actual (mu = theta anterior, sigma = SE anterior)
   * y la respuesta al reactivo administrado.
   */
  estimateEAP(
    mu: number,
    sigma: number,
    item: CatItem,
    isCorrect: boolean,
  ): { theta: number; se: number } {
    const a = item.discrimination;
    const b = item.difficulty;
    const c = item.guessing;

    let numerator = 0.0;
    let denominator = 0.0;
    const priorSD = Math.max(0.1, sigma); // Evitar desviación estándar cero

    // Integración numérica mediante los 41 puntos de cuadratura Gauss-Hermite
    for (const node of this.QUADRATURE_POINTS) {
      // Escalamiento al prior actual
      const thetaK = node.x * Math.sqrt(2); 

      // Probabilidad de respuesta correcta según el modelo IRT (3PL)
      const expTerm = Math.exp(-a * (thetaK - b));
      const P = c + (1.0 - c) / (1.0 + expTerm);
      
      // Verosimilitud (Likelihood) de la respuesta observada
      const likelihood = isCorrect ? P : (1.0 - P);

      // Prior densidad normal N(mu, sigma^2)
      const exponent = -0.5 * Math.pow((thetaK - mu) / priorSD, 2);
      const prior = (1.0 / (Math.sqrt(2.0 * Math.PI) * priorSD)) * Math.exp(exponent);

      // Peso posterior
      const weight = likelihood * prior * node.w;

      numerator += thetaK * weight;
      denominator += weight;
    }

    const thetaPost = denominator > 0 ? (numerator / denominator) : mu;

    // Calcular varianza posterior
    let varNumerator = 0.0;
    for (const node of this.QUADRATURE_POINTS) {
      const thetaK = node.x * Math.sqrt(2);

      const expTerm = Math.exp(-a * (thetaK - b));
      const P = c + (1.0 - c) / (1.0 + expTerm);
      const likelihood = isCorrect ? P : (1.0 - P);

      const exponent = -0.5 * Math.pow((thetaK - mu) / priorSD, 2);
      const prior = (1.0 / (Math.sqrt(2.0 * Math.PI) * priorSD)) * Math.exp(exponent);

      const weight = likelihood * prior * node.w;

      varNumerator += Math.pow(thetaK - thetaPost, 2) * weight;
    }

    const varPost = denominator > 0 ? (varNumerator / denominator) : Math.pow(mu, 2);
    const sePost = Math.sqrt(Math.max(0.01, varPost)); // Acotar error estándar mínimo

    return {
      theta: Math.round(thetaPost * 1000) / 1000,
      se: Math.round(sePost * 1000) / 1000,
    };
  }
}
