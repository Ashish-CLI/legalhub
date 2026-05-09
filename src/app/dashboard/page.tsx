'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import StatsCard from './components/StatsCard'
import LawyerSearch from './components/LawyerSearch'

interface DashboardUser {
  userId?: string;
  role?: string;
  fullName?: string;
}

interface DashboardNotification {
  id: string;
  title: string;
  description: string;
  tone: 'amber' | 'blue' | 'emerald' | 'rose' | 'slate';
  createdAt?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}') as DashboardUser;
      setUser(userData.userId ? userData : null);
    } catch {
      setUser(null);
    } finally {
      setHydrated(true);
    }
  }, [])

  useEffect(() => {
    if (hydrated && !user?.userId) {
      router.push('/login')
    }
  }, [hydrated, router, user?.userId])

  useEffect(() => {
    if (!user?.userId || user.role === 'client') return;

    const loadNotifications = async () => {
      try {
        setNotificationsLoading(true)
        const response = await fetch('/api/dashboard/notifications')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load dashboard notifications')
        setNotifications(data.notifications || [])
      } catch (error) {
        console.error('Dashboard notifications failed:', error)
        setNotifications([])
      } finally {
        setNotificationsLoading(false)
      }
    }

    loadNotifications()
  }, [user?.role, user?.userId])

  if (!hydrated || !user) {
    return null
  }

  const roleLabel = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar userRole={user.role || ''} />
      <div className="flex flex-1 flex-col md:ml-64">
        <Header user={user} />
        <main className="flex-1 p-4 md:p-6">
          <section className="mb-6 overflow-hidden rounded-3xl border border-white bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/40">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">{roleLabel} Workspace</p>
                <h1 className="mt-3 text-3xl font-black md:text-4xl">
                  Welcome back, {user.fullName || 'LegalHub user'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  {dashboardIntro(user.role)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">User ID</p>
                <p className="mt-1 font-bold">{user.userId}</p>
              </div>
            </div>
          </section>
          
          {false && (
          /* Stats Grid */
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard 
              title="Total Cases" 
              value="12" 
              change="+2 this month" 
              icon="📁" 
            />
            <StatsCard 
              title="Active Cases" 
              value="8" 
              change="3 urgent" 
              icon="⚡" 
            />
            <StatsCard 
              title="Pending Actions" 
              value="3" 
              change="2 require attention" 
              icon="⚠️" 
            />
            <StatsCard 
              title="Documents" 
              value="24" 
              change="+5 this week" 
              icon="📄" 
            />
          </div>
          )}
          
          {user.role === 'client' ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Client Action</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Find a verified lawyer</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Search lawyers and start a chat when you are ready to discuss a case.
                </p>
              </div>
              <LawyerSearch />
            </section>
          ) : user.role === 'lawyer' ? (
            <NotificationBoard
              title="Lawyer Notifications"
              subtitle="Case requests and admin decisions related to your filed cases appear here as read-only updates."
              loading={notificationsLoading}
              notifications={notifications}
              emptyMessage="No lawyer notifications yet. New client requests and admin case decisions will appear here."
            />
          ) : user.role === 'admin' ? (
            <NotificationBoard
              title="Admin Notifications"
              subtitle="User verification and case verification requests appear here as read-only updates."
              loading={notificationsLoading}
              notifications={notifications}
              emptyMessage="No pending user or case verification requests right now."
            />
          ) : (
            <NotificationBoard
              title="Case Desk"
              subtitle="Assigned case updates will appear here as the judge workflow expands."
              loading={false}
              notifications={[]}
              emptyMessage="No judge notifications yet."
            />
          )}
        </main>
      </div>
    </div>
  )
}

function dashboardIntro(role?: string) {
  if (role === 'client') return 'Your dashboard is focused on finding verified legal help and starting secure conversations.';
  if (role === 'lawyer') return 'Track incoming client case requests and admin decisions without leaving your workspace.';
  if (role === 'admin') return 'Monitor pending platform review work: user verification and submitted case verification.';
  if (role === 'judge') return 'Your judge workspace is ready for assigned case updates.';
  return 'Your LegalHub workspace is ready.';
}

function NotificationBoard({
  title,
  subtitle,
  loading,
  notifications,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  notifications: DashboardNotification[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Notifications</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
          {notifications.length} update{notifications.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-2xl border p-4 ${toneClasses(notification.tone)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">{notification.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{notification.description}</p>
                </div>
                {notification.createdAt && (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-slate-500">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function toneClasses(tone: DashboardNotification['tone']) {
  const classes = {
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    rose: 'border-rose-200 bg-rose-50',
    slate: 'border-slate-200 bg-slate-50',
  };
  return classes[tone];
}
