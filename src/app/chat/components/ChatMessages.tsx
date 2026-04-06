import React from 'react';
import { Loader2 } from 'lucide-react';
import { Message } from '@/app/chat/page';

interface ChatMessagesProps {
  selectedUser: string | null;
  messages: Message[] | null;
  loggedInUser: { _id: string; name: string };
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ selectedUser, messages, loggedInUser }) => {
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
                className={`max-w-xs rounded-lg p-2 ${{
                  'bg-gray-700 text-white': isMine,
                  'bg-gray-800 text-gray-200': !isMine,
                }}`}
              >
                {msg.messageType === 'text' && msg.text && (
                  <p className="break-words">{msg.text}</p>
                )}
                {msg.messageType === 'media' && msg.media && (
                  <MediaContent media={msg.media} />
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

interface MediaContentProps {
  media: {
    url: string;
    type: 'image' | 'pdf' | 'video' | 'audio' | 'file';
    publicId?: string;
  };
}

const MediaContent: React.FC<MediaContentProps> = ({ media }) => {
  switch (media.type) {
    case 'image':
      return <img src={media.url} alt="Image" className="max-w-full h-auto rounded" />;
    case 'pdf':
      return (
        <a href={media.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
          View PDF
        </a>
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
      return (
        <a href={media.url} download className="text-blue-400 underline">
          Download file
        </a>
      );
    default:
      return null;
  }
};

export default ChatMessages;
