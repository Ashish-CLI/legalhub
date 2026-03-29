'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/dashboard')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="flex flex-col items-center justify-center w-full max-w-4xl px-4 py-12 text-center">
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            LegalHub
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            India's Digital Legal Platform - Connect with verified lawyers, manage cases digitally, and access justice from anywhere.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-8">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl mb-4">⚖️</div>
            <h3 className="text-xl font-semibold mb-2">Find Lawyers</h3>
            <p className="text-gray-600">
              Connect with verified legal professionals for your case needs.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl mb-4">📁</div>
            <h3 className="text-xl font-semibold mb-2">Manage Cases</h3>
            <p className="text-gray-600">
              Track your legal matters digitally with our case management system.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2">Secure Documents</h3>
            <p className="text-gray-600">
              Store and share legal documents securely in the cloud.
            </p>
          </div>
        </div>
        
        <div className="mt-12">
          <Link 
            href="/login" 
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  )
}
