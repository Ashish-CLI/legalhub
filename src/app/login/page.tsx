'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { secureJsonPost, getCsrfToken } from '@/lib/csrf-client';

interface FormFields {
  email: string;
  password: string;
}

interface FieldErrors {
  [key: string]: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormFields>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { getCsrfToken(); }, []);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault(); setErrors({}); setMessage('');
    const newErrors: FieldErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Enter a valid email address';
    if (!formData.password) newErrors.password = 'Password is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setLoading(true);
    try {
      const res = await secureJsonPost('/api/auth/login', { email: formData.email.trim(), password: formData.password });
      const data = await res.json();
      if (!res.ok) {
        if (data.details) { const fe: FieldErrors = {}; for (const [k, v] of Object.entries(data.details)) fe[k] = (v as string[])[0]; setErrors(fe); }
        else setMessage(data.error || 'Login failed');
        return;
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      setMessage('Login successful! Redirecting...');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
    } catch { setMessage('Network error. Please try again.'); } finally { setLoading(false); }
  }

  const Spinner = () => (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Login Form */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#0a0e1a] px-4 py-8 lg:w-1/2">

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-600/15 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-[100px]" />
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Form Content */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 w-full max-w-md px-2">
          {/* Logo */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-white">Legal</span>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Hub</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">India&apos;s Digital Legal Platform</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-400">Sign in to your account to continue.</p>
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div key="msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.includes('successful') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5">
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">Email Address</label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com"
                  className={`w-full rounded-xl border bg-white/[0.04] py-3 pl-12 pr-4 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.email ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
              </div>
              {errors.email && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-400">{errors.email}</motion.p>}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-xs font-medium text-blue-400 hover:text-blue-300">Forgot password?</Link>
              </div>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter your password"
                  className={`w-full rounded-xl border bg-white/[0.04] py-3 pl-12 pr-4 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.password ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
              </div>
              {errors.password && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-400">{errors.password}</motion.p>}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <button type="submit" disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? <><Spinner />Signing in...</> : 'Sign In'}
                </span>
              </button>
            </motion.div>
          </form>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-[#0a0e1a] px-4 text-slate-500">or</span></div>
            </div>
            <p className="text-center text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300">Create one</Link>
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Right Panel */}
      <div className="relative hidden items-center justify-center lg:flex lg:w-1/2">
        {/* Background Image */}
        <Image src="/register-pic.jpg" alt="Legal professionals" fill className="object-cover" priority />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-indigo-900/70 to-slate-900/80" />
        <div className="absolute inset-0 bg-[#0a0e1a]/30" />

        {/* Hero Text + Stats */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <svg className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
              </svg>
            </div>
            <h2 className="mb-3 text-3xl font-bold text-white">Justice, Simplified.</h2>
            <p className="mx-auto max-w-sm text-base text-blue-100/70">
              Access legal services, connect with professionals, and manage your cases — all in one platform.
            </p>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
