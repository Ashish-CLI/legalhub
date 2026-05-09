'use client';

import Header from '@/app/dashboard/components/Header';
import Sidebar from '@/app/dashboard/components/Sidebar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

type DashboardUser = {
  userId?: string;
  role?: string;
  fullName?: string;
  email?: string;
};

type AuditLog = {
  _id: string;
  auditLogId: string;
  action: string;
  entity?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserEmail?: string;
  otherUserRole?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  timestamp?: string;
  createdAt?: string;
};

type Pagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type Filters = {
  search: string;
  category: string;
  entity: string;
  action: string;
  startDate: string;
  endDate: string;
};

const entityOptions = [
  { value: '', label: 'All Types' },
  { value: 'login', label: 'Login' },
  { value: 'register', label: 'Registration' },
  { value: 'forgot_password', label: 'Password Reset' },
  { value: 'password_change', label: 'Password Change' },
  { value: 'verification_request', label: 'Verification Request' },
  { value: 'user_request', label: 'User Request' },
  { value: 'user_verification', label: 'User Verification' },
  { value: 'case_created', label: 'Case Creation' },
  { value: 'case_assignment', label: 'Case Assignment' },
  { value: 'case_update', label: 'Case Update' },
  { value: 'vault_access', label: 'Vault Access' },
  { value: 'vault_upload', label: 'Evidence Upload' },
  { value: 'admin_action', label: 'Admin Action' },
];

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'admin', label: 'Admin' },
  { value: 'judge', label: 'Judge' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'client', label: 'Client' },
];

const actionOptions = [
  { value: '', label: 'All Events' },
  { value: 'User logged in', label: 'User logged in' },
  { value: 'User registered', label: 'User registered' },
  { value: 'Password reset', label: 'Password reset' },
  { value: 'Password changed', label: 'Password changed' },
  { value: 'Verification request submitted', label: 'Verification request submitted' },
  { value: 'Verification approved', label: 'Verification approved' },
  { value: 'Verification rejected', label: 'Verification rejected' },
  { value: 'Case created', label: 'Case created' },
  { value: 'Case accepted and assigned by admin', label: 'Case accepted and assigned by admin' },
  { value: 'Case rejected by admin', label: 'Case rejected by admin' },
  { value: 'Evidence uploaded', label: 'Evidence uploaded' },
];

