import React, { useEffect, useRef } from 'react';

interface SecureTimerViewProps {
  initialServerTimeMs: number;
  endTimeMs: number;
  onTimeUp: () => void;
  onTamperDetected?: () => void;
}

export const SecureTimerView: React.FC<SecureTimerViewProps> = ({
  initialServerTimeMs,
  endTimeMs,
  onTimeUp,
  onTamperDetected,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  
  // Guardamos las referencias de los callbacks para evitar reiniciar el intervalo al cambiar los props
  const onTimeUpRef = useRef(onTimeUp);
  const onTamperRef = useRef(onTamperDetected);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTamperRef.current = onTamperDetected;
  }, [onTimeUp, onTamperDetected]);

  useEffect(() => {
    const performanceStart = performance.now();
    const systemStart = Date.now();

    const format = (seconds: number) => {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      return [
        hrs.toString().padStart(2, '0'),
        mins.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
      ].join(':');
    };

    const intervalId = setInterval(() => {
      // 1. Reloj monotónico (hardware)
      const monotonicElapsedSec = Math.floor((performance.now() - performanceStart) / 1000);
      
      // 2. Reloj del sistema (manipulable)
      const systemElapsedSec = Math.floor((Date.now() - systemStart) / 1000);

      // 3. Detección de fraude horaria
      const drift = Math.abs(systemElapsedSec - monotonicElapsedSec);
      if (drift > 3) {
        console.warn(`[SecureTimerView] Desviación detectada: ${drift}s. Activando callback.`);
        if (onTamperRef.current) {
          onTamperRef.current();
        }
        clearInterval(intervalId);
        return;
      }

      // 4. Calcular el tiempo restante real
      const totalExamSeconds = Math.floor((endTimeMs - initialServerTimeMs) / 1000);
      const remainingSeconds = Math.max(0, totalExamSeconds - monotonicElapsedSec);

      // 5. ACTUALIZACIÓN DIRECTA EN EL DOM (Evitando el Re-renderizado de React)
      // Modificar directamente la propiedad textContent del elemento salta el proceso de
      // virtual DOM diffing de React. Esto mantiene el árbol de componentes limpio y libre de lags.
      if (spanRef.current) {
        spanRef.current.textContent = format(remainingSeconds);
        
        // Estilo de alerta visual cuando falten menos de 60 segundos
        if (remainingSeconds < 60) {
          spanRef.current.className = 'text-red-500 font-mono text-sm font-extrabold animate-pulse';
        } else {
          spanRef.current.className = 'text-indigo-400 font-mono text-sm font-bold';
        }
      }

      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        onTimeUpRef.current();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [initialServerTimeMs, endTimeMs]);

  // Render inicial estático para evitar parpadeos visuales en el primer segundo
  const initialDurationSec = Math.max(0, Math.floor((endTimeMs - initialServerTimeMs) / 1000));
  const initialHours = Math.floor(initialDurationSec / 3600);
  const initialMinutes = Math.floor((initialDurationSec % 3600) / 60);
  const initialSeconds = initialDurationSec % 60;
  
  const initialFormatted = [
    initialHours.toString().padStart(2, '0'),
    initialMinutes.toString().padStart(2, '0'),
    initialSeconds.toString().padStart(2, '0')
  ].join(':');

  return (
    <span ref={spanRef} className="text-indigo-400 font-mono text-sm font-bold">
      {initialFormatted}
    </span>
  );
};
export default SecureTimerView;
