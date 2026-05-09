"use client";

import { secureFetch, secureJsonPost } from "@/lib/csrf-client";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface ProfileUser {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  role: "client" | "lawyer" | "judge" | "admin";
  profileImage?: string;
  verificationStatus: "pending" | "accepted" | "rejected";
  caseCount?: number;
}

interface ProfileForm {
  fullName: string;
  phoneNumber: string;
  address: string;
  otp: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    fullName: "",
    phoneNumber: "",
    address: "",
    otp: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const detailsChanged = useMemo(() => {
    if (!user) return false;
    return form.fullName.trim() !== user.fullName ||
      form.phoneNumber.trim() !== user.phoneNumber ||
      form.address.trim() !== user.address;
  }, [form.address, form.fullName, form.phoneNumber, user]);

  const loadProfile = async () => {
    try {
      const resp = await fetch("/api/profile");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to load profile");

      setUser(data.user);
      setForm({
        fullName: data.user.fullName || "",
        phoneNumber: data.user.phoneNumber || "",
        address: data.user.address || "",
        otp: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const sendOtp = async () => {
    try {
      setSendingOtp(true);
      const resp = await secureJsonPost("/api/profile/otp", {});
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to send OTP");
      toast.success(data.message || "OTP sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    if (!selected) {
      setPhoto(null);
      return;
    }

    if (!selected.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      toast.error("Profile photo must be 5MB or smaller.");
      event.target.value = "";
      return;
    }

    setPhoto(selected);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    if (detailsChanged && form.otp.length !== 6) {
      toast.error("Enter the 6-digit OTP before saving detail changes.");
      return;
    }

    if (!detailsChanged && !photo) {
      toast("No changes to save.");
      return;
    }

    try {
      setSaving(true);
      const payload = new FormData();
      payload.append("fullName", form.fullName.trim());
      payload.append("phoneNumber", form.phoneNumber.trim());
      payload.append("address", form.address.trim());
      if (detailsChanged) payload.append("otp", form.otp);
      if (photo) payload.append("profileImage", photo);

      const resp = await secureFetch("/api/profile", {
        method: "PATCH",
        body: payload,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to update profile");

      setUser(data.user);
      setForm({
        fullName: data.user.fullName || "",
        phoneNumber: data.user.phoneNumber || "",
        address: data.user.address || "",
        otp: "",
      });
      setPhoto(null);
      localStorage.setItem("user", JSON.stringify({
        ...JSON.parse(localStorage.getItem("user") || "{}"),
        userId: data.user.userId,
        fullName: data.user.fullName,
        email: data.user.email,
        role: data.user.role,
        profileImage: data.user.profileImage,
      }));
      toast.success(data.message || "Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-r-cyan-300" />
          <p className="mt-4 text-slate-300">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-2xl font-black">Profile unavailable</h1>
          <Link href="/dashboard" className="mt-4 inline-flex font-bold text-cyan-200">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const imageSrc = photoPreview || user.profileImage || "/default.jpg";

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.18),transparent_30%)]" />
      <div className="relative mx-auto max-w-6xl">
        <section className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/30">
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950 p-8">
              <Link href="/dashboard" className="text-sm font-bold text-cyan-200 hover:text-cyan-100">
                Back to Dashboard
              </Link>
              <div className="mt-10">
                <div className="relative h-40 w-40 overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900 shadow-2xl shadow-cyan-950/50">
                  <img src={imageSrc} alt={user.fullName} className="h-full w-full object-cover" />
                </div>
                <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-cyan-200/80">{user.userId}</p>
                <h1 className="mt-2 text-4xl font-black leading-tight">{user.fullName}</h1>
                <p className="mt-3 text-sm capitalize text-slate-300">
                  {user.role} account - <span className="font-bold text-amber-200">{user.verificationStatus}</span>
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="bg-slate-900/80 p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-200/80">Profile Center</p>
                  <h2 className="mt-2 text-3xl font-black">Account Details</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Update your photo instantly. Name, address, and phone changes require OTP verification on your registered email.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-200">
                  {user.email}
                </span>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
                <div className="space-y-5">
                  <Field label="Full Name">
                    <input
                      value={form.fullName}
                      onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    />
                  </Field>

                  <Field label="Phone Number">
                    <input
                      value={form.phoneNumber}
                      onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                      placeholder="+91XXXXXXXXXX"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    />
                  </Field>

                  <Field label="Address">
                    <textarea
                      value={form.address}
                      onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                      rows={5}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    />
                  </Field>

                  {detailsChanged && (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-amber-100">OTP required for detail changes</p>
                          <p className="mt-1 text-sm text-slate-400">We will send the code to {user.email}.</p>
                        </div>
                        <button
                          type="button"
                          onClick={sendOtp}
                          disabled={sendingOtp}
                          className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-200 disabled:opacity-60"
                        >
                          {sendingOtp ? "Sending..." : "Send OTP"}
                        </button>
                      </div>
                      <input
                        value={form.otp}
                        onChange={(event) => setForm((prev) => ({ ...prev, otp: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        placeholder="6-digit OTP"
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-white outline-none focus:border-amber-300"
                      />
                    </div>
                  )}
                </div>

                <aside className="h-fit rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/80">Photo</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                    <img src={imageSrc} alt="Profile preview" className="h-64 w-full object-cover" />
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-300/5 px-4 py-4 text-center text-sm font-bold text-cyan-100 hover:bg-cyan-300/10">
                    Choose New Photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-slate-500">JPG, PNG, or WEBP. Maximum size: 5MB. No OTP required for photo updates.</p>
                </aside>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setForm({
                      fullName: user.fullName,
                      phoneNumber: user.phoneNumber,
                      address: user.address,
                      otp: "",
                    });
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving || (detailsChanged && form.otp.length !== 6)}
                  className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/40 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
