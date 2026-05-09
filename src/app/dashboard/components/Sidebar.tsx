'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  name: string
  href: string
  badge: string
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', badge: 'DB' },
  { name: 'Chats', href: '/chat', badge: 'CH' },
  { name: 'Cases', href: '/cases', badge: 'CS' },
  { name: 'Notice Board', href: '/notice-board', badge: 'NB' },
  { name: 'Profile', href: '/profile', badge: 'PR' },
]

const adminNavigation: NavItem[] = [
  { name: 'Admin Panel', href: '/admin', badge: 'AD' },
  { name: 'Users', href: '/admin/users', badge: 'US' },
  { name: 'Verification Requests', href: '/admin/verification-requests', badge: 'VR' },
  { name: 'Case Requests', href: '/admin/case-requests', badge: 'CR' },
  { name: 'Audit Logs', href: '/admin/audit-logs', badge: 'AL' },
]

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <>
      <div className="md:hidden">
        {/* Mobile sidebar would go here if needed */}
      </div>

      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-grow flex-col overflow-y-auto bg-gray-800 pt-5">
          <div className="flex items-center px-4">
            <h1 className="text-xl font-bold text-white">LegalHub</h1>
          </div>
          <div className="mt-5 flex flex-1 flex-col">
            <nav className="flex-1 space-y-1 px-2">
              {navigation.map((item) => (
                <SidebarLink key={item.name} item={item} active={isActive(item.href)} />
              ))}

              {userRole === 'admin' && (
                <>
                  <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Admin
                  </div>
                  {adminNavigation.map((item) => (
                    <SidebarLink key={item.name} item={item} active={isActive(item.href)} />
                  ))}
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`${
        active ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      } group flex items-center rounded-md px-2 py-2 text-base font-medium`}
    >
      <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold uppercase tracking-[0.12em]">
        {item.badge}
      </span>
      {item.name}
    </Link>
  )
}
