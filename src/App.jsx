import React, { useState } from "react";
import { Send, Bot, User, Loader2, AlertCircle } from "lucide-react";

const RAG_ENDPOINT = "https://ai-policy-assistant-doe8.onrender.com/bot/testmodel";

export default function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! Ask me a policy-related question and I will send it to your RAG application."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

    setError("");
    setLoading(true);
    setQuestion("");

    const userMessage = {
      role: "user",
      content: trimmedQuestion
    };

    setMessages((previousMessages) => [...previousMessages, userMessage]);

    try {
      const url = `${RAG_ENDPOINT}?q=${encodeURIComponent(trimmedQuestion)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*"
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let answerText = "";

      if (contentType.includes("application/json")) {
        const data = await response.json();

        answerText =
          data.answer ||
          data.response ||
          data.message ||
          JSON.stringify(data, null, 2);
      } else {
        answerText = await response.text();
      }

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content:
            answerText || "No response received from the RAG application."
        }
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong.";

      setError(errorMessage);

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content:
            "Sorry, I could not get a response from the RAG application. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl flex-col">
        <header className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600 p-3 text-white">
              <Bot size={24} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Policy Assistant
              </h1>
              <p className="text-sm text-slate-500">
                Simple React chatbot connected to your RAG endpoint
              </p>
            </div>
          </div>
        </header>

        <section className="flex flex-1 flex-col rounded-2xl bg-white shadow-sm">
          <main className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mt-1 h-9 w-9 shrink-0 rounded-full bg-blue-100 p-2 text-blue-700">
                    <Bot size={20} />
                  </div>
                )}

                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {message.content}
                </div>

                {message.role === "user" && (
                  <div className="mt-1 h-9 w-9 shrink-0 rounded-full bg-slate-200 p-2 text-slate-700">
                    <User size={20} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={18} />
                Waiting for RAG response...
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </main>

          <form onSubmit={handleSubmit} className="border-t bg-white p-4">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question..."
                className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}

                <span className="ml-2 hidden sm:inline">Submit</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}