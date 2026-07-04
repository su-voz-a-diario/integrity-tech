'use client';

import React, { useEffect, useState } from 'react';
import { AdminShell, StatusBadge } from '../../../../components/staff/AdminShell';
import { apiClient } from '../../../../services/api-client';

type UserRow = { id: string; email: string; firstName: string; lastName: string; isActive: boolean; createdAt: string; userRoles?: Array<{ role: { name: string } }> };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<UserRow[]>('/admin/users')
      .then((data) => { setUsers(Array.isArray(data) ? data : []); setError(null); })
      .catch((err) => setError(err.message || 'No se pudieron cargar usuarios.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell active="Usuarios" title="Usuarios" subtitle="Lectura administrativa de usuarios del tenant. La creación/edición avanzada queda sujeta a permisos y flujos IAM existentes.">
      {error && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        {loading ? <p className="text-sm text-slate-400">Cargando usuarios...</p> : (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-3">Usuario</th><th className="py-3">Roles</th><th className="py-3">Estado</th><th className="py-3">Alta</th></tr></thead><tbody className="divide-y divide-slate-800">
            {users.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-500">No hay usuarios visibles.</td></tr>}
            {users.map((user) => <tr key={user.id}><td className="py-3 font-semibold text-slate-100">{user.firstName} {user.lastName}<p className="text-xs font-normal text-slate-500">{user.email}</p></td><td className="py-3 text-slate-300">{(user.userRoles || []).map((role) => role.role.name).join(', ') || 'Sin rol'}</td><td className="py-3"><StatusBadge status={user.isActive ? 'ACTIVE' : 'RETIRED'} /></td><td className="py-3 text-slate-400">{new Date(user.createdAt).toLocaleDateString('es-MX')}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </AdminShell>
  );
}
