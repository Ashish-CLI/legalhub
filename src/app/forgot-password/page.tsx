'use client';

import { useState, useRef, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { secureJsonPost, getCsrfToken } from '@/lib/csrf-client';

type Step = 'email' | 'reset';
interface FormFields { email: string; otp: string; newPassword: string; confirmPassword: string; }
interface FieldErrors { [key: string]: string; }

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [formData, setFormData] = useState<FormFields>({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { getCsrfToken(); }, []);

  function startTimer() {
    setOtpTimer(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((p) => { if (p <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; } return p - 1; });
    }, 1000);
  }
  function fmtTime(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault(); setErrors({}); setMessage('');
    const email = formData.email.trim();
    if (!email) { setErrors({ email: 'Email is required' }); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErrors({ email: 'Enter a valid email' }); return; }
    setLoading(true);
    try {
      const res = await secureJsonPost('/api/auth/forgot-password', { email });
      const data = await res.json();
      if (!res.ok) { setErrors({ email: data.error || 'Failed' }); return; }
      setMessage('If an account exists, an OTP has been sent.'); setStep('reset'); startTimer();
    } catch { setErrors({ email: 'Network error' }); } finally { setLoading(false); }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault(); setErrors({}); setMessage('');
    const ne: FieldErrors = {};
    if (!formData.otp || formData.otp.length !== 6) ne.otp = 'Enter 6-digit OTP';
    if (!formData.newPassword || formData.newPassword.length < 8) ne.newPassword = 'Min 8 characters';
    if (formData.newPassword !== formData.confirmPassword) ne.confirmPassword = 'Mismatch';
    if (Object.keys(ne).length > 0) { setErrors(ne); return; }
    setLoading(true);
    try {
      const res = await secureJsonPost('/api/auth/reset-password', { email: formData.email, otp: formData.otp, newPassword: formData.newPassword });
      const data = await res.json();
      if (!res.ok) { if (data.error?.toLowerCase().includes('otp')) setErrors({ otp: data.error }); else setMessage(data.error || 'Failed'); return; }
      setSuccess(true); if (timerRef.current) clearInterval(timerRef.current);
    } catch { setMessage('Network error'); } finally { setLoading(false); }
  }

  async function handleResend() {
    setErrors({}); setMessage(''); setLoading(true);
    try {
      const res = await secureJsonPost('/api/auth/forgot-password', { email: formData.email });
      const data = await res.json();
      if (!res.ok) { setErrors({ otp: data.error || 'Failed' }); return; }
      setMessage('OTP resent!'); setFormData((p) => ({ ...p, otp: '' })); startTimer();
    } catch { setErrors({ otp: 'Network error' }); } finally { setLoading(false); }
  }

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const inp = (f: string) => `w-full rounded-xl border bg-white/[0.04] py-3 px-4 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors[f] ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`;
  const Spin = () => (<svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
  const Btn = ({ children }: { children: React.ReactNode }) => (
    <button type="submit" disabled={loading} className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
  const Err = ({ field }: { field: string }) => errors[field] ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-400">{errors[field]}</motion.p> : null;

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a] px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-xl sm:p-10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </motion.div>
          <h2 className="mb-2 text-2xl font-bold text-white">Password Reset!</h2>
          <p className="mb-6 text-slate-400">Sign in with your new password.</p>
          <Link href="/login" className="inline-block w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-center font-semibold text-white shadow-lg shadow-blue-600/20">Go to Login</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Forgot Password Form */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#0a0e1a] px-4 py-8 lg:w-1/2">
        {/* Background Glow Effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-600/15 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-[100px]" />
        </div>
        {/* Dot Grid Pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Form Content */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-md px-2">
          {/* Logo */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight"><span className="text-white">Legal</span><span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Hub</span></h1>
            <p className="mt-1 text-sm text-slate-500">India&apos;s Digital Legal Platform</p>
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div key="msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.includes('sent') || message.includes('resent') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>{message}</motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.form key="s1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} onSubmit={handleSendOtp} className="space-y-5">
                <div className="mb-2">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20">
                    <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  </div>
                  <h2 className="text-center text-xl font-semibold text-white">Forgot password?</h2>
                  <p className="mt-1 text-center text-sm text-slate-400">We&apos;ll send a reset code to your email.</p>
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"><svg className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg></div>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className={`w-full rounded-xl border bg-white/[0.04] py-3 pl-12 pr-4 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.email ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
                  </div>
                  <Err field="email" />
                </div>
                <Btn>{loading ? <><Spin />Sending...</> : 'Send Reset Code'}</Btn>
                <p className="text-center text-sm text-slate-400">Remember it? <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">Sign in</Link></p>
              </motion.form>
            )}

            {step === 'reset' && (
              <motion.form key="s2" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} onSubmit={handleReset} className="space-y-5">
                <div><h2 className="text-xl font-semibold text-white">Reset password</h2><p className="mt-1 text-sm text-slate-400">Code sent to <span className="text-blue-400">{formData.email}</span></p></div>
                <div>
                  <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-slate-300">6-Digit OTP</label>
                  <input type="text" id="otp" value={formData.otp} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setFormData((p) => ({ ...p, otp: v })); if (errors.otp) setErrors((p) => { const n = { ...p }; delete n.otp; return n; }); }}
                    placeholder="000000" maxLength={6} className={`w-full rounded-xl border bg-white/[0.04] py-4 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder-slate-600 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.otp ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
                  <Err field="otp" />
                </div>
                {otpTimer > 0 && <p className="text-center text-sm text-slate-400">Expires in <span className="font-semibold text-blue-400">{fmtTime(otpTimer)}</span></p>}
                <div><label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-300">New Password</label><input type="password" id="newPassword" name="newPassword" value={formData.newPassword} onChange={handleChange} placeholder="Min 8 characters" className={inp('newPassword')} /><Err field="newPassword" /></div>
                <div><label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-300">Confirm</label><input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter" className={inp('confirmPassword')} /><Err field="confirmPassword" /></div>
                <Btn>{loading ? <><Spin />Resetting...</> : 'Reset Password'}</Btn>
                <div className="flex justify-between text-sm">
                  <button type="button" onClick={() => { setStep('email'); setMessage(''); setErrors({}); }} className="text-slate-400 hover:text-slate-300">← Change email</button>
                  <button type="button" onClick={handleResend} disabled={loading || otpTimer > 240} className="font-semibold text-blue-400 hover:text-blue-300 disabled:text-slate-600">Resend</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Right Panel — Image + Hero Content */}
      <div className="relative hidden items-center justify-center lg:flex lg:w-1/2">
        {/* Background Image */}
        <Image src="/register-pic.jpg" alt="Legal professionals" fill className="object-cover" priority />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-indigo-900/70 to-slate-900/80" />
        <div className="absolute inset-0 bg-[#0a0e1a]/30" />
        {/* Hero Text */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <svg className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </div>
            <h2 className="mb-3 text-3xl font-bold text-white">Secure Recovery</h2>
            <p className="mx-auto max-w-sm text-base text-blue-100/70">Your account security is our priority. Reset your password safely with OTP verification.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
