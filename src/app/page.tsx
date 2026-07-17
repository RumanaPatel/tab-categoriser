"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PastSweep {
  id: string;
  createdAt: string;
  stats: { total: number; kept: number; filtered: number };
  clusterCount: number;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pastSweeps, setPastSweeps] = useState<PastSweep[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sweeps: PastSweep[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("tabs-")) continue;
      try {
        const d = JSON.parse(localStorage.getItem(key)!);
        sweeps.push({
          id: d.id,
          createdAt: d.createdAt,
          stats: d.stats,
          clusterCount: d.clusters?.length || 0,
        });
      } catch { /* skip corrupt entries */ }
    }
    sweeps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPastSweeps(sweeps);
  }, []);

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
              <p className="font-medium text-zinc-700 dark:text-zinc-300">Mobile:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Chrome Android:</strong> Open tab switcher &rarr; &quot;Select tabs&quot; (top right) &rarr; select all &rarr; Share &rarr; &quot;Copy to clipboard&quot;</li>
                <li><strong>Safari iOS:</strong> Hold the tabs button &rarr; &quot;Copy Links&quot; copies all open tabs</li>
                <li><strong>Firefox Android:</strong> Tab tray &rarr; menu (&#8942;) &rarr; &quot;Share all tabs&quot;</li>
              </ul>
              <p className="font-medium text-zinc-700 dark:text-zinc-300 mt-3">Desktop:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Chrome:</strong> Install the &quot;Copy All URLs&quot; extension, then click it to copy all tabs</li>
                <li><strong>Firefox:</strong> Right-click any tab &rarr; &quot;Select All Tabs&quot; &rarr; right-click &rarr; &quot;Copy Tab URLs&quot;</li>
                <li><strong>Safari:</strong> Use the &quot;Tab Links&quot; extension from the App Store</li>
                <li><strong>Edge:</strong> Right-click any tab &rarr; &quot;Select All Tabs&quot; &rarr; right-click &rarr; &quot;Copy link to all tabs&quot;</li>
              </ul>
            </div>
          )}
        </div>

        {pastSweeps.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Past sweeps</h2>
            {pastSweeps.map((sweep) => (
              <button
                key={sweep.id}
                onClick={() => router.push(`/r/${sweep.id}`)}
                className="w-full flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    {sweep.stats.kept} tabs &middot; {sweep.clusterCount} clusters
                  </p>
                  <p className="text-xs text-zinc-400">
                    {new Date(sweep.createdAt).toLocaleDateString(undefined, {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="text-xs text-zinc-400">&rarr;</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-zinc-400">
          Your URLs are sent to Claude for clustering, then saved to your browser. Nothing leaves your device except the API call.
        </p>
      </main>
    </div>
  );
}
