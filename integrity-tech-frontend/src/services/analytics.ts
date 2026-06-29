/**
 * Servicio de Analíticas de Uso unificado para Integrity-Tech.
 * Emula la integración con herramientas como PostHog o Segment
 * para recopilar métricas de Product-Market Fit sin introducir dependencias pesadas.
 */
export class AnalyticsService {
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Envía un evento de tracking a las herramientas de analítica.
   * @param eventName Nombre del evento (ej: 'assessment_started')
   * @param properties Propiedades adicionales contextuales
   */
  track(eventName: string, properties: Record<string, any> = {}) {
    const payload = {
      eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'ssr',
      },
    };

    // En desarrollo local mostramos los eventos en consola con colores para visibilidad inmediata del Feedback Loop
    console.log(
      `%c[PostHog/Segment] 📊 Evento Registrado: ${eventName}`,
      'background: #111827; color: #10B981; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      payload.properties
    );

    if (this.isProduction) {
      // Aquí se conectaría la integración real:
      // window.posthog.capture(eventName, properties);
      // u window.analytics.track(eventName, properties);
    }
  }
}

export const analyticsService = new AnalyticsService();
