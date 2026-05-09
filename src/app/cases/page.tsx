"use client";

import { secureFetch, secureJsonPost } from "@/lib/csrf-client";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface CaseParty {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

interface VaultEvidence {
  _id?: string;
  sourceMessageId?: string;
  uploadedBy: string;
  url?: string;
  publicId?: string;
  originalName?: string;
  type: "image" | "pdf" | "video" | "audio" | "file";
  addedAt: string;
}

interface CaseItem {
  caseId: string;
  title: string;
  description: string;
  status: "pending" | "active" | "closed" | "rejected";
  caseFile: string;
  clientId: string;
  lawyerId: string;
  judgeId?: string;
  openDate?: string;
  updatedDate?: string;
  closeDate?: string;
  decision: {
    summary: string;
    decidedAt: string;
    judgeId: string;
  } | null;
  client: CaseParty | null;
  lawyer: CaseParty | null;
  judge: CaseParty | null;
  vault: {
    vaultId: string;
    accessStatus: "closed" | "open";
    judgeAccessGranted?: boolean;
    clientOtpVerified: boolean;
    lawyerOtpVerified: boolean;
    openedUntil?: string | null;
    evidenceCount: number;
    evidence: VaultEvidence[];
  } | null;
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<string | null>(null);
  const [workingEvidenceId, setWorkingEvidenceId] = useState<string | null>(null);
  const [otpValues, setOtpValues] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>("");
  const [workingGrantJudgeId, setWorkingGrantJudgeId] = useState<string | null>(null);
  const [decisionValues, setDecisionValues] = useState<Record<string, string>>({});
  const [openDecisionForms, setOpenDecisionForms] = useState<Record<string, boolean>>({});
  const [savingDecisionCaseId, setSavingDecisionCaseId] = useState<string | null>(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(userData.role || "");
  }, []);

  const loadCases = async () => {
    try {
      const resp = await fetch("/api/cases");
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to load cases");
      }
      setCases(data.cases || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const requestVaultAccess = async (caseId: string) => {
    try {
      setWorkingCaseId(caseId);
      const resp = await secureJsonPost(`/api/cases/${caseId}/vault/request`, {});
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to request vault access");
      toast.success(data.message || "Vault OTPs sent.");
      await loadCases();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to request vault access");
    } finally {
      setWorkingCaseId(null);
    }
  };

  const grantJudgeAccess = async (caseId: string, judgeId: string) => {
    try {
      setWorkingGrantJudgeId(caseId);
      const resp = await secureJsonPost(`/api/cases/${caseId}/vault/grant-judge`, {
        judgeId,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to grant judge access");
      toast.success(data.message || "Judge granted access to vault.");
      await loadCases();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to grant judge access");
    } finally {
      setWorkingGrantJudgeId(null);
    }
  };

  const verifyVaultOtp = async (caseId: string) => {
    try {
      setWorkingCaseId(caseId);
      const resp = await secureJsonPost(`/api/cases/${caseId}/vault/verify`, {
        otp: otpValues[caseId] || "",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to verify OTP");
      toast.success(data.message || "OTP verified.");
      setOtpValues((prev) => ({ ...prev, [caseId]: "" }));
      await loadCases();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setWorkingCaseId(null);
    }
  };

  const removeEvidence = async (caseId: string, evidenceId?: string) => {
    if (!evidenceId) return;

    const confirmed = window.confirm("Remove this evidence from the vault?");
    if (!confirmed) return;

    try {
      setWorkingEvidenceId(evidenceId);
      const resp = await secureFetch(`/api/cases/${caseId}/vault/evidence/${evidenceId}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to remove evidence");
      toast.success(data.message || "Evidence removed from vault.");
      await loadCases();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove evidence");
    } finally {
      setWorkingEvidenceId(null);
    }
  };

  const submitDecision = async (caseId: string) => {
    try {
      setSavingDecisionCaseId(caseId);
      const resp = await secureJsonPost(`/api/judge/cases/${caseId}`, {
        summary: decisionValues[caseId] || "",
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || "Failed to publish decision");
      toast.success(data?.message || "Decision published.");
      setOpenDecisionForms((prev) => ({ ...prev, [caseId]: false }));
      setDecisionValues((prev) => ({ ...prev, [caseId]: "" }));
      await loadCases();
    } catch (err: unknown) {
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
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/dashboard" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
            Back to Dashboard
          </Link>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.3em] text-blue-600">Case Ledger</p>
          <h1 className="mt-2 text-4xl font-black text-slate-950">Your Cases</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Review case details and request dual-OTP access to the evidence vault. The vault opens only after both the client and lawyer verify their separate OTPs.
          </p>
        </div>

        {cases.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">No cases found</h2>
            <p className="mt-2 text-slate-500">Cases will appear here after filing and admin review.</p>
          </section>
        ) : (
          <section className="space-y-6">
            {cases.map((caseItem) => (
              <CaseCard
                key={caseItem.caseId}
                caseItem={caseItem}
                working={workingCaseId === caseItem.caseId}
                otpValue={otpValues[caseItem.caseId] || ""}
                onOtpChange={(value) => setOtpValues((prev) => ({ ...prev, [caseItem.caseId]: value }))}
                onRequestAccess={() => requestVaultAccess(caseItem.caseId)}
                onVerifyOtp={() => verifyVaultOtp(caseItem.caseId)}
                onGrantJudgeAccess={() => grantJudgeAccess(caseItem.caseId, caseItem.judge?.userId ?? "")}
                userRole={userRole}
                workingGrantJudgeId={workingGrantJudgeId === caseItem.caseId}
                workingEvidenceId={workingEvidenceId}
                onRemoveEvidence={(evidenceId) => removeEvidence(caseItem.caseId, evidenceId)}
                decisionValue={decisionValues[caseItem.caseId] ?? caseItem.decision?.summary ?? ""}
                decisionOpen={Boolean(openDecisionForms[caseItem.caseId])}
                onDecisionValueChange={(value) => setDecisionValues((prev) => ({ ...prev, [caseItem.caseId]: value }))}
                onToggleDecisionForm={() =>
                  setOpenDecisionForms((prev) => ({ ...prev, [caseItem.caseId]: !prev[caseItem.caseId] }))
                }
                onSubmitDecision={() => submitDecision(caseItem.caseId)}
                savingDecision={savingDecisionCaseId === caseItem.caseId}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function CaseCard({
  caseItem,
  working,
  otpValue,
  onOtpChange,
  onRequestAccess,
  onVerifyOtp,
  onGrantJudgeAccess,
  userRole,
  workingGrantJudgeId,
  workingEvidenceId,
  onRemoveEvidence,
  decisionValue,
  decisionOpen,
  onDecisionValueChange,
  onToggleDecisionForm,
  onSubmitDecision,
  savingDecision,
}: {
  caseItem: CaseItem;
  working: boolean;
  otpValue: string;
  onOtpChange: (value: string) => void;
  onRequestAccess: () => void;
  onVerifyOtp: () => void;
  onGrantJudgeAccess: () => void;
  userRole: string;
  workingGrantJudgeId: boolean;
  workingEvidenceId: string | null;
  onRemoveEvidence: (evidenceId?: string) => void;
  decisionValue: string;
  decisionOpen: boolean;
  onDecisionValueChange: (value: string) => void;
  onToggleDecisionForm: () => void;
  onSubmitDecision: () => void;
  savingDecision: boolean;
}) {
  const vault = caseItem.vault;
  const vaultOpen = vault?.accessStatus === "open";
  const judgeAccessGranted = Boolean(vault?.judgeAccessGranted);
  const canJudgeDecide = userRole === "judge";
  const decisionExists = Boolean(caseItem.decision);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{caseItem.caseId}</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{caseItem.title}</h2>
            <p className="mt-2 text-sm text-slate-500">Status: <span className="font-bold capitalize text-blue-700">{caseItem.status}</span></p>
          </div>
          <a
            href={caseItem.caseFile}
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
          <div className="grid gap-4 md:grid-cols-3">
            <PartyCard label="Client" party={caseItem.client} fallbackId={caseItem.clientId} />
            <PartyCard label="Lawyer" party={caseItem.lawyer} fallbackId={caseItem.lawyerId} />
            <PartyCard label="Judge" party={caseItem.judge} fallbackId={caseItem.judgeId || "Not assigned"} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Description</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{caseItem.description}</p>
          </div>

          {caseItem.decision && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Judge Decision</p>
                  <p className="mt-2 text-sm text-emerald-900">
                    Published on {new Date(caseItem.decision.decidedAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Public Notice
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{caseItem.decision.summary}</p>
            </div>
          )}

          {canJudgeDecide && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Judge Action</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">
                    {decisionExists ? "Update decision" : "Give decision"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Submit the final decision for this case. Once saved, it will appear on the public notice board.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleDecisionForm}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  {decisionOpen ? "Close Form" : decisionExists ? "Edit Decision" : "Give Decision"}
                </button>
              </div>

              {decisionOpen && (
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Decision Description
                    </span>
                    <textarea
                      value={decisionValue}
                      onChange={(event) => onDecisionValueChange(event.target.value)}
                      rows={7}
                      placeholder="Write the court's decision, findings, and direction for the parties."
                      className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-amber-400"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={onSubmitDecision}
                      disabled={savingDecision || decisionValue.trim().length < 20}
                      className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {savingDecision ? "Publishing..." : "Publish to Notice Board"}
                    </button>
                    <p className="text-sm text-slate-500">
                      Minimum 20 characters. Publishing also marks the case as closed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {vaultOpen ? (
            <EvidenceGrid
              caseId={caseItem.caseId}
              evidence={vault?.evidence || []}
              canRemove={userRole === "lawyer" && !Boolean(vault?.judgeAccessGranted)}
              workingEvidenceId={workingEvidenceId}
              onRemoveEvidence={onRemoveEvidence}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Evidence preview unlocks after both OTPs are verified.
            </div>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Evidence Vault</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{vault?.vaultId || "Vault unavailable"}</h3>
          <p className="mt-2 text-sm text-slate-600">
            {vaultOpen
              ? `Open until ${vault?.openedUntil ? new Date(vault.openedUntil).toLocaleTimeString() : "soon"}`
              : "Closed. Request access to send OTPs to both parties."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold">
            <StatusPill label="Client OTP" done={Boolean(vault?.clientOtpVerified)} />
            <StatusPill label="Lawyer OTP" done={Boolean(vault?.lawyerOtpVerified)} />
          </div>

          {caseItem.status === "active" && vault && !vaultOpen && !judgeAccessGranted && ["client", "lawyer"].includes(userRole) && (
            <div>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  disabled={working}
                  onClick={onRequestAccess}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {working ? "Sending OTPs..." : "Request Vault Access"}
                </button>
                <input
                  value={otpValue}
                  onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400"
                />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Grant Judge Access</p>
                {userRole === "lawyer" && (
                  <button
                    type="button"
                    disabled={workingGrantJudgeId}
                    onClick={() => onGrantJudgeAccess()}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                  >
                    {workingGrantJudgeId ? "Granting Access..." : "Send to Judge"}
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={working || otpValue.length !== 6}
                onClick={onVerifyOtp}
                className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              >
                Verify My OTP
              </button>
            </div>
          )}

          {vaultOpen && (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              {judgeAccessGranted
                ? "Vault has been sent to the judge. Lawyer edits are locked."
                : "Vault is open for both client and lawyer."}
            </p>
          )}

          {!vaultOpen && judgeAccessGranted && (
            <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              Vault has already been sent to the judge.
            </p>
          )}

          
        </aside>
      </div>
    </article>
  );
}

function PartyCard({ label, party, fallbackId }: { label: string; party: CaseParty | null; fallbackId: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 font-black text-slate-950">{party?.fullName || "Unknown"}</p>
      <p className="mt-1 text-xs text-slate-500">{party?.email || "Email unavailable"}</p>
      <p className="mt-2 font-mono text-xs text-blue-700">{party?.userId || fallbackId}</p>
    </div>
  );
}

function StatusPill({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>
      {label}: {done ? "Verified" : "Pending"}
    </div>
  );
}

function EvidenceGrid({
  caseId,
  evidence,
  canRemove,
  workingEvidenceId,
  onRemoveEvidence,
}: {
  caseId: string;
  evidence: VaultEvidence[];
  canRemove: boolean;
  workingEvidenceId: string | null;
  onRemoveEvidence: (evidenceId?: string) => void;
}) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Vault is open, but no evidence has been added yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {evidence.map((item) => {
        const evidenceUrl = item._id ? `/api/cases/${caseId}/vault/evidence/${item._id}` : item.url;
        return (
        <div key={item._id || item.sourceMessageId || item.url} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{item.type}</p>
            {canRemove && (
              <button
                type="button"
                disabled={workingEvidenceId === item._id}
                onClick={() => onRemoveEvidence(item._id)}
                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {workingEvidenceId === item._id ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-slate-950">{item.originalName || "Evidence file"}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {item.type === "image" ? (
              <img src={evidenceUrl} alt={item.originalName || "Evidence"} className="h-48 w-full object-contain" />
            ) : item.type === "video" ? (
              <video controls className="h-48 w-full">
                <source src={evidenceUrl} />
              </video>
            ) : item.type === "audio" ? (
              <div className="p-4">
                <audio controls className="w-full">
                  <source src={evidenceUrl} />
                </audio>
              </div>
            ) : item.type === "pdf" ? (
              <iframe src={`${evidenceUrl}#view=FitH`} title={item.originalName || "PDF evidence"} className="h-48 w-full bg-white" />
            ) : (
              <div className="p-6 text-sm text-slate-500">Preview not available for this file type.</div>
            )}
          </div>
          <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900">
            Open Evidence
          </a>
        </div>
      )})}
    </div>
  );
}
