'use client';

import { useState, useRef, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

type Role = 'client' | 'lawyer' | 'judge' | 'admin';
type Step = 'email' | 'otp' | 'details';

interface FormFields {
  email: string; otp: string; fullName: string; phoneNumber: string; address: string;
  password: string; confirmPassword: string; role: Role;
  idDocument: File | null; professionalDocument: File | null;
}
interface FieldErrors { [key: string]: string; }

const stepsMeta = [
  { key: 'email' as Step, label: 'Email', d: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
  { key: 'otp' as Step, label: 'Verify', d: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  { key: 'details' as Step, label: 'Details', d: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
];

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('email');
  const [formData, setFormData] = useState<FormFields>({ email: '', otp: '', fullName: '', phoneNumber: '', address: '', password: '', confirmPassword: '', role: 'client', idDocument: null, professionalDocument: null });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ userId: string; fullName: string; role: string } | null>(null);
  const idDocRef = useRef<HTMLInputElement>(null);
  const profDocRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    setOtpTimer(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((p) => { if (p <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; } return p - 1; });
    }, 1000);
  }
  function fmtTime(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }
  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  }
  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const { name, files } = e.target;
    if (files?.[0]) { setFormData((p) => ({ ...p, [name]: files[0] })); if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n; }); }
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault(); setErrors({}); setMessage('');
    const email = formData.email.trim();
    if (!email) { setErrors({ email: 'Email is required' }); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErrors({ email: 'Enter a valid email' }); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) { setErrors({ email: data.error || 'Failed' }); return; }
      setMessage('OTP sent!'); setStep('otp'); startTimer();
    } catch { setErrors({ email: 'Network error' }); } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault(); setErrors({}); setMessage('');
    if (!formData.otp || formData.otp.length !== 6) { setErrors({ otp: 'Enter 6-digit OTP' }); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email, otp: formData.otp }) });
      const data = await res.json();
      if (!res.ok) { setErrors({ otp: data.error || 'Invalid OTP' }); return; }
      setMessage('Email verified!'); setStep('details'); if (timerRef.current) clearInterval(timerRef.current);
    } catch { setErrors({ otp: 'Network error' }); } finally { setLoading(false); }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault(); setErrors({}); setMessage('');
    const ne: FieldErrors = {};
    if (!formData.fullName || formData.fullName.length < 2) ne.fullName = 'Min 2 characters';
    if (!formData.phoneNumber) ne.phoneNumber = 'Required';
    else { let p = formData.phoneNumber.trim(); if (/^[6-9]\d{9}$/.test(p)) p = `+91${p}`; if (!/^\+91[6-9]\d{9}$/.test(p)) ne.phoneNumber = 'Invalid number'; }
    if (!formData.address || formData.address.length < 10) ne.address = 'Min 10 characters';
    if (!formData.password || formData.password.length < 8) ne.password = 'Min 8 characters';
    if (formData.password !== formData.confirmPassword) ne.confirmPassword = 'Mismatch';
    if (!formData.idDocument) ne.idDocument = 'Required';
    if (['lawyer', 'judge', 'admin'].includes(formData.role) && !formData.professionalDocument) ne.professionalDocument = 'Required';
    if (Object.keys(ne).length > 0) { setErrors(ne); return; }
    let phone = formData.phoneNumber.trim();
    if (/^[6-9]\d{9}$/.test(phone)) phone = `+91${phone}`;
    setLoading(true);
    try {
      const body = new window.FormData();
      body.append('fullName', formData.fullName); body.append('email', formData.email);
      body.append('phoneNumber', phone); body.append('address', formData.address);
      body.append('password', formData.password); body.append('role', formData.role);
      if (formData.idDocument) body.append('idDocument', formData.idDocument);
      if (formData.professionalDocument) body.append('professionalDocument', formData.professionalDocument);
      const res = await fetch('/api/auth/register', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        if (data.details) { const fe: FieldErrors = {}; for (const [k, v] of Object.entries(data.details)) fe[k] = (v as string[])[0]; setErrors(fe); }
        else setMessage(data.error || 'Failed');
        return;
      }
      setSuccess(true); setSuccessData(data.user);
    } catch { setMessage('Network error'); } finally { setLoading(false); }
  }

  async function handleResend() {
    setErrors({}); setMessage(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.email }) });
      const data = await res.json();
      if (!res.ok) { setErrors({ otp: data.error || 'Failed' }); return; }
      setMessage('OTP resent!'); setFormData((p) => ({ ...p, otp: '' })); startTimer();
    } catch { setErrors({ otp: 'Network error' }); } finally { setLoading(false); }
  }

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const needsProf = ['lawyer', 'judge', 'admin'].includes(formData.role);
  const si = stepsMeta.findIndex((s) => s.key === step);
  const inp = (f: string) => `w-full rounded-xl border bg-white/[0.04] py-3 px-4 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors[f] ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`;
  const Spin = () => (<svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
  const Btn = ({ children }: { children: React.ReactNode }) => (
    <button type="submit" disabled={loading} className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
  const Err = ({ field }: { field: string }) => errors[field] ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-xs text-red-400">{errors[field]}</motion.p> : null;

  if (success && successData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a] px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-xl sm:p-10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </motion.div>
          <h2 className="mb-2 text-2xl font-bold text-white">Registration Successful!</h2>
          <p className="mb-6 text-slate-400">Pending admin verification.</p>
          <div className="mb-6 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-left">
            {[{ l: 'User ID', v: successData.userId }, { l: 'Name', v: successData.fullName }, { l: 'Role', v: successData.role }].map((i) => (
              <div key={i.l} className="flex justify-between"><span className="text-sm text-slate-400">{i.l}</span><span className="text-sm font-semibold capitalize text-white">{i.v}</span></div>
            ))}
          </div>
          <Link href="/login" className="inline-block w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-center font-semibold text-white shadow-lg shadow-blue-600/20">Go to Login</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Registration Form */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#0a0e1a] px-4 py-6 lg:w-1/2">
        {/* Background Glow Effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-600/15 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-[100px]" />
        </div>
        {/* Dot Grid Pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Form Content */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-md overflow-y-auto px-2">
          {/* Logo */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight"><span className="text-white">Legal</span><span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Hub</span></h1>
            <p className="mt-1 text-sm text-slate-500">Create your account</p>
          </div>

          {/* Step Indicator */}
          <div className="mb-6 flex items-center justify-between">
            {stepsMeta.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${i === si ? 'border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20' : i < si ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400' : 'border-white/[0.08] bg-white/[0.03] text-slate-500'}`}>
                    {i < si ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={s.d} /></svg>}
                  </div>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${i <= si ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
                </div>
                {i < 2 && <div className="mx-2 mb-5 h-px flex-1"><div className={`h-full transition-all ${i < si ? 'bg-emerald-500/50' : 'bg-white/[0.06]'}`} /></div>}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div key="msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${message.includes('verified') || message.includes('sent') || message.includes('resent') || message.includes('Successful') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>{message}</motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.form key="s1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} onSubmit={handleSendOtp} className="space-y-5">
                <div><h2 className="text-lg font-semibold text-white">Verify your email</h2><p className="mt-1 text-sm text-slate-400">We&apos;ll send a 6-digit OTP.</p></div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"><svg className="h-5 w-5 text-slate-500 transition-colors group-focus-within:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg></div>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className={`w-full rounded-xl border bg-white/[0.04] py-3 pl-12 pr-4 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.email ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
                  </div>
                  <Err field="email" />
                </div>
                <Btn>{loading ? <><Spin />Sending...</> : 'Send OTP'}</Btn>
                <p className="text-center text-sm text-slate-400">Have an account? <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">Sign in</Link></p>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form key="s2" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} onSubmit={handleVerifyOtp} className="space-y-5">
                <div><h2 className="text-lg font-semibold text-white">Enter code</h2><p className="mt-1 text-sm text-slate-400">Sent to <span className="text-blue-400">{formData.email}</span></p></div>
                <div>
                  <input type="text" id="otp" value={formData.otp} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setFormData((p) => ({ ...p, otp: v })); if (errors.otp) setErrors((p) => { const n = { ...p }; delete n.otp; return n; }); }}
                    placeholder="000000" maxLength={6} className={`w-full rounded-xl border bg-white/[0.04] py-4 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder-slate-600 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.otp ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
                  <Err field="otp" />
                </div>
                {otpTimer > 0 && <p className="text-center text-sm text-slate-400">Expires in <span className="font-semibold text-blue-400">{fmtTime(otpTimer)}</span></p>}
                <Btn>{loading ? <><Spin />Verifying...</> : 'Verify OTP'}</Btn>
                <div className="flex justify-between text-sm">
                  <button type="button" onClick={() => { setStep('email'); setMessage(''); setErrors({}); }} className="text-slate-400 hover:text-slate-300">← Change email</button>
                  <button type="button" onClick={handleResend} disabled={loading || otpTimer > 240} className="font-semibold text-blue-400 hover:text-blue-300 disabled:text-slate-600">Resend</button>
                </div>
              </motion.form>
            )}

            {step === 'details' && (
              <motion.form key="s3" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} onSubmit={handleRegister} className="space-y-3">
                <div><h2 className="text-lg font-semibold text-white">Your details</h2></div>
                <div><label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-300">Full Name</label><input id="fullName" type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Your full name" className={inp('fullName')} /><Err field="fullName" /></div>
                <div>
                  <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-slate-300">Mobile</label>
                  <div className="flex"><span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/[0.08] bg-white/[0.06] px-3 text-sm text-slate-400">+91</span>
                    <input id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber.replace(/^\+91/, '')} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData((p) => ({ ...p, phoneNumber: v })); if (errors.phoneNumber) setErrors((p) => { const n = { ...p }; delete n.phoneNumber; return n; }); }}
                      placeholder="9876543210" maxLength={10} className={`w-full rounded-r-xl border bg-white/[0.04] px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:bg-white/[0.07] focus:ring-2 ${errors.phoneNumber ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-blue-500/20'}`} />
                  </div><Err field="phoneNumber" />
                </div>
                <div><label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-300">Address</label><textarea id="address" name="address" value={formData.address} onChange={handleChange} placeholder="Full address" rows={2} className={`resize-none ${inp('address')}`} /><Err field="address" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-300">Password</label><input id="password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 8 chars" className={inp('password')} /><Err field="password" /></div>
                  <div><label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-300">Confirm</label><input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter" className={inp('confirmPassword')} /><Err field="confirmPassword" /></div>
                </div>
                <div><label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-300">Role</label>
                  <select id="role" name="role" value={formData.role} onChange={handleChange} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20">
                    <option value="client" className="bg-[#0a0e1a]">Client</option><option value="lawyer" className="bg-[#0a0e1a]">Lawyer</option><option value="judge" className="bg-[#0a0e1a]">Judge</option><option value="admin" className="bg-[#0a0e1a]">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">ID Document <span className="text-slate-500">(PDF/JPG, 5MB)</span></label>
                  <div onClick={() => idDocRef.current?.click()} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-all hover:border-blue-500/40 hover:bg-blue-500/5 ${errors.idDocument ? 'border-red-500/30' : 'border-white/[0.08]'}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"><svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg></div>
                    <span className="truncate text-sm text-slate-400">{formData.idDocument ? formData.idDocument.name : 'Upload ID document'}</span>
                  </div>
                  <input ref={idDocRef} type="file" name="idDocument" accept=".pdf,.jpg,.jpeg" onChange={handleFile} className="hidden" aria-label="Upload ID document" /><Err field="idDocument" />
                </div>
                {needsProf && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Professional Doc</label>
                    <div onClick={() => profDocRef.current?.click()} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-all hover:border-amber-500/40 hover:bg-amber-500/5 ${errors.professionalDocument ? 'border-red-500/30' : 'border-white/[0.08]'}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"><svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
                      <span className="truncate text-sm text-slate-400">{formData.professionalDocument ? formData.professionalDocument.name : 'Upload professional doc'}</span>
                    </div>
                    <input ref={profDocRef} type="file" name="professionalDocument" accept=".pdf,.jpg,.jpeg" onChange={handleFile} className="hidden" aria-label="Upload professional document" /><Err field="professionalDocument" />
                  </div>
                )}
                <Btn>{loading ? <><Spin />Creating...</> : 'Create Account'}</Btn>
                <p className="text-center text-sm text-slate-400">Have an account? <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">Sign in</Link></p>
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
        {/* Text over image*/}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <svg className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
            </div>
            <h2 className="mb-3 text-3xl font-bold text-white">Join the Community</h2>
            <p className="mx-auto max-w-sm text-base text-blue-100/70">Thousands of legal professionals trust LegalHub for case management and collaboration.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}