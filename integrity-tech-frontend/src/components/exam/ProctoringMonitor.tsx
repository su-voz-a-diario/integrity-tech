'use client';

import React from 'react';
import { useExamStore } from '../../store/exam.store';

export function ProctoringMonitor() {
  const showWarning = useExamStore((state) => state.showProctoringWarning);
  const focusLossCount = useExamStore((state) => state.focusLossCount);
  const dismissWarning = useExamStore((state) => state.dismissProctoringWarning);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-x-0 top-6 z-50 flex items-center justify-center px-4 pointer-events-none animate-slide-down">
      <div className="w-full max-w-md pointer-events-auto rounded-xl border border-amber-500/30 bg-slate-900/90 backdrop-blur-md p-4 shadow-xl ring-1 ring-black/5 transition-all duration-300">
        <div className="flex items-start gap-3">
          {/* Icono de advertencia en ámbar */}
          <div className="flex-shrink-0 text-amber-500 mt-0.5">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Registro de Integridad Conductual
            </h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              Se ha detectado una salida de foco de la evaluación. Para asegurar la fiabilidad del proceso, toda navegación y tiempo de inactividad quedan registrados en la bitácora de auditoría.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                Incidencias de foco: {focusLossCount}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={dismissWarning}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 transition-all duration-250 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
