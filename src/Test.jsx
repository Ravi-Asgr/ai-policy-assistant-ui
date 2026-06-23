import React, { useState, useRef } from "react";
import { Send, Bot, User, Loader2, AlertCircle, Zap } from "lucide-react";

//const RAG_ENDPOINT = "https://ai-policy-assistant-doe8.onrender.com/bot/testmodel";
const RAG_ENDPOINT = "http://localhost:8080/webhook/github/search";
const STREAM_ENDPOINT = "https://ai-policy-assistant-doe8.onrender.com/bot/teststreammodel";

function renderPrResponse(response) {
  // Normalize response shapes from backend (be permissive)
  if (!response) return null;

  // If backend returned an envelope with data array
  const data =
    Array.isArray(response.searchResultRow) && response.searchResultRow.length > 0
      ? response.searchResultRow
      : Array.isArray(response.prs) && response.prs.length > 0
      ? response.prs
      : Array.isArray(response.items) && response.items.length > 0
      ? response.items
      : null;

  const status = response.status ?? (data ? "success" : null);
  const message = response.message ?? response.msg ?? null;

  if (status === "success" && data) {
    return (
      <div className="table-wrapper mt-4">
        <table className="pr-table w-full">
          <thead>
            <tr>
              <th className="text-left">PR</th>
              <th className="text-left">Author</th>
              <th className="text-left">Files</th>
              <th className="text-left">Merged At</th>
              <th className="text-left">PR URL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((pr, idx) => {
              // Support multiple naming conventions
              const prNumber = pr.prNumber ?? pr.prNumber ?? pr.id ?? pr.pr ?? idx + 1;
              const author = pr.author ?? pr.authorName ?? "—";
              const files = Array.isArray(pr.changeFiles)
                ? pr.changeFiles
                : pr.changeFiles
                ? pr.change_files
                : pr.files_list
                ? pr.files_list
                : pr.files?.split?.(",") ?? [];
              const mergedAt = pr.merged_at ?? pr.mergedAt ?? pr.merged_at_milli ?? "—";
              const prUrl = pr.pr_url ?? pr.prUrl ?? pr.url ?? pr.pull_request_url ?? "";

              return (
                <tr key={`${prNumber}-${idx}`} className="hover:bg-slate-50">
                  <td className="py-2">{prNumber}</td>
                  <td className="py-2">{author}</td>
                  <td className="py-2">{Array.isArray(files) ? files.join(", ") : String(files)}</td>
                  <td className="py-2">{mergedAt}</td>
                  <td className="py-2">
                    {prUrl ? (
                      <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        View PR
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // If backend returned a message or not found
  if (message) {
    return (
      <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
        {message}
      </div>
    );
  }

  // Default fallback
  return <div className="mt-4 text-sm text-slate-600">No results.</div>;
}

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
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [prResponse, setPrResponse] = useState(null); // holds structured PR response when backend returns JSON
  const abortRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading || streaming) return;

    setError("");
    setLoading(true);
    setQuestion("");
    setPrResponse(null);

    setMessages((prev) => [...prev, { role: "user", content: trimmedQuestion }]);

    try {
      const url = `${RAG_ENDPOINT}`;
      console.log("Calling RAG : " + url);

      const response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json, text/plain, */*", "Content-Type": "text/plain" },
        body: trimmedQuestion
      });

      if (!response.ok) {
        // Try to read body for error details
        const txt = await response.text().catch(() => "");
        throw new Error(`Request failed with status ${response.status}${txt ? `: ${txt}` : ""}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let answerText = "";
      let parsedJson = null;

      if (contentType.includes("application/json")) {
        parsedJson = await response.json();
      } else {
        // Try to parse text as JSON if possible
        const text = await response.text();
        try {
          parsedJson = text ? JSON.parse(text) : null;
        } catch {
          parsedJson = null;
          answerText = text;
        }
      }

      // If parsedJson looks like a PR response (has data/prs/items), treat it as structured
      const hasDataArray =
        parsedJson &&
        (Array.isArray(parsedJson.searchResultRow) ||
          Array.isArray(parsedJson.prs) ||
          Array.isArray(parsedJson.items));

      if (hasDataArray) {
        setPrResponse(parsedJson);
        // Also add a short assistant message summarizing the result
        const count =
          (Array.isArray(parsedJson.searchResultRow) && parsedJson.searchResultRow.length) ||
          (Array.isArray(parsedJson.prs) && parsedJson.prs.length) ||
          (Array.isArray(parsedJson.items) && parsedJson.items.length) ||
          0;
        const summary = count > 0 ? `Found ${count} PR(s). Showing results below.` : parsedJson.message ?? "No PRs found.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: summary }
        ]);
      } else if (parsedJson && typeof parsedJson === "object") {
        // Generic JSON object but not PR list: stringify for display and also keep as message
        answerText = parsedJson.answer || parsedJson.response || parsedJson.message || JSON.stringify(parsedJson, null, 2);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: answerText || "No response received from the RAG application." }
        ]);
      } else {
        // Plain text response
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: answerText || "No response received from the RAG application."
          }
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong.";
      setError(errorMessage);
      setMessages((prev) => [
        ...prev,
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

  async function handleStream(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading || streaming) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setStreaming(true);
    setQuestion("");
    setPrResponse(null);

    // Add user message, then empty assistant placeholder for streaming
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmedQuestion },
      { role: "assistant", content: "" }
    ]);

    try {
      const url = `${STREAM_ENDPOINT}?q=${encodeURIComponent(trimmedQuestion)}`;
      console.log("Calling Stream : " + url);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" }
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        console.log(">>>>> Raw Chunk: " + raw);
        raw.split("\n").forEach((line) => {
          if (line.startsWith("data: ")) {
            const token = line.slice(6);
            if (token && token !== "[DONE]") {
              // functional update appends each token to last message
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + token
                };
                return updated;
              });
            }
          }
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        const errorMessage = err instanceof Error ? err.message : "Stream failed.";
        setError(errorMessage);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "Sorry, I could not get a stream response. Please try again."
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
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
            {/* If we have a structured PR response, render it above the chat messages */}
            {prResponse && renderPrResponse(prResponse)}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="mt-1 h-9 w-9 shrink-0 rounded-full bg-blue-100 p-2 text-blue-700">
                    <Bot size={20} />
                  </div>
                )}

                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {message.content}
                  {/* blinking cursor on the last streaming message */}
                  {streaming && index === messages.length - 1 && message.role === "assistant" && (
                    <span className="ml-0.5 animate-pulse">▌</span>
                  )}
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
                placeholder='e.g. "PRs that modified LICENSE last week by Ravi-Asgr"'
                className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              {/* existing Submit button — unchanged */}
              <button
                type="submit"
                disabled={loading || streaming || !question.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                <span className="ml-2 hidden sm:inline">Submit</span>
              </button>

              {/* new Stream button */}
              <button
                type="button"
                onClick={handleStream}
                disabled={loading || streaming || !question.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {streaming ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Zap size={18} />
                )}
                <span className="ml-2 hidden sm:inline">Stream</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
