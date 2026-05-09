"use client";
import ChatSidebar from "@/app/chat/components/ChatSidebar";
import Loading from "@/app/chat/components/Loading";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import ChatHeader from "@/app/chat/components/ChatHeader";
import ChatMessages from "@/app/chat/components/ChatMessages";
import MessageInput from "@/app/chat/components/MessageInput";
import { secureJsonPost, secureFormPost } from "@/lib/csrf-client";

export interface Message {
  _id: string;
  chatId: string;
  sender: string;
  text?: string;
  media?: {
    url: string;
    publicId: string;
    originalName?: string;
    type: "image" | "pdf" | "video" | "audio" | "file";
  };
  caseRequest?: {
    status: "pending" | "accepted" | "rejected" | "filed";
    clientId: string;
    lawyerId: string;
    caseId?: string;
    requestedAt?: string;
    respondedAt?: string;
    filedAt?: string;
  };
  vault?: {
    added: boolean;
    vaultId?: string;
    caseId?: string;
    addedAt?: string;
    addedBy?: string;
  };
  messageType: "text" | "media" | "case_request";
  seen: boolean;
  seenAt?: string;
  createdAt: string;
}

export interface User {
  _id: string;
  name: string;
  role?: string;
}

interface ChatListItem {
  user: User;
  chat: {
    _id: string;
    latestMessage?: {
      text: string;
      sender: string;
    } | null;
    unseenCount?: number;
  };
}

interface VaultContext {
  caseId: string;
  title: string;
  clientId: string;
  lawyerId: string;
  vaultId: string | null;
}

interface TypingPayload {
  chatId: string;
  userId: string;
}

interface ChatSocket {
  on: (event: string, callback: (payload: Message | TypingPayload) => void) => void;
  off: (event: string) => void;
  emit: (event: string, data: TypingPayload) => void;
}