const defaultFilters: Filters = {
  search: '',
  category: '',
  entity: '',
  action: '',
  startDate: '',
  endDate: '',
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    totalCount: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(defaultFilters);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}') as DashboardUser;

      if (!storedUser?.userId) {
        router.push('/login');
        return;
      }

      if (storedUser.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUser(storedUser);
    } catch {
      router.push('/login');
      return;
    } finally {
      setHydrated(true);
    }
  }, [router]);

  const fetchLogs = useCallback(async (nextPage: number, nextFilters: Filters) => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(pagination.limit),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (nextFilters.search) params.set('search', nextFilters.search);
      if (nextFilters.category) params.set('category', nextFilters.category);
      if (nextFilters.entity) params.set('entity', nextFilters.entity);
      if (nextFilters.action) params.set('action', nextFilters.action);
      if (nextFilters.startDate) params.set('startDate', nextFilters.startDate);
      if (nextFilters.endDate) params.set('endDate', nextFilters.endDate);

      const response = await fetch(`/api/audit-logs?${params.toString()}`, {
        credentials: 'same-origin',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load audit logs.');
      }

      setLogs(data.auditLogs || []);
      setPagination(data.pagination || { page: nextPage, limit: pagination.limit, totalCount: 0, totalPages: 0 });
    } catch (err) {
      setLogs([]);
      setPagination((current) => ({ ...current, page: nextPage, totalCount: 0, totalPages: 0 }));
      setError(err instanceof Error ? err.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);
  

  useEffect(() => {
    if (!user?.userId) return;
    void fetchLogs(1, filters);
  }, [fetchLogs, filters, user?.userId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(draftFilters);
  };

  const handleReset = () => {
    setDraftFilters(defaultFilters);
    setFilters(defaultFilters);
  };

  const roleSummary = useMemo(() => {
    const counts: Record<string, number> = { admin: 0, judge: 0, lawyer: 0, client: 0 };

    for (const log of logs) {
      const role = log.userRole;
      if (role && role in counts) {
        counts[role] += 1;
      }
    }

    return counts;
  }, [logs]);

  if (!hydrated || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar userRole={user.role || ''} />
      <div className="flex flex-1 flex-col md:ml-64">
        <Header user={user} />
        <main className="flex-1 p-4 md:p-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.96),_rgba(30,41,59,1)_42%,_rgba(148,163,184,0.95)_140%)] px-6 py-8 text-white md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <Link href="/dashboard" className="text-sm font-semibold text-cyan-200 hover:text-white">
                    Back to Dashboard
                  </Link>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Admin Oversight</p>
                  <h1 className="mt-3 text-3xl font-black md:text-4xl">Audit Logs</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    Review every tracked platform event in one place. Filter by date, category, log type, exact event,
                    or search for a user name appearing in the audit trail.
                  </p>
                </div>

                <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
                  <StatCard label="Total Logs" value={String(pagination.totalCount)} />
                  <StatCard label="This Page" value={String(logs.length)} />
                  <StatCard label="Admin Events" value={String(roleSummary.admin)} />
                  <StatCard label="Pages" value={String(Math.max(pagination.totalPages, 1))} />
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FilterField label="Search by name">
                    <input
                      type="text"
                      value={draftFilters.search}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                      placeholder="Name, email, user ID, case ID..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </FilterField>

                  <FilterField label="Category">
                    <select
                      value={draftFilters.category}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, category: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value || 'all-category'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Type of audit log">
                    <select
                      value={draftFilters.entity}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, entity: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      {entityOptions.map((option) => (
                        <option key={option.value || 'all-entity'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Event">
                    <select
                      value={draftFilters.action}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      {actionOptions.map((option) => (
                        <option key={option.value || 'all-actions'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="From date">
                    <input
                      type="date"
                      value={draftFilters.startDate}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </FilterField>

                  <FilterField label="To date">
                    <input
                      type="date"
                      value={draftFilters.endDate}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </FilterField>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    Apply filters
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    Clear filters
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">System activity stream</h2>
                    <p className="text-sm text-slate-500">
                      Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                    {pagination.totalCount} tracked events
                  </div>
                </div>

                {loading ? (
                  <div className="p-10 text-center text-sm font-semibold text-slate-500">Loading audit logs...</div>
                ) : logs.length === 0 ? (
                  <div className="p-10 text-center">
                    <h3 className="text-lg font-bold text-slate-950">No audit logs found</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      No entries match the current filters. Try a wider date range or clear the event filters.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {logs.map((log) => (
                      <article key={log._id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${actionTone(log.entity)}`}>
                                {entityLabel(log.entity)}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                {log.auditLogId}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                {formatRole(log.userRole)}
                              </span>
                            </div>

                            <div>
                              <h3 className="text-lg font-black text-slate-950">{log.action}</h3>
                              <p className="mt-1 text-sm text-slate-500">{formatDate(log.timestamp || log.createdAt)}</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <p className="font-bold text-slate-900">{displayPerson(log.userName, log.userId)}</p>
                            <p>{log.userEmail || 'Email unavailable'}</p>
                            {log.ipAddress && <p className="mt-1 font-mono text-xs text-slate-500">{log.ipAddress}</p>}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
                          <PersonPanel
                            title="Primary user"
                            name={displayPerson(log.userName, log.userId)}
                            email={log.userEmail}
                            role={log.userRole}
                          />
                          <PersonPanel
                            title="Related user"
                            name={displayPerson(log.otherUserName, log.otherUserId, 'No related user')}
                            email={log.otherUserEmail}
                            role={log.otherUserRole}
                          />
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Quick facts</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-600">
                              <p><span className="font-bold text-slate-900">Type:</span> {entityLabel(log.entity)}</p>
                              <p><span className="font-bold text-slate-900">Category:</span> {formatRole(log.userRole)}</p>
                              <p><span className="font-bold text-slate-900">Related role:</span> {formatRole(log.otherUserRole)}</p>
                            </div>
                          </div>
                        </div>

                        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <summary className="cursor-pointer text-sm font-bold text-slate-900">View audit details</summary>
                          <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                            {JSON.stringify(log.details || {}, null, 2)}
                          </pre>
                        </details>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {pagination.totalPages > 1 && !loading && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Showing page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => void fetchLogs(pagination.page - 1, filters)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => void fetchLogs(pagination.page + 1, filters)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function PersonPanel({
  title,
  name,
  email,
  role,
}: {
  title: string;
  name: string;
  email?: string;
  role?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <p className="mt-3 text-base font-black text-slate-950">{name}</p>
      <p className="mt-1 text-sm text-slate-500">{email || 'Email unavailable'}</p>
      <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
        {formatRole(role)}
      </p>
    </div>
  );
}

function entityLabel(entity?: string) {
  const labels: Record<string, string> = {
    login: 'Login',
    register: 'Registration',
    forgot_password: 'Password Reset',
    password_change: 'Password Change',
    verification_request: 'Verification Request',
    user_request: 'User Request',
    user_verification: 'User Verification',
    case_created: 'Case Creation',
    case_assignment: 'Case Assignment',
    case_update: 'Case Update',
    vault_access: 'Vault Access',
    vault_upload: 'Evidence Upload',
    admin_action: 'Admin Action',
  };

  return entity ? labels[entity] || entity : 'General';
}

function formatRole(role?: string) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown';
}

function displayPerson(name?: string, id?: string, fallback = 'Unknown user') {
  if (name) return id ? `${name} (${id})` : name;
  if (id) return id;
  return fallback;
}

function formatDate(value?: string) {
  if (!value) return 'Unknown time';

  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Calcutta',
  });
}

function actionTone(entity?: string) {
  const tones: Record<string, string> = {
    login: 'bg-emerald-100 text-emerald-800',
    register: 'bg-blue-100 text-blue-800',
    forgot_password: 'bg-amber-100 text-amber-800',
    password_change: 'bg-amber-100 text-amber-800',
    verification_request: 'bg-indigo-100 text-indigo-800',
    user_verification: 'bg-fuchsia-100 text-fuchsia-800',
    case_created: 'bg-cyan-100 text-cyan-800',
    case_assignment: 'bg-sky-100 text-sky-800',
    case_update: 'bg-slate-200 text-slate-800',
    vault_access: 'bg-orange-100 text-orange-800',
    vault_upload: 'bg-rose-100 text-rose-800',
    admin_action: 'bg-violet-100 text-violet-800',
  };

  return tones[entity || ''] || 'bg-slate-100 text-slate-700';
}
