"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface TabItem {
  url: string;
  title: string;
}

interface Cluster {
  name: string;
  urls: TabItem[];
}

interface TabResult {
  id: string;
  createdAt: string;
  stats: { total: number; kept: number; filtered: number };
  clusters: Cluster[];
  filtered: TabItem[];
}

type ClusterState = "active" | "collapsed";

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<TabResult | null>(null);
  const [clusterStates, setClusterStates] = useState<Record<number, ClusterState>>({});
  const [showFiltered, setShowFiltered] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`tabs-${id}`);
    if (stored) {
      setData(JSON.parse(stored));
    }
  }, [id]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard not found</h1>
          <p className="text-zinc-500">This link may have expired or the data is on another device.</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-blue-600 hover:text-blue-500 underline"
          >
            Paste new tabs
          </button>
        </div>
      </div>
    );
  }

  function dismissCluster(index: number) {
    setClusterStates(prev => ({ ...prev, [index]: "collapsed" }));
    // Check if all done
    const newStates = { ...clusterStates, [index]: "collapsed" as const };
    const allCollapsed = data!.clusters.every((_, i) => newStates[i] === "collapsed");
    if (allCollapsed) setAllDone(true);
  }

  function acceptAll() {
    const newStates: Record<number, ClusterState> = {};
    data!.clusters.forEach((_, i) => { newStates[i] = "collapsed"; });
    setClusterStates(newStates);
    setAllDone(true);
  }

  function removeTab(clusterIndex: number, urlIndex: number) {
    const updated = { ...data! };
    updated.clusters = updated.clusters.map((c, ci) => {
      if (ci !== clusterIndex) return c;
      return { ...c, urls: c.urls.filter((_, ui) => ui !== urlIndex) };
    });
    // Remove empty clusters
    updated.clusters = updated.clusters.filter(c => c.urls.length > 0);
    setData(updated);
    localStorage.setItem(`tabs-${id}`, JSON.stringify(updated));
  }

  function copyClusterLinks(cluster: Cluster) {
    const text = cluster.urls.map(t => t.url).join("\n");
    navigator.clipboard.writeText(text);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabs-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Tab Therapist</h1>
            <p className="text-sm text-zinc-500">
              {data.stats.total} tabs pasted &middot; {data.stats.kept} categorised &middot; {data.stats.filtered} filtered
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportJson}
              className="px-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={acceptAll}
              disabled={allDone}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
            >
              Accept all
            </button>
          </div>
        </div>

        {allDone && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-center">
            <p className="text-lg font-medium text-green-800 dark:text-green-200">
              All clear! You can close your tabs now.
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Your tabs are saved here. Come back anytime.
            </p>
          </div>
        )}

        {/* Clusters */}
        {data.clusters.map((cluster, ci) => {
          const state = clusterStates[ci] || "active";
          return (
            <div
              key={ci}
              className={`rounded-lg border transition-all ${
                state === "collapsed"
                  ? "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 opacity-60"
                  : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {cluster.name}
                  </h2>
                  <span className="text-xs text-zinc-500">{cluster.urls.length} tabs</span>
                </div>
                <div className="flex gap-2">
                  {state === "active" && (
                    <>
                      <button
                        onClick={() => copyClusterLinks(cluster)}
                        className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Copy links
                      </button>
                      <button
                        onClick={() => dismissCluster(ci)}
                        className="px-2 py-1 text-xs rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                      >
                        Done
                      </button>
                    </>
                  )}
                </div>
              </div>

              {state === "active" && (
                <div className="border-t border-zinc-200 dark:border-zinc-800">
                  {cluster.urls.map((tab, ti) => (
                    <div
                      key={ti}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 group"
                    >
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0"
                      >
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
                          {tab.title || tab.url}
                        </p>
                        {tab.title && (
                          <p className="text-xs text-zinc-400 truncate">{tab.url}</p>
                        )}
                      </a>
                      <button
                        onClick={() => removeTab(ci, ti)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs transition-opacity"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Filtered tabs section */}
        {data.filtered.length > 0 && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
            <button
              onClick={() => setShowFiltered(!showFiltered)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-sm text-zinc-500">
                Filtered out ({data.filtered.length} tabs)
              </span>
              <span className="text-xs text-zinc-400">{showFiltered ? "Hide" : "Show"}</span>
            </button>

            {showFiltered && (
              <div className="border-t border-zinc-200 dark:border-zinc-800">
                {data.filtered.map((tab, fi) => (
                  <div key={fi} className="px-4 py-2">
                    <a
                      href={tab.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-400 hover:text-zinc-600 truncate block"
                    >
                      {tab.url}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-400 hover:text-zinc-600 underline"
          >
            Paste new tabs
          </button>
        </div>
      </div>
    </div>
  );
}
