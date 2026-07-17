"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      // Store result in localStorage for now (KV persistence coming next)
      localStorage.setItem(`tabs-${data.id}`, JSON.stringify(data));
      router.push(`/r/${data.id}`);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4">
      <main className="w-full max-w-2xl flex flex-col gap-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tab Therapist
          </h1>
          <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
            Paste your tabs. Get clarity. Close with confidence.
          </p>
        </div>

        <textarea
          className="w-full h-64 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder={"Paste your tab URLs here, one per line...\n\nhttps://example.com/article\nhttps://amazon.com/dp/B08...\nhttps://medium.com/@user/building-data-pipelines"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Clustering your tabs..." : "Categorise my tabs"}
        </button>

        <div className="text-center">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2"
          >
            How do I export my tabs?
          </button>

          {showHelp && (
            <div className="mt-3 text-left text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 space-y-2">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">Getting your tab URLs:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Chrome:</strong> Install the &quot;Copy All URLs&quot; extension, then click it to copy all tabs</li>
                <li><strong>Firefox:</strong> Right-click any tab &rarr; &quot;Select All Tabs&quot; &rarr; right-click &rarr; &quot;Copy Tab URLs&quot;</li>
                <li><strong>Safari:</strong> Use the &quot;Tab Links&quot; extension from the App Store</li>
                <li><strong>Edge:</strong> Right-click any tab &rarr; &quot;Select All Tabs&quot; &rarr; right-click &rarr; &quot;Copy link to all tabs&quot;</li>
                <li><strong>Any browser:</strong> Use a bookmarklet &mdash; search &quot;copy all tab URLs bookmarklet&quot;</li>
              </ul>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400">
          Your URLs are sent to Claude for clustering. Nothing is stored beyond your dashboard.
        </p>
      </main>
    </div>
  );
}
