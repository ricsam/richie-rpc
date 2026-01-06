/**
 * WebSocket React Integration Example
 *
 * This example demonstrates how to integrate the typed WebSocket client
 * with React using hooks for a chat application.
 */

import { createWebSocketClient } from '@richie-rpc/client/websocket';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { chatContract } from './contract';

// Create client outside component to avoid recreation
const wsClient = createWebSocketClient(chatContract, {
  baseUrl: 'ws://localhost:3000',
});

// Types for our state
interface Message {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
}

interface User {
  userId: string;
  username: string;
  avatar?: string;
}

interface TypingUser {
  userId: string;
  username: string;
}

// Custom hook for chat functionality
function useChat(roomId: string, username: string) {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create stable chat instance
  const chat = useMemo(() => wsClient.chat({ params: { roomId } }), [roomId]);

  // Connection lifecycle
  useEffect(() => {
    const disconnect = chat.connect();
    return () => disconnect();
  }, [chat]);

  // Track connection state
  useEffect(() => {
    return chat.onStateChange((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) {
        setJoined(false);
      }
    });
  }, [chat]);

  // Auto-join when connected
  useEffect(() => {
    if (connected && !joined) {
      chat.send('join', { username });
    }
  }, [connected, joined, chat, username]);

  // Handle room state (join confirmation)
  useEffect(() => {
    return chat.on('roomState', (state) => {
      setJoined(true);
      setUsers(state.users);
      setMessages(state.recentMessages);
      setError(null);
    });
  }, [chat]);

  // Handle new messages
  useEffect(() => {
    return chat.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
  }, [chat]);

  // Handle user join
  useEffect(() => {
    return chat.on('userJoined', (data) => {
      setUsers((prev) => [
        ...prev,
        { userId: data.userId, username: data.username, avatar: data.avatar },
      ]);
    });
  }, [chat]);

  // Handle user leave
  useEffect(() => {
    return chat.on('userLeft', (data) => {
      setUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    });
  }, [chat]);

  // Handle typing indicators
  useEffect(() => {
    return chat.on('typing', (data) => {
      setTypingUsers((prev) => {
        if (data.isTyping) {
          // Add if not already typing
          if (!prev.find((u) => u.userId === data.userId)) {
            return [...prev, { userId: data.userId, username: data.username }];
          }
          return prev;
        } else {
          // Remove from typing
          return prev.filter((u) => u.userId !== data.userId);
        }
      });
    });
  }, [chat]);

  // Handle errors
  useEffect(() => {
    return chat.on('error', (err) => {
      setError(`${err.code}: ${err.message}`);
    });
  }, [chat]);

  // Handle connection errors
  useEffect(() => {
    return chat.onError((err) => {
      setError(`Connection error: ${err.message}`);
    });
  }, [chat]);

  // Actions
  const sendMessage = useCallback(
    (text: string) => {
      if (!joined) return;
      chat.send('message', { text });
    },
    [chat, joined],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!joined) return;
      chat.send('typing', { isTyping });
    },
    [chat, joined],
  );

  const leave = useCallback(() => {
    chat.send('leave', {});
  }, [chat]);

  return {
    connected,
    joined,
    users,
    messages,
    typingUsers,
    error,
    sendMessage,
    setTyping,
    leave,
  };
}

// Example Chat Component
export function ChatRoom({ roomId, username }: { roomId: string; username: string }) {
  const { connected, joined, users, messages, typingUsers, error, sendMessage, setTyping } =
    useChat(roomId, username);

  const [inputText, setInputText] = useState('');
  const [isTypingLocal, setIsTypingLocal] = useState(false);

  // Handle typing indicator with debounce
  useEffect(() => {
    if (inputText && !isTypingLocal) {
      setIsTypingLocal(true);
      setTyping(true);
    }

    const timeout = setTimeout(() => {
      if (isTypingLocal) {
        setIsTypingLocal(false);
        setTyping(false);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [inputText, isTypingLocal, setTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendMessage(inputText.trim());
    setInputText('');
    setIsTypingLocal(false);
    setTyping(false);
  };

  return (
    <div className="chat-room">
      {/* Header */}
      <div className="chat-header">
        <h2>Room: {roomId}</h2>
        <div className="status">
          {connected ? (joined ? '🟢 Connected' : '🟡 Joining...') : '🔴 Disconnected'}
        </div>
      </div>

      {/* Error display */}
      {error && <div className="error">{error}</div>}

      {/* Users list */}
      <div className="users-list">
        <h3>Online ({users.length})</h3>
        <ul>
          {users.map((user) => (
            <li key={user.userId}>
              {user.avatar && <img src={user.avatar} alt="" />}
              {user.username}
              {user.username === username && ' (you)'}
            </li>
          ))}
        </ul>
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.username === username ? 'own' : ''}`}>
            <span className="username">{msg.username}</span>
            <span className="text">{msg.text}</span>
            <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.map((u) => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'}{' '}
          typing...
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="message-form">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          disabled={!joined}
        />
        <button type="submit" disabled={!joined || !inputText.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

// App component example
export function App() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('general');
  const [inRoom, setInRoom] = useState(false);

  if (!inRoom) {
    return (
      <div className="join-form">
        <h1>Join Chat</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={() => setInRoom(true)} disabled={!username || !roomId}>
          Join
        </button>
      </div>
    );
  }

  return <ChatRoom roomId={roomId} username={username} />;
}
