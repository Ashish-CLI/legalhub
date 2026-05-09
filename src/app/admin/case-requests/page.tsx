"use client";

import { secureFetch } from "@/lib/csrf-client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Participant {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

interface ReviewCase {
  _id: string;
  caseId: string;
  title: string;
  description: string;
  clientId: string;
  lawyerId: string;
  caseFile: string;
  status: string;
  submittedAt?: string;
  client: Participant | null;
  lawyer: Participant | null;
}

interface Judge {
  userId: string;
  fullName: string;
  email: string;
  activeCaseCount: number;
}

export default function AdminCaseRequestsPage() {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<Record<string, string>>({});
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      setError(null);
      const resp = await fetch("/api/admin/cases");
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Failed to load submitted cases");
      }

      setCases(data.cases || []);
      setJudges(data.judges || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load submitted cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleReject = async (caseId: string) => {
    const confirmed = window.confirm("Reject this submitted case?");
    if (!confirmed) return;

    await submitReview(caseId, { action: "reject" });
  };

  const handleAccept = async (caseId: string) => {
    const judgeId = selectedJudges[caseId];
    if (!judgeId) {
      alert("Please choose a judge before accepting this case.");
      return;
    }

    await submitReview(caseId, { action: "accept", judgeId });
  };

  const submitReview = async (caseId: string, body: { action: "accept" | "reject"; judgeId?: string }) => {
    try {
      setWorkingCaseId(caseId);
      const resp = await secureFetch(`/api/admin/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "Failed to update case");
      }

      setCases((prev) => prev.filter((caseItem) => caseItem.caseId !== caseId));
      setSelectedJudges((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      setExpandedCaseId((current) => (current === caseId ? null : current));
      await loadCases();
      alert(data.message || "Case updated successfully.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update case");
    } finally {
      setWorkingCaseId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center text-slate-600">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-300 border-r-slate-900" />
          <p className="mt-4">Loading submitted case requests...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
              Back to Admin Dashboard
            </Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.24em] text-amber-700">Judicial Intake Desk</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Submitted Case Requests</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review lawyer-filed cases, inspect the official PDF case file, then reject or assign the case to an available judge.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending Queue</p>
            <p className="mt-1 text-3xl font-black">{cases.length}</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
            <button onClick={loadCases} className="ml-3 font-semibold underline">Retry</button>
          </div>
        )}

        {cases.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">No submitted case requests</h2>
            <p className="mt-2 text-slate-500">All pending case filings have been reviewed.</p>
          </section>
        ) : (
          <section className="grid gap-6">
            {cases.map((caseItem) => {
              const isExpanded = expandedCaseId === caseItem.caseId;
              const selectedJudgeId = selectedJudges[caseItem.caseId] || "";
              const working = workingCaseId === caseItem.caseId;
              const inlineCaseFileUrl = `/api/admin/cases/${caseItem.caseId}/file`;

              return (
                <article key={caseItem.caseId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{caseItem.caseId}</p>
                          <h2 className="mt-2 text-2xl font-black text-slate-950">{caseItem.title}</h2>
                          <p className="mt-1 text-sm text-slate-500">
                            Submitted {caseItem.submittedAt ? new Date(caseItem.submittedAt).toLocaleString() : "recently"}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
                          Pending Admin Review
                        </span>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <PersonCard label="Client" person={caseItem.client} fallbackId={caseItem.clientId} />
                        <PersonCard label="Lawyer" person={caseItem.lawyer} fallbackId={caseItem.lawyerId} />
                      </div>

                      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Description</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{caseItem.description}</p>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <a
                          href={inlineCaseFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                        >
                          Open Case File
                        </a>
                        <button
                          type="button"
                          onClick={() => setExpandedCaseId(isExpanded ? null : caseItem.caseId)}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
                        >
                          {isExpanded ? "Hide Judge Assignment" : "Accept and Assign Judge"}
                        </button>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => handleReject(caseItem.caseId)}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                          <div className="flex flex-col gap-3 md:flex-row md:items-end">
                            <label className="flex-1">
                              <span className="text-sm font-bold text-blue-950">Assign to judge with fewer than 3 active cases</span>
                              <select
                                value={selectedJudgeId}
                                onChange={(event) =>
                                  setSelectedJudges((prev) => ({ ...prev, [caseItem.caseId]: event.target.value }))
                                }
                                className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                              >
                                <option value="">Choose a judge</option>
                                {judges.map((judge) => (
                                  <option key={judge.userId} value={judge.userId}>
                                    {judge.fullName} ({judge.userId}) - {judge.activeCaseCount}/3 active
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={working || !selectedJudgeId}
                              onClick={() => handleAccept(caseItem.caseId)}
                              className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {working ? "Assigning..." : "Accept Case"}
                            </button>
                          </div>
                          {judges.length === 0 && (
                            <p className="mt-3 text-sm font-semibold text-red-700">
                              No eligible judges are available. A judge must have fewer than 3 active cases.
                            </p>
                          )}
                        </div>
                      )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function PersonCard({ label, person, fallbackId }: { label: string; person: Participant | null; fallbackId: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-black text-slate-950">{person?.fullName || "Unknown User"}</p>
      <p className="mt-1 text-sm text-slate-500">{person?.email || "Email unavailable"}</p>
      <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-600">
        {person?.userId || fallbackId}
      </p>
    </div>
  );
}
