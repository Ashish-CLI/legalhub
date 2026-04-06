'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Chats', href: '/chat', icon: '💬' },
  { name: 'Cases', href: '/cases', icon: '📁' },
  { name: 'Profile', href: '/profile', icon: '👤' },
]

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: '⚙️' },
  { name: 'Users', href: '/admin/users', icon: '👥' },
  { name: 'Verification Requests', href: '/admin/verification-requests', icon: '📋' },
]

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  
  const isActive = (href: string) => {
    return pathname === href
  }

  return (
    <>
      {/* Mobile sidebar */}
      <div className="md:hidden">
        {/* Mobile sidebar would go here if needed */}
      </div>
      
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow pt-5 bg-gray-800 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-white text-xl font-bold">LegalHub</h1>
          </div>
          <div className="mt-5 flex-1 flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive(item.href)
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
              
              {userRole === 'admin' && (
                <>
                  <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Admin
                  </div>
                  {adminNavigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        isActive(item.href)
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                    >
                      <span className="mr-3 text-lg">{item.icon}</span>
                      {item.name}
                    </Link>
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