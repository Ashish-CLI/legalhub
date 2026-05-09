"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface NoticeItem {
  caseId: string;
  title: string;
  description: string;
  client: {
    userId: string;
    fullName: string;
  };
  lawyer: {
    userId: string;
    fullName: string;
  };
  judge: {
    userId: string;
    fullName: string;
  };
  status: "pending" | "active" | "closed" | "rejected";
  closeDate: string | null;
  decision: {
    summary: string;
    decidedAt: string;
    judgeId: string;
    judgeName: string;
  } | null;
}

export default function NoticeBoardPage() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotices = async () => {
      try {
        const response = await fetch("/api/notice-board", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to load notice board");
        setNotices(data?.notices || []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load notice board");
      } finally {
        setLoading(false);
      }
    };

    loadNotices();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#f8fafc_45%,_#e2e8f0)] px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-xl shadow-amber-100 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-amber-700">Public Notice Board</p>
              <h1 className="mt-3 text-4xl font-black text-slate-950">Published Court Decisions</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Every decision submitted by an assigned judge is listed here so clients, lawyers, judges, and admins can review the public outcome.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>

        <section className="mt-8">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-r-amber-700" />
              <p className="mt-4 text-slate-600">Loading public notices...</p>
            </div>
          ) : notices.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-12 text-center shadow-sm">
              <h2 className="text-xl font-black text-slate-950">No decisions published yet</h2>
              <p className="mt-2 text-slate-500">Judge decisions will appear here as soon as they are submitted.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {notices.map((notice) => (
                <article
                  key={notice.caseId}
                  className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/70"
                >
                  <div className="border-b border-amber-100 bg-[linear-gradient(135deg,_#fef3c7,_#ffffff)] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-amber-700">
                          {notice.caseId}
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-slate-950">{notice.title}</h2>
                        <p className="mt-2 text-sm text-slate-600">
                          Decided by <span className="font-bold text-slate-950">{notice.decision?.judgeName || "Judge unavailable"}</span> on{" "}
                          {notice.decision ? new Date(notice.decision.decidedAt).toLocaleString() : "Unknown date"}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                        {notice.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-6 p-6 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Case Details</p>
                        <div className="mt-3 grid gap-3 text-sm text-slate-700">
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <span className="font-bold text-slate-950">Client:</span> {notice.client.fullName}
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <span className="font-bold text-slate-950">Lawyer:</span> {notice.lawyer.fullName}
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <span className="font-bold text-slate-950">Judge:</span> {notice.judge.fullName}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Case Description</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notice.description}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Judge Decision</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                        {notice.decision?.summary || "No decision description available."}
                      </p>
                      {notice.closeDate && (
                        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Case closed on {new Date(notice.closeDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
