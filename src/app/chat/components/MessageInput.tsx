import { Loader2, Paperclip, Send, X, File as FileIcon } from "lucide-react";
import React, { useState } from "react";

interface MessageInputProps {
  selectedUser: string | null;
  message: string;
  setMessage: (message: string) => void;
  handleMessageSend: (e: any, file?: File | null) => void;
}

const MessageInput = ({
  selectedUser,
  message,
  setMessage,
  handleMessageSend,
}: MessageInputProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!message.trim() && !file) return;

    setIsUploading(true);
    await handleMessageSend(e, file);
    setFile(null);
    setIsUploading(false);
  };

  const getFilePreview = () => {
    if (!file) return null;

    if (file.type.startsWith("image/")) {
      return (
        <div className="relative w-fit">
          <img
            src={URL.createObjectURL(file)}
            alt="File preview"
            className="w-24 h-24 object-cover rounded-lg border border-gray-600"
          />
          <button
            type="button"
            className="absolute -top-2 -right-2 bg-black rounded-full p-1"
            onClick={() => setFile(null)}
            aria-label="Remove file"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      );
    } else {
      return (
        <div className="relative flex items-center gap-2 p-2 bg-gray-700 rounded-lg">
          <FileIcon className="w-5 h-5 text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-gray-400">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            type="button"
            className="p-1"
            onClick={() => setFile(null)}
            aria-label="Remove file"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      );
    }
  };

  if (!selectedUser) return null;
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border-t border-gray-700 pt-2"
    >
      {file && getFilePreview()}

      <div className="flex items-center gap-2">
        <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2 transition-colors" aria-label="Attach file">
          <Paperclip size={18} className="text-gray-300" />
          <input
            type="file"
            accept="image/*,application/pdf,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) {
                setFile(selectedFile);
              }
            }}
          />
        </label>

        <input
          type="text"
          className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400"
          placeholder={file ? "Add a caption..." : "Type a message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          type="submit"
          disabled={(!file && !message.trim()) || isUploading}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          aria-label="Send message"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </form>
  );
};

export default MessageInput;