const ChatAppContent = () => {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedUser, setSelectedUser] = useState<string | null>(null); // chatId
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [chatUser, setChatUser] = useState<User | null>(null); // lawyer we are chatting with
  const [message, setMessage] = useState("");
  const [siderbarOpen, setSiderbarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeOut, setTypingTimeOut] = useState<NodeJS.Timeout | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [vaultContext, setVaultContext] = useState<VaultContext | null>(null);

  const socket: ChatSocket = {
    on: (_event, _callback) => undefined,
    off: (_event) => undefined,
    emit: (_event, _data) => undefined,
  };

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData.userId) {
      setLoggedInUser({ _id: userData.userId, name: userData.fullName || userData.email || "User", role: userData.role });
      setIsAuth(true);
    } else {
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!isAuth || loading) return;
    
    const userId = searchParams.get("userId");
    const userName = searchParams.get("userName");
    if (!userId) return;

    const lawyer: User = { _id: userId, name: userName || "Lawyer" };
    setChatUser(lawyer);
    createChatWithLawyer(lawyer);
  }, [searchParams, isAuth, loading]);

  useEffect(() => {
    if (isAuth && !loading) {
      loadChats();
    }
  }, [isAuth, loading]);

  useEffect(() => {
    if (!isAuth || !loggedInUser) return;

    const sendHeartbeat = async () => {
      try {
        await secureJsonPost("/api/users/presence", {});
      } catch (error) {
        console.error("Presence heartbeat failed:", error);
      }
    };

    const loadOnlineUsers = async () => {
      try {
        const resp = await fetch("/api/users/presence");
        if (!resp.ok) return;
        const data = await resp.json();
        setOnlineUsers(data.onlineUserIds || []);
      } catch (error) {
        console.error("Presence fetch failed:", error);
      }
    };

    const initializePresence = async () => {
      await sendHeartbeat();
      await loadOnlineUsers();
    };

    initializePresence();

    const heartbeatInterval = window.setInterval(() => {
      sendHeartbeat();
      loadOnlineUsers();
    }, 30000);
    const onlineUsersInterval = window.setInterval(loadOnlineUsers, 15000);

    return () => {
      window.clearInterval(heartbeatInterval);
      window.clearInterval(onlineUsersInterval);
    };
  }, [isAuth, loggedInUser]);

  const createChatWithLawyer = async (lawyer: User) => {
    if (!loggedInUser) return;
    setCreatingChat(true);
    try {
      const response = await secureJsonPost("/api/chats", { otherUserId: lawyer._id });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create chat");
      }

      const data = await response.json();
      setMessages(null);
      setSelectedUser(data.chatId || lawyer._id);
      setChatUser(lawyer);
      await loadChats();
    } catch (e) {
      console.error(e);
      toast.error("Unable to start chat with the selected lawyer.");
      setSelectedUser(null);
    } finally {
      setCreatingChat(false);
    }
  };

  const loadMessages = async (chatId: string, silent = false) => {
    if (!loggedInUser) return;
    try {
      const resp = await fetch(`/api/chats/${chatId}/messages`);
      if (!resp.ok) throw new Error("Failed to load messages");
      const { messages } = await resp.json();
      setMessages(messages);
    } catch (e) {
      console.error(e);
      if (!silent) toast.error("Could not fetch chat messages.");
    }
  };

  const loadChats = async () => {
    if (!loggedInUser) return;
    try {
      const resp = await fetch("/api/chats");
      if (!resp.ok) throw new Error("Failed to load chats");
      const { chats } = await resp.json();
      setChats(chats);
    } catch (e) {
      console.error(e);
      toast.error("Could not fetch chats.");
    }
  };

  const loadVaultContext = async (chatId: string) => {
    try {
      const resp = await fetch(`/api/chats/${chatId}/vault-context`);
      if (!resp.ok) {
        setVaultContext(null);
        return;
      }

      const data = await resp.json();
      setVaultContext(data.activeCase || null);
    } catch (error) {
      console.error("Could not load vault context:", error);
      setVaultContext(null);
    }
  };

  useEffect(() => {
    if (!selectedUser) {
      setMessages(null);
      setVaultContext(null);
      return;
    }

    setMessages(null);
    loadMessages(selectedUser);
    loadVaultContext(selectedUser);

    const interval = window.setInterval(() => {
      loadMessages(selectedUser, true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [selectedUser]);

  const handleMessageSend = async (e: React.FormEvent<HTMLFormElement>, file?: File | null) => {
    e.preventDefault();
    if (!message.trim() && !file) return;
    if (!selectedUser || !loggedInUser) return;

    if (typingTimeOut) {
      clearTimeout(typingTimeOut);
      setTypingTimeOut(null);
    }
    socket?.emit("stopTyping", { chatId: selectedUser, userId: loggedInUser._id });

    try {
      const formData = new FormData();
      if (message.trim()) formData.append("text", message);
      if (file) formData.append("file", file);

      const resp = await secureFormPost(`/api/chats/${selectedUser}/messages`, formData);
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to send message");
      }
      const { message: newMsg } = await resp.json();
      setMessages(prev => {
        const cur = prev || [];
        const exists = cur.some(m => m._id === newMsg._id);
        return exists ? cur : [...cur, newMsg];
      });
      setMessage("");
      await loadChats();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const handleCaseRequestSend = async () => {
    if (!selectedUser || !loggedInUser) return;

    try {
      const resp = await secureJsonPost(`/api/chats/${selectedUser}/case-request`, {});
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to send case request");
      }

      const { message: newMsg } = await resp.json();
      setMessages(prev => {
        const cur = prev || [];
        const exists = cur.some(m => m._id === newMsg._id);
        return exists ? cur : [...cur, newMsg];
      });
      await loadChats();
      toast.success("Case request sent to lawyer.");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send case request");
    }
  };

  const handleCaseRequestAction = async (messageId: string, action: "accept" | "reject") => {
    try {
      const resp = await secureJsonPost(`/api/case-requests/${messageId}`, { action });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || `Failed to ${action} case request`);
      }

      const { message: updatedMessage } = await resp.json();
      setMessages(prev => (prev || []).map(msg => msg._id === updatedMessage._id ? updatedMessage : msg));
      await loadChats();

      if (action === "accept") {
        toast.success("Case request accepted. Complete the filing form.");
        router.push(`/cases/new?requestId=${messageId}`);
      } else {
        toast.success("Case request rejected.");
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : `Failed to ${action} case request`);
    }
  };

  const handleAddMediaToVault = async (messageId: string) => {
    if (!selectedUser) return;

    try {
      const resp = await secureJsonPost(`/api/chats/${selectedUser}/messages/${messageId}/vault`, {});
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to add media to vault");
      }

      setMessages(prev => (prev || []).map(msg => msg._id === data.message._id ? data.message : msg));
      toast.success(`Media added to vault for ${data.caseId}.`);
      await loadVaultContext(selectedUser);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to add media to vault");
    }
  };

  const handleTyping = (value: string) => {
    setMessage(value);
    if (!selectedUser || !loggedInUser) return;
    if (value.trim()) socket.emit("typing", { chatId: selectedUser, userId: loggedInUser._id });
    if (typingTimeOut) clearTimeout(typingTimeOut);
    const timeout = setTimeout(() => {
      socket.emit("stopTyping", { chatId: selectedUser, userId: loggedInUser._id });
    }, 2000);
    setTypingTimeOut(timeout);
  };

  useEffect(() => {
    socket?.on("newMessage", (payload) => {
      const msg = payload as Message;
      if (msg.chatId === selectedUser) {
        setMessages(prev => {
          const cur = prev || [];
          const exists = cur.some(m => m._id === msg._id);
          return exists ? cur : [...cur, msg];
        });
        setIsTyping(false);
      }
    });
    socket?.on("userTyping", (payload) => {
      const data = payload as TypingPayload;
      if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) setIsTyping(true);
    });
    socket?.on("userStoppedTyping", (payload) => {
      const data = payload as TypingPayload;
      if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) setIsTyping(false);
    });
    return () => {
      socket?.off("newMessage");
      socket?.off("userTyping");
      socket?.off("userStoppedTyping");
    };
  }, [selectedUser]);

  if (loading) return <Loading />;
  if (creatingChat) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <span className="text-lg">Creating chat, please wait...</span>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-900 text-white relative overflow-hidden">
      <ChatSidebar
        sidebarOpen={siderbarOpen}
        setSidebarOpen={setSiderbarOpen}
        showAllUsers={false}
        setShowAllUsers={setShowAllUsers}
        users={[]}
        loggedInUser={loggedInUser || { _id: "", name: "User" }}
        chats={chats}
        selectedUser={selectedUser}
        onSelectChat={(chatId, user) => {
          setMessages(null);
          setSelectedUser(chatId);
          setChatUser(user);
        }}
        handleLogout={() => {
          localStorage.removeItem('user');
          router.push("/login");
        }}
        createChat={createChatWithLawyer}
        onlineUsers={onlineUsers}
      />
      <div className="flex-1 flex flex-col justify-between p-4 backdrop-blur-xl bg-white/5 border-1 border-white/10">
        {/* Header showing the lawyer's name */}
        <ChatHeader
          user={chatUser}
          setSidebarOpen={setSiderbarOpen}
          isTyping={isTyping}
          onlineUsers={onlineUsers}
        />
        {/* Message list */}
        <ChatMessages
          selectedUser={selectedUser}
          messages={messages}
          loggedInUser={loggedInUser || { _id: "", name: "User" }}
          onCaseRequestAction={handleCaseRequestAction}
          activeVaultCase={vaultContext}
          onAddMediaToVault={handleAddMediaToVault}
        />
        {/* Input area – only shown once a chat is active */}
        {selectedUser && (
          <MessageInput
            selectedUser={selectedUser}
            message={message}
            setMessage={handleTyping}
            handleMessageSend={handleMessageSend}
            canSendCaseRequest={loggedInUser?.role === "client"}
            handleCaseRequestSend={handleCaseRequestSend}
          />
        )}
      </div>
    </div>
  );
};

export default function ChatApp() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatAppContent />
    </Suspense>
  );
}
