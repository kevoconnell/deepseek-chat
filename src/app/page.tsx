"use client";

import { useEffect, useState, useRef } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  isThinking?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface CodeProps extends React.HTMLProps<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm"
      title="Copy code"
    >
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-.293 7.293a1 1 0 011.414 0L12 11.172l2.879-2.879a1 1 0 111.414 1.414l-3.586 3.586a1 1 0 01-1.414 0l-3.586-3.586a1 1 0 010-1.414z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
          <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
        </svg>
      )}
    </button>
  );
}

function ThoughtBlock({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-md p-3 my-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
      </svg>
      <div className="flex-1 italic text-blue-700 whitespace-pre-wrap break-words [&_*]:text-blue-700">
        {content}
      </div>
    </div>
  );
}

function MessageContent({
  content,
  role,
}: {
  content: string;
  role: "user" | "assistant";
}) {
  if (role === "user") {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  // Helper function to find matching closing tag
  const findClosingTag = (str: string, startIndex: number): number => {
    let depth = 1;
    let i = startIndex;
    while (i < str.length && depth > 0) {
      if (str.slice(i, i + 7) === "<think>") {
        depth++;
        i += 7;
      } else if (str.slice(i, i + 8) === "</think>") {
        depth--;
        if (depth === 0) return i;
        i += 8;
      } else {
        i++;
      }
    }
    return -1;
  };

  // Process content to handle nested and mismatched tags
  const processedContent = content;
  let currentIndex = 0;
  let result = "";

  while (currentIndex < processedContent.length) {
    const nextThink = processedContent.indexOf("<think>", currentIndex);
    if (nextThink === -1) {
      // No more think tags, add the rest as regular content
      result += processedContent.slice(currentIndex);
      break;
    }

    // Add any content before the think tag
    result += processedContent.slice(currentIndex, nextThink);

    // Find matching closing tag
    const closingIndex = findClosingTag(processedContent, nextThink + 7);
    if (closingIndex === -1) {
      // No matching closing tag, treat rest as thought
      result += "<think>" + processedContent.slice(nextThink + 7) + "</think>";
      break;
    } else {
      // Add the complete thought
      result += processedContent.slice(nextThink, closingIndex + 8);
      currentIndex = closingIndex + 8;
    }
  }

  // Split content into thoughts and regular text
  const parts = result.split(/(<think>[^]*?<\/think>)/).filter(Boolean);

  const components: Components = {
    pre: ({ children, ...props }) => (
      <pre
        className="bg-gray-800 p-4 rounded-lg overflow-auto my-2 relative"
        {...props}
      >
        {children}
        {typeof children === "string" && <CopyButton content={children} />}
      </pre>
    ),
    code: ({ inline, className, children, ...props }: CodeProps) => {
      if (inline) {
        return (
          <code
            className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    p: (props) => <p className="mb-4 last:mb-0" {...props} />,
    a: (props) => (
      <a
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline"
        {...props}
      />
    ),
  };

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith("<think>") && part.endsWith("</think>")) {
          // Extract content between <think> tags
          const thoughtContent = part
            .replace(/<think>/, "")
            .replace(/<\/think>$/, "")
            .trim();
          return <ThoughtBlock key={index} content={thoughtContent} />;
        }
        // This is regular content
        return (
          part && (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words prose-p:my-2 prose-pre:my-2"
              components={components}
            >
              {part}
            </ReactMarkdown>
          )
        );
      })}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center space-x-2">
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}

export default function Home() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchConversationMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchModels = async () => {
    try {
      const response = await fetch("/api/ollama/models");
      const data = await response.json();
      if (data.models?.length > 0) {
        setModels(data.models.map((m: OllamaModel) => m.name));
        setSelectedModel(data.models[0].name);
      }
    } catch {
      setError("Failed to fetch models");
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch("/api/conversations");
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  };

  const fetchConversationMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations?id=${conversationId}`);
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to fetch conversation messages:", err);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      const data = await response.json();
      if (data.id) {
        setSelectedConversation(data.id);
        await fetchConversations();
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModel || isStreaming) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          model: selectedModel,
          conversationId: selectedConversation,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      // Add an empty assistant message that we'll update as we receive chunks
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";
      let isThinking = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonStr = line.replace(/^data: /, "").trim();
              const parsed = JSON.parse(jsonStr);

              if (parsed.type === "thinking") {
                isThinking = parsed.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.isThinking = isThinking;
                  }
                  return newMessages;
                });
              } else if (parsed.type === "chunk" && parsed.content) {
                fullContent += parsed.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    // Ensure we don't lose any content when updating
                    lastMessage.content = fullContent;
                    lastMessage.isThinking = isThinking;
                  }
                  return newMessages;
                });
              } else if (parsed.type === "done") {
                setSelectedConversation(parsed.conversationId);
                await fetchConversations();
              } else if (parsed.type === "error") {
                setError(parsed.error);
              }
            } catch (error) {
              console.warn("Failed to parse line:", line, error);
              continue;
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message");
    } finally {
      setIsStreaming(false);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering conversation selection
    try {
      const response = await fetch(`/api/conversations?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (selectedConversation === id) {
          setSelectedConversation(null);
          setMessages([]);
        }
        await fetchConversations();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        {error}
      </div>
    );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4">
          <button
            onClick={createNewConversation}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-2 px-4 flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
                selectedConversation === conv.id
                  ? "bg-blue-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="truncate text-sm text-gray-700">
                  {conv.title}
                </span>
              </div>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="p-1 hover:bg-gray-100 rounded-full"
                title="Delete conversation"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-gray-400 hover:text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Model selector */}
        <div className="border-b border-gray-200 p-4 bg-white">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-6 py-3 ${
                  message.role === "user"
                    ? "bg-blue-100 text-gray-900"
                    : "bg-white border border-gray-200 text-gray-900"
                } break-words overflow-hidden`}
              >
                {message.isThinking ? (
                  <ThinkingIndicator />
                ) : (
                  <MessageContent
                    content={message.content}
                    role={message.role}
                  />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isStreaming ? "Please wait..." : "Type your message..."
              }
              disabled={isStreaming}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isStreaming}
              className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${
                isStreaming ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {isStreaming ? (
                "Sending..."
              ) : (
                <>
                  Send
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
