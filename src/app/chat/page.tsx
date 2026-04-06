"use client";
import ChatSidebar from "@/app/chat/components/ChatSidebar";
import Loading from "@/app/chat/components/Loading";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
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
    type: "image" | "pdf" | "video" | "audio" | "file";
  };
  messageType: "text" | "media";
  seen: boolean;
  seenAt?: string;
  createdAt: string;
}

export interface User {
  _id: string;
  name: string;
}

const ChatApp = () => {
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
  const [chats, setChats] = useState<any[]>([]);

  const socket: any = {
    on: (event: string, callback: any) => {},
    off: (event: string) => {},
    emit: (event: string, data: any) => {}
  };

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData.userId) {
      setLoggedInUser({ _id: userData.userId, name: userData.fullName || userData.email || "User" });
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
    console.log("Chat page state:", { isAuth, loading, selectedUser, chatUser, creatingChat });
  }, [isAuth, loading, selectedUser, chatUser, creatingChat]);

  useEffect(() => {
    if (isAuth && !loading) {
      loadChats();
    }
  }, [isAuth, loading]);

  const createChatWithLawyer = async (lawyer: User) => {
    if (!loggedInUser) return;
    setCreatingChat(true);
    try {
      console.log("Creating chat with lawyer:", lawyer);
      const response = await secureJsonPost("/api/chats", { otherUserId: lawyer._id });
      console.log("Chat creation response:", response);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to create chat");
      }

      const data = await response.json();
      console.log("Chat created/ retrieved:", data);
      setSelectedUser(data.chatId || lawyer._id);
      setChatUser(lawyer);
    } catch (e) {
      console.error(e);
      toast.error("Unable to start chat with the selected lawyer.");
      setSelectedUser(lawyer._id);
      setChatUser(lawyer);
    } finally {
      setCreatingChat(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!loggedInUser) return;
    try {
      const resp = await fetch(`/api/chats/${chatId}/messages`);
      if (!resp.ok) throw new Error("Failed to load messages");
      const { messages } = await resp.json();
      setMessages(messages);
    } catch (e) {
      console.error(e);
      toast.error("Could not fetch chat messages.");
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

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser);
    }
  }, [selectedUser]);

  const handleMessageSend = async (e: any, file?: File | null) => {
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

      console.log("Sending message with formData:", formData);
      const resp = await secureFormPost(`/api/chats/${selectedUser}/messages`, formData);
      console.log("Message send response:", resp);
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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send message");
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
    socket?.on("newMessage", (msg: any) => {
      if (msg.chatId === selectedUser) {
        setMessages(prev => {
          const cur = prev || [];
          const exists = cur.some(m => m._id === msg._id);
          return exists ? cur : [...cur, msg];
        });
        setIsTyping(false);
      }
    });
    socket?.on("userTyping", (data: any) => {
      if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) setIsTyping(true);
    });
    socket?.on("userStoppedTyping", (data: any) => {
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
        setSelectedUser={setSelectedUser}
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
        />
        {/* Input area – only shown once a chat is active */}
        {selectedUser && (
          <MessageInput
            selectedUser={selectedUser}
            message={message}
            setMessage={handleTyping}
            handleMessageSend={handleMessageSend}
          />
        )}
      </div>
    </div>
  );
};

export default ChatApp;
