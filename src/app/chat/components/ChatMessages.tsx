import React from 'react';
import { BriefcaseBusiness, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { Message } from '@/app/chat/page';

interface VaultContext {
  caseId: string;
  title: string;
  clientId: string;
  lawyerId: string;
  vaultId: string | null;
}

interface ChatMessagesProps {
  selectedUser: string | null;
  messages: Message[] | null;
  loggedInUser: { _id: string; name: string; role?: string };
  onCaseRequestAction?: (messageId: string, action: "accept" | "reject") => void;
  activeVaultCase?: VaultContext | null;
  onAddMediaToVault?: (messageId: string) => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  selectedUser,
  messages,
  loggedInUser,
  onCaseRequestAction,
  activeVaultCase,
  onAddMediaToVault,
}) => {
  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Select a chat to view messages.
      </div>
    );
  }

  if (!messages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 p-2">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500">No messages yet.</div>
      ) : (
        messages.map((msg) => {
          const isMine = msg.sender === loggedInUser._id;
          return (
            <div
              key={msg._id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-lg p-2 ${isMine ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-200'}`}
              >
                {msg.messageType === 'text' && msg.text && (
                  <p className="break-words">{msg.text}</p>
                )}
                {msg.messageType === 'media' && msg.media && (
                  <MediaContent
                    message={msg}
                    media={msg.media}
                    loggedInUser={loggedInUser}
                    activeVaultCase={activeVaultCase}
                    onAddMediaToVault={onAddMediaToVault}
                  />
                )}
                {msg.messageType === 'case_request' && msg.caseRequest && (
                  <CaseRequestContent
                    message={msg}
                    loggedInUser={loggedInUser}
                    onCaseRequestAction={onCaseRequestAction}
                  />
                )}
                <span className="text-xs text-gray-400 block text-right mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

interface CaseRequestContentProps {
  message: Message;
  loggedInUser: { _id: string; name: string; role?: string };
  onCaseRequestAction?: (messageId: string, action: "accept" | "reject") => void;
}

const CaseRequestContent: React.FC<CaseRequestContentProps> = ({ message, loggedInUser, onCaseRequestAction }) => {
  const request = message.caseRequest;
  if (!request) return null;

  const isLawyerRecipient = loggedInUser._id === request.lawyerId && loggedInUser.role === "lawyer";
  const statusLabel = request.status === "filed" ? "Case filed" : request.status.charAt(0).toUpperCase() + request.status.slice(1);
  const statusClass = {
    pending: "bg-amber-400/15 text-amber-200 border-amber-300/30",
    accepted: "bg-blue-400/15 text-blue-200 border-blue-300/30",
    rejected: "bg-rose-400/15 text-rose-200 border-rose-300/30",
    filed: "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
  }[request.status];

  return (
    <div className="min-w-64 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-400/15 p-2 text-amber-200">
          <BriefcaseBusiness className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-white">Case filing request</p>
          <p className="mt-1 text-sm text-gray-300">
            The client is asking the lawyer to accept and file this case.
          </p>
        </div>
      </div>

      <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
        {statusLabel}
      </div>

      {request.status === "pending" && isLawyerRecipient && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCaseRequestAction?.(message._id, "accept")}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            <Check className="h-4 w-4" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => onCaseRequestAction?.(message._id, "reject")}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}

      {request.status === "accepted" && isLawyerRecipient && (
        <a
          href={`/cases/new?requestId=${message._id}`}
          className="inline-flex rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          Open filing form
        </a>
      )}
    </div>
  );
};

interface MediaContentProps {
  message: Message;
  media: {
    url: string;
    type: 'image' | 'pdf' | 'video' | 'audio' | 'file';
    publicId?: string;
    originalName?: string;
  };
  loggedInUser: { _id: string; name: string; role?: string };
  activeVaultCase?: VaultContext | null;
  onAddMediaToVault?: (messageId: string) => void;
}

const MediaContent: React.FC<MediaContentProps> = ({ message, media, loggedInUser, activeVaultCase, onAddMediaToVault }) => {
  // Function to handle file download with proper filename
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct download
      window.open(url, '_blank');
    }
  };

  const canAddToVault = loggedInUser.role === 'lawyer' && Boolean(activeVaultCase) && !message.vault?.added;

  const renderMedia = () => {
    switch (media.type) {
    case 'image':
      return <img src={media.url} alt="Image" className="max-w-full h-auto rounded" />;
    case 'pdf':
      // Use original filename if available, otherwise extract from URL
      const pdfFileName = media.originalName || (() => {
        const pdfUrlParts = media.url.split('/');
        const fileNameWithExtension = pdfUrlParts.pop()?.split('?')[0] || 'document.pdf';
        return decodeURIComponent(fileNameWithExtension);
      })();
      return (
        <button
          onClick={() => handleDownload(media.url, pdfFileName)}
          className="text-blue-400 underline bg-transparent border-none cursor-pointer"
        >
          View {pdfFileName}
        </button>
      );
    case 'video':
      return (
        <video controls className="max-w-full rounded">
          <source src={media.url} />Your browser does not support the video tag.
        </video>
      );
    case 'audio':
      return (
        <audio controls className="w-full">
          <source src={media.url} />Your browser does not support the audio element.
        </audio>
      );
    case 'file':
      // Use original filename if available, otherwise extract from URL
      const fileName = media.originalName || (() => {
        const urlParts = media.url.split('/');
        const fileNameWithExtension = urlParts.pop()?.split('?')[0] || 'file';
        return decodeURIComponent(fileNameWithExtension);
      })();
      return (
        <button
          onClick={() => handleDownload(media.url, fileName)}
          className="text-blue-400 underline bg-transparent border-none cursor-pointer"
        >
          Download {fileName}
        </button>
      );
    default:
      return null;
    }
  };

  return (
    <div className="space-y-2">
      {renderMedia()}
      {message.vault?.added ? (
        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          Added to vault
        </div>
      ) : canAddToVault ? (
        <button
          type="button"
          onClick={() => onAddMediaToVault?.(message._id)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Add to Vault
        </button>
      ) : null}
    </div>
  );
};

export default ChatMessages;
