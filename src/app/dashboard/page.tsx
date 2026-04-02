'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import StatsCard from './components/StatsCard'
import LawyerSearch from './components/LawyerSearch'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}')
    if (!userData.userId) {
      router.push('/login')
      return
    }
    
    
    setUser(userData)
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userRole={user.role} />
      <div className="flex flex-1 flex-col md:ml-64">
        <Header user={user} />
        <main className="flex-1 p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Welcome back, {user.fullName}
            </h1>
            <p className="text-gray-600">
              Here's what's happening with your cases today.
            </p>
          </div>
          
          {/* Stats Grid */}
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
          
          {/* Lawyer Search */}
          <div className="bg-white p-4 rounded-lg shadow md:p-6">
            <LawyerSearch />
          </div>
        </main>
      </div>
    </div>
  )
}