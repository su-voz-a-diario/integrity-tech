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
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn('[Webcam] Fallo en reproducción automática en móvil:', e));
          };
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
    <div className="flex items-center gap-4 bg-slate-900/30 border border-slate-900/60 p-3 rounded-xl w-full max-w-xl mx-auto my-3 animate-fade-in">
      {/* CONTENEDOR CIRCULAR INTEGRADO (Pequeño y discreto) */}
      <div className="relative w-16 h-16 rounded-full border border-indigo-500/30 overflow-hidden bg-slate-950 flex-shrink-0 flex items-center justify-center">
        
        {/* STREAM DE VIDEO EN VIVO */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover scale-x-[-1] ${hasPermission === true ? 'block' : 'hidden'}`}
        />

        {/* CARGANDO O PERMISO DENEGADO */}
        {hasPermission === null && (
          <span className="text-4xs text-slate-500 font-semibold animate-pulse text-center leading-3">Cargando...</span>
        )}
        {hasPermission === false && (
          <span className="text-xs text-red-500 font-semibold">⚠️</span>
        )}
      </div>

      {/* RÓTULO DEL MONITOR ALINEADO AL LADO */}
      <div className="flex flex-col gap-1 text-left">
        <div className="flex items-center gap-2">
          {hasPermission === true ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-2xs font-bold text-slate-200 uppercase tracking-wider">Identidad Monitoreada (LIVE)</span>
            </>
          ) : (
            <span className="text-2xs font-bold text-red-400 uppercase tracking-wider">Cámara Requerida</span>
          )}
        </div>
        <p className="text-3xs text-slate-500 leading-relaxed max-w-sm">
          Se registran capturas faciales aleatorias con firmas criptográficas para auditoría de integridad conductual.
        </p>
      </div>
    </div>
  );
}
