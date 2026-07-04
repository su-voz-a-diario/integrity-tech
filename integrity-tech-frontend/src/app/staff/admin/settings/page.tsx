import { AdminShell } from '../../../../components/staff/AdminShell';

export default function SettingsPage() {
  return (
    <AdminShell active="Configuración" title="Configuración" subtitle="Parámetros visibles del entorno frontend. No se muestran secretos ni credenciales.">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <dl className="grid gap-4 text-sm md:grid-cols-3">
          <Info label="Entorno" value={process.env.NEXT_PUBLIC_APP_ENV || 'development'} />
          <Info label="API base" value={process.env.NEXT_PUBLIC_API_BASE_URL || '/api'} />
          <Info label="Build date" value={process.env.NEXT_PUBLIC_BUILD_DATE || 'local'} />
        </dl>
      </section>
    </AdminShell>
  );
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-slate-200">{value}</dd></div>; }
