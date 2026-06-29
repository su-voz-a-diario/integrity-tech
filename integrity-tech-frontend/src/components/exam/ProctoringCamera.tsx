'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ProctoringCameraProps {
  attemptId: string;
  activeQuestionIndex: number;
}

export function ProctoringCamera({ attemptId, activeQuestionIndex }: ProctoringCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Inicializar la cámara al montar el componente
  useEffect(() => {
    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 320 },
            facingMode: 'user', // Cámara frontal o webcam de laptop
          },
          audio: false, // Solo necesitamos vídeo para proctoring
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
        
        // Disparar la primera foto de validación inicial tras 3 segundos
        setTimeout(() => {
          captureAndUpload('snapshot_inicial');
        }, 3000);

      } catch (err) {
        console.error('[Proctoring Camera] Permiso denegado o error de hardware:', err);
        setHasPermission(false);
      }
    }

    enableCamera();

    // Apagar la cámara al desmontar para liberar hardware
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Capturar foto automáticamente al cambiar a la pregunta 2 (index 1)
  useEffect(() => {
    if (hasPermission && activeQuestionIndex === 1) {
      captureAndUpload(`pregunta_2_viewed`);
    }
  }, [activeQuestionIndex, hasPermission]);

  // Función para capturar fotograma y subirlo a la API
  const captureAndUpload = async (triggerReason: string) => {
    if (!videoRef.current || !streamRef.current || isCapturing) return;

    setIsCapturing(true);
    console.log(`[Proctoring Camera] Tomando snapshot por motivo: ${triggerReason}`);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      // Dimensiones cuadradas optimizadas para auditoría
      canvas.width = 320;
      canvas.height = 320;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Dibujar el fotograma del vídeo en el canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Exportar a JPG comprimido al 70% (mantiene el peso bajo: ~20KB)
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);

        // Enviar al endpoint del backend
        const response = await fetch(`/api/evaluations/attempts/${attemptId}/snapshots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`,
          },
          body: JSON.stringify({
            image: base64Image,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[Proctoring Camera] Snapshot subido con éxito:', data.imageUrl);
        } else {
          console.warn('[Proctoring Camera] Fallo al subir la foto al servidor.');
        }
      }
    } catch (err) {
      console.error('[Proctoring Camera] Error en la captura del fotograma:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      {/* CONTENEDOR CIRCULAR FLOTANTE */}
      <div className="relative w-28 h-28 rounded-full border-2 border-indigo-500/30 overflow-hidden bg-slate-950 shadow-2xl shadow-indigo-500/10 flex items-center justify-center group">
        
        {/* STREAM DE VIDEO EN VIVO */}
        {hasPermission === true && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]" // Espejo natural
          />
        )}

        {/* CARGANDO O PERMISO DENEGADO */}
        {hasPermission === null && (
          <span className="text-3xs text-slate-500 font-semibold animate-pulse">Iniciando...</span>
        )}
        {hasPermission === false && (
          <div className="flex flex-col items-center text-center p-2">
            <span className="text-xs">⚠️</span>
            <span className="text-3xs text-red-500 font-semibold mt-1">Cámara Bloqueada</span>
          </div>
        )}

        {/* LED INDICADOR VERDE DE GRABANDO */}
        {hasPermission === true && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-3xs text-slate-300 font-mono font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* RÓTULO DEL MONITOR */}
      <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-800 px-3 py-1 rounded-full text-3xs font-medium text-slate-400 shadow-md">
        Identidad Monitoreada
      </div>
    </div>
  );
}
