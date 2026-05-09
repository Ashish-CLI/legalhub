"use client";

import { secureFormPost } from "@/lib/csrf-client";
import { ArrowLeft, FileText, Loader2, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface CaseRequestMessage {
  _id: string;
  caseRequest?: {
    status: "pending" | "accepted" | "rejected" | "filed";
    clientId: string;
    lawyerId: string;
    caseId?: string;
  };
}

function NewCaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<CaseRequestMessage | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caseFile, setCaseFile] = useState<File | null>(null);

  useEffect(() => {
    const loadRequest = async () => {
      if (!requestId) {
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch(`/api/case-requests/${requestId}`);
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Could not load case request");
        }
        const data = await resp.json();
        setRequest(data.message);
      } catch (err: unknown) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Could not load case request");
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [requestId]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setCaseFile(null);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Case file must be 20MB or smaller.");
      setCaseFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF case file.");
      setCaseFile(null);
      return;
    }

    setCaseFile(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestId || !request?.caseRequest) return;

    if (!caseFile) {
      toast.error("Please attach the case file PDF.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("caseRequestMessageId", requestId);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("caseFile", caseFile);

      const resp = await secureFormPost("/api/cases", formData);
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to file case");
      }

      toast.success(`Case ${data.case.caseId} filed successfully.`);
      router.push("/chat");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to file case");
    } finally {
      setSubmitting(false);
    }
  };

  const canFile = request?.caseRequest?.status === "accepted";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <Link href="/chat" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-50 p-4 text-blue-700">
                <Scale className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">LegalHub Filing Desk</p>
                <h1 className="mt-3 text-3xl font-bold text-slate-950">File accepted case request</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Complete the required case details. Client and lawyer IDs are locked from the accepted chat request and will be submitted by the system.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading case request...
              </div>
            ) : !requestId ? (
              <EmptyState message="No case request was provided. Accept a case request from chat first." />
            ) : !request?.caseRequest ? (
              <EmptyState message="This case request could not be found." />
            ) : !canFile ? (
              <EmptyState message={`This request is ${request.caseRequest.status}, so it cannot be filed.`} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
                  <ReadOnlyField label="Client ID" value={request.caseRequest.clientId} />
                  <ReadOnlyField label="Lawyer ID" value={request.caseRequest.lawyerId} />
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Case title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={3}
                    maxLength={150}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500"
                    placeholder="Example: Property dispute filing"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Case description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    minLength={20}
                    maxLength={5000}
                    required
                    rows={7}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500"
                    placeholder="Summarize the case facts, relief requested, and filing context."
                  />
                </label>

                <label className="block rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <FileText className="h-4 w-4" />
                    Official case file PDF
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                    className="mt-4 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-600 file:mr-4 file:border-0 file:bg-slate-950 file:px-4 file:py-3 file:font-semibold file:text-white"
                  />
                  <p className="mt-3 text-xs text-slate-400">
                    Maximum size is 20MB. The server also verifies PDF magic bytes before upload.
                  </p>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Filing case...
                    </>
                  ) : (
                    "Submit case filing"
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-700">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
      {message}
    </div>
  );
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 text-slate-950" />}>
      <NewCaseForm />
    </Suspense>
  );
}
