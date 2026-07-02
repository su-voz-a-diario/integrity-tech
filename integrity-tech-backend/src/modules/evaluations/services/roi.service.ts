import { Injectable, Logger } from '@nestjs/common';

export interface RoiInputDto {
  contratacionesAnuales: number; // N
  permanenciaMediaAnos: number; // T
  coeficienteValidez: number; // r_xy (validez predictiva del test, ej: 0.35)
  salarioMedioAnual: number; // Usado para estimar SD_y (típicamente 40% del salario)
  tasaSeleccion: number; // Selection Ratio (ej: 0.20 para el top 20% de candidatos)
  costoPorCandidato: number; // Costo unitario de la prueba
  totalCandidatosEvaluados: number; // Total de postulantes evaluados al año
}

@Injectable()
export class RoiService {
  private readonly logger = new Logger(RoiService.name);

  /**
   * Calcula el ROI del talento utilizando el modelo de utilidad económica Brogden-Cronbach-Gleser (BCG).
   * Formula: Delta U = N * T * r_xy * SD_y * Z_x - CostoTotal
   */
  calculateROI(dto: RoiInputDto): any {
    const N = dto.contratacionesAnuales;
    const T = dto.permanenciaMediaAnos;
    const r_xy = dto.coeficienteValidez;
    
    // SD_y: Desviación estándar del desempeño en términos económicos (Schmidt & Hunter, 1983)
    // Típicamente estimado como el 40% del salario medio anual del puesto
    const SD_y = dto.salarioMedioAnual * 0.40;

    // Z_x: Intensidad de selección (diferencial medio en puntajes del test de los seleccionados)
    // Se deriva de la tasa de selección (selection ratio) usando la altura de la distribución normal
    const Z_x = this.getSelectionIntensity(dto.tasaSeleccion);

    // Beneficio bruto (Productivity Gain)
    const beneficioBruto = N * T * r_xy * SD_y * Z_x;

    // Costo total de evaluación
    const costoTotal = dto.totalCandidatosEvaluados * dto.costoPorCandidato;

    // Utilidad neta (ROI Neto)
    const utilidadNeta = beneficioBruto - costoTotal;

    // Retorno de inversión en porcentaje
    const roiPorcentaje = costoTotal > 0 ? (utilidadNeta / costoTotal) * 100 : 0;

    return {
      desviacionDesempenoMonetario: Math.round(SD_y * 100) / 100,
      intensidadSeleccionZx: Math.round(Z_x * 1000) / 1000,
      beneficioBrutoAnual: Math.round(beneficioBruto * 100) / 100,
      costoTotalEvaluacion: Math.round(costoTotal * 100) / 100,
      utilidadNetaAcumulada: Math.round(utilidadNeta * 100) / 100,
      retornoInversionPorcentaje: Math.round(roiPorcentaje * 100) / 100,
      relacionCostoBeneficio: costoTotal > 0 ? Math.round((beneficioBruto / costoTotal) * 10) / 10 : 0,
    };
  }

  /**
   * Obtiene la ordenada de la distribución normal Z_x correspondiente al Selection Ratio (SR)
   * Z_x = phi(z_cutoff) / SR
   */
  private getSelectionIntensity(selectionRatio: number): number {
    const sr = Math.max(0.001, Math.min(0.999, selectionRatio));
    
    // Aproximación de la inversa de la normal para encontrar el punto de corte z_cutoff
    const z_cutoff = this.approximateNormalInverse(1.0 - sr);
    
    // phi(z_cutoff): Altura de la curva normal en el punto de corte
    const phi = (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * (z_cutoff ** 2));
    
    return phi / sr;
  }

  private approximateNormalInverse(p: number): number {
    // Fórmulas de aproximación racional para la inversa de la CDF normal estándar (Wichura, 1988)
    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;

    if (p < 0.5) {
      const t = Math.sqrt(-2.0 * Math.log(p));
      return -(t - ((c0 + c1 * t + c2 * (t ** 2)) / (1.0 + d1 * t + d2 * (t ** 2) + d3 * (t ** 3))));
    } else {
      const t = Math.sqrt(-2.0 * Math.log(1.0 - p));
      return t - ((c0 + c1 * t + c2 * (t ** 2)) / (1.0 + d1 * t + d2 * (t ** 2) + d3 * (t ** 3)));
    }
  }
}
