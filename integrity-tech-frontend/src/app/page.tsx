'use client';
// Vercel deployment trigger comment


import React from 'react';
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans gap-8">
      
      {/* HEADER LOGO */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-4xl shadow-lg shadow-indigo-500/5">
          🛡️
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">Integrity-Tech</h1>
        <p className="text-sm text-slate-400 max-w-sm mt-1 leading-relaxed">
          Plataforma de evaluación psicométrica resiliente con supervisión forense y LTI.
        </p>
      </div>

      {/* ACCESOS DIRECTOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl w-full">
        
        {/* CARD ESTUDIANTE */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-start text-left gap-4 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xl">
            📝
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Portal del Candidato</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Toma de evaluaciones de integridad mediante clave de acceso única con webcam proctoring y guardado local resiliente.
            </p>
          </div>
          <Link
            href="/exam/login"
            className="mt-2 w-full py-2 text-center rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
          >
            Iniciar Evaluación (Clave)
          </Link>
        </div>

        {/* CARD RECLUTADOR */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col items-start text-left gap-4 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xl">
            💼
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Consola de Selección</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Dashboard para analistas de selección de RRHH. Monitoreo de perfiles por dimensiones y auditoría forense de proctoring.
            </p>
          </div>
          <Link
            href="/recruiter/dashboard"
            className="mt-2 w-full py-2 text-center rounded-lg bg-slate-950 border border-slate-800 text-indigo-400 text-xs font-semibold hover:bg-slate-900 transition-all"
          >
            Acceder al Dashboard
          </Link>
        </div>

      </div>

      {/* METADATOS TÉCNICOS */}
      <div className="border-t border-slate-900 pt-6 text-2xs text-slate-600 font-mono flex flex-col gap-1">
        <div>Plataforma Integrada en NestJS (API/Colas) & Next.js (Client)</div>
        <div>Base de Datos: PostgreSQL + Redis (BullMQ)</div>
      </div>

    </div>
  );
}
