"use client";

import { secureFetch } from "@/lib/csrf-client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface JudgeCase {
  caseId: string;
  title: string;
  description: string;
  status: "pending" | "active" | "closed" | "rejected";
  clientId: string;
  lawyerId: string;
  caseFile: string;
  decision: {
    summary: string;
    decidedAt: string;
    judgeId: string;
  } | null;
  vault: {
    vaultId: string;
    canAccess: boolean;
    judgeAccessGranted?: boolean;
    openedUntil?: string | null;
    evidenceCount: number;
    evidence: Array<{
      _id: string;
      type: string;
      originalName: string;
    }>;
  } | null;
}

interface JudgeVaultDetail {
  vaultId: string;
  accessStatus: string;
  evidenceCount: number;
  evidence: Array<{
    _id: string;
    type: string;
    originalName: string;
  }>;
  openedUntil?: string | null;
}

function JudgeEvidenceCard({
  caseId,
  evidenceId,
  type,
  originalName,
}: {
  caseId: string;
  evidenceId: string;
  type: string;
  originalName: string;
}) {
  const [assetUrl, setAssetUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    const loadEvidence = async () => {
      try {
        const resp = await secureFetch(`/api/cases/${caseId}/vault/evidence/${evidenceId}`, {
          cache: "no-store",
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          throw new Error(data?.error || "Failed to load evidence");
        }

        const blob = await resp.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setAssetUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load evidence");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEvidence();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [caseId, evidenceId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mt-2 truncate text-sm font-semibold text-slate-950">{originalName}</p>
      {loading ? (
        <div className="mt-4 flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
          Loading evidence...
        </div>
      ) : assetUrl ? (
        <>
          {type === "image" && (
            <img src={assetUrl} alt={originalName} className="mt-4 h-48 w-full object-contain" />
          )}
          {type === "video" && (
            <video controls className="mt-4 h-48 w-full">
              <source src={assetUrl} />
            </video>
          )}
          {type === "audio" && (
            <div className="mt-4 p-4">
              <audio controls className="w-full">
                <source src={assetUrl} />
              </audio>
            </div>
          )}
          {type === "pdf" && (
            <iframe src={`${assetUrl}#view=FitH`} title={originalName} className="mt-4 h-48 w-full bg-white" />
          )}
          {type === "file" && (
            <a href={assetUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block text-sm font-bold text-blue-700 hover:text-blue-900">
              Open file
            </a>
          )}
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            View only
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load this evidence.
        </div>
      )}
    </div>
  );
}

export default function JudgeCasesPage() {
  const [cases, setCases] = useState<JudgeCase[]>([]);
  const [vaultsByCase, setVaultsByCase] = useState<Record<string, JudgeVaultDetail | null>>({});
  const [loading, setLoading] = useState(true);
  const [decisionValues, setDecisionValues] = useState<Record<string, string>>({});
  const [openDecisionForms, setOpenDecisionForms] = useState<Record<string, boolean>>({});
  const [savingDecisionCaseId, setSavingDecisionCaseId] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      const resp = await secureFetch("/api/judge/cases", {
        cache: "no-store",
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || "Failed to load cases");
      setCases(data.cases || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (cases.length === 0) return;

    let cancelled = false;

    const loadVaults = async () => {
      const entries = await Promise.all(
        cases.map(async (caseItem) => {
          try {
            const resp = await secureFetch(`/api/cases/${caseItem.caseId}/vault/judge`, {
              cache: "no-store",
            });
            const data = await resp.json().catch(() => null);
            if (!resp.ok) {
              return [caseItem.caseId, null] as const;
            }
            return [caseItem.caseId, data] as const;
          } catch {
            return [caseItem.caseId, null] as const;
          }
        })
      );

      if (!cancelled) {
        setVaultsByCase(Object.fromEntries(entries));
      }
    };

    loadVaults();

    return () => {
      cancelled = true;
    };
  }, [cases]);

  const submitDecision = async (caseId: string) => {
    try {
      setSavingDecisionCaseId(caseId);
      const resp = await secureFetch(`/api/judge/cases/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: decisionValues[caseId] || "" }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || "Failed to publish decision");
      toast.success(data?.message || "Decision published.");
      setOpenDecisionForms((prev) => ({ ...prev, [caseId]: false }));
      setDecisionValues((prev) => ({ ...prev, [caseId]: "" }));
      await loadCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish decision");
    } finally {
      setSavingDecisionCaseId(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-r-slate-900" />
          <p className="mt-4 text-slate-600">Loading your cases...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mt-2 text-4xl font-black text-slate-950">Judge Cases</h1>
        </section>

        {cases.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">No cases assigned</h2>
          </section>
        ) : (
          <section className="space-y-6">
            {cases.map((c) => {
              const vaultDetail = vaultsByCase[c.caseId];
              const vaultVisible = Boolean(vaultDetail);
              const vaultId = vaultDetail?.vaultId || c.vault?.vaultId || "Vault unavailable";
              const openedUntil = vaultDetail?.openedUntil || c.vault?.openedUntil || null;
              const evidence = vaultDetail?.evidence || [];
              return (
              <article key={c.caseId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                        {c.caseId}
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-slate-950">{c.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">
                        Status: <span className="font-bold capitalize text-blue-700">{c.status}</span>
                      </p>
                    </div>
                    <a
                      href={c.caseFile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Open Case File
                    </a>
                  </div>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Description</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{c.description}</p>
                    </div>

                    {c.decision && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Published Decision</p>
                        <p className="mt-2 text-sm text-emerald-900">
                          Published on {new Date(c.decision.decidedAt).toLocaleString()}
                        </p>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{c.decision.summary}</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Judge Action</p>
                          <h3 className="mt-2 text-xl font-black text-slate-950">
                            {c.decision ? "Update decision" : "Give decision"}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Publish your final description so it appears on the notice board for all users.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDecisionForms((prev) => ({ ...prev, [c.caseId]: !prev[c.caseId] }))
                          }
                          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                        >
                          {openDecisionForms[c.caseId] ? "Close Form" : c.decision ? "Edit Decision" : "Give Decision"}
                        </button>
                      </div>

                      {openDecisionForms[c.caseId] && (
                        <div className="mt-5 space-y-4">
                          <textarea
                            value={decisionValues[c.caseId] ?? c.decision?.summary ?? ""}
                            onChange={(event) =>
                              setDecisionValues((prev) => ({ ...prev, [c.caseId]: event.target.value }))
                            }
                            rows={7}
                            placeholder="Write the decision, findings, and directions for this case."
                            className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-amber-400"
                          />
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => submitDecision(c.caseId)}
                              disabled={savingDecisionCaseId === c.caseId || (decisionValues[c.caseId] ?? c.decision?.summary ?? "").trim().length < 20}
                              className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-60"
                            >
                              {savingDecisionCaseId === c.caseId ? "Publishing..." : "Publish to Notice Board"}
                            </button>
                            <p className="text-sm text-slate-500">
                              Publishing also marks the case as closed.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Evidence Vault</p>
                    <h3 className="mt-2 text-xl font-black text-slate-950">{vaultId}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {vaultVisible
                        ? `View-only access until ${openedUntil ? new Date(openedUntil).toLocaleTimeString() : "soon"}`
                        : "Vault stays hidden until the lawyer grants judge access."}
                    </p>
                    <div className="mt-5 grid gap-4">
                      {!vaultVisible ? (
                        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                          Case details are visible now. Vault files will appear here only after access is shared to the judge.
                        </p>
                      ) : evidence.length === 0 ? (
                        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No evidence available.</p>
                      ) : (
                        evidence.map((e) => (
                          <JudgeEvidenceCard
                            key={e._id}
                            caseId={c.caseId}
                            evidenceId={e._id}
                            type={e.type}
                            originalName={e.originalName}
                          />
                        ))
                      )}
                    </div>
                  </aside>
                </div>
              </article>
            )})}
          </section>
        )}
      </div>
    </main>
  );
}


