import { useEffect, useState, useRef } from 'react';

interface UseSecureTimerProps {
  initialServerTimeMs: number; // Hora del servidor al cargar la página
  endTimeMs: number;           // Hora absoluta de finalización del examen
  onTimeUp: () => void;        // Callback al expirar el tiempo
  onTamperDetected?: () => void; // Alerta de cambio de reloj local
}

export function useSecureTimer({
  initialServerTimeMs,
  endTimeMs,
  onTimeUp,
  onTamperDetected,
}: UseSecureTimerProps) {
  // Segundos restantes iniciales basados en la sincronización inicial con el servidor
  const calculateInitialSeconds = () => {
    const diff = Math.floor((endTimeMs - initialServerTimeMs) / 1000);
    return Math.max(0, diff);
  };

  const [remainingSeconds, setRemainingSeconds] = useState(calculateInitialSeconds);

  // Referencias para controlar el reloj monotónico vs el reloj de sistema
  const performanceStartRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const systemStartRef = useRef<number>(Date.now());
  const onTimeUpRef = useRef(onTimeUp);
  const onTamperRef = useRef(onTamperDetected);

  // Mantener los callbacks actualizados sin reiniciar el intervalo
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTamperRef.current = onTamperDetected;
  }, [onTimeUp, onTamperDetected]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      onTimeUpRef.current();
      return;
    }

    const intervalId = setInterval(() => {
      // 1. Obtener tiempo transcurrido monotónico (resistente a cambios en el reloj del sistema)
      const monotonicElapsedMs = performance.now() - performanceStartRef.current;
      const monotonicElapsedSec = Math.floor(monotonicElapsedMs / 1000);

      // 2. Obtener tiempo transcurrido del reloj del sistema (manipulable por el usuario)
      const systemElapsedMs = Date.now() - systemStartRef.current;
      const systemElapsedSec = Math.floor(systemElapsedMs / 1000);

      // 3. DETECCION DE FRAUDE/MANIPULACIÓN:
      // Si la diferencia entre el tiempo medido por el reloj de hardware (monotónico)
      // y el reloj del sistema supera los 3 segundos, asumimos manipulación del reloj local.
      const drift = Math.abs(systemElapsedSec - monotonicElapsedSec);
      if (drift > 3) {
        console.warn(`[DETECTOR DE FRAUDE] Desviación de reloj detectada: ${drift}s. Ejecutando salvaguardas.`);
        if (onTamperRef.current) {
          onTamperRef.current();
        }
        clearInterval(intervalId);
        return;
      }

      // 4. Calcular los segundos restantes reales a partir del reloj monotónico de confianza
      const initialSeconds = Math.floor((endTimeMs - initialServerTimeMs) / 1000);
      const nextRemaining = Math.max(0, initialSeconds - monotonicElapsedSec);

      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 0) {
        clearInterval(intervalId);
        onTimeUpRef.current();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [initialServerTimeMs, endTimeMs, remainingSeconds]);

  // Formatear tiempo en HH:MM:SS
  const formatTime = () => {
    const hrs = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;
    
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  return {
    remainingSeconds,
    formattedTime: formatTime(),
    isExpired: remainingSeconds <= 0,
  };
}
