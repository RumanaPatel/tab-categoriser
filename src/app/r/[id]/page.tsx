"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

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
  const [search, setSearch] = useState("");
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [editingCluster, setEditingCluster] = useState<number | null>(null);
  const [moveTab, setMoveTab] = useState<{ ci: number; ti: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`tabs-${id}`);
    if (stored) {
      setData(JSON.parse(stored));
    }
    const visitedStored = localStorage.getItem(`visited-${id}`);
    if (visitedStored) {
      setVisited(new Set(JSON.parse(visitedStored)));
    }
  }, [id]);

  useEffect(() => {
    if (editingCluster !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCluster]);

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

  function persist(updated: TabResult) {
    setData(updated);
    localStorage.setItem(`tabs-${id}`, JSON.stringify(updated));
  }

  function markVisited(url: string) {
    setVisited(prev => {
      const next = new Set(prev);
      next.add(url);
      localStorage.setItem(`visited-${id}`, JSON.stringify([...next]));
      return next;
    });
  }

  function toggleCluster(index: number) {
    const current = clusterStates[index] || "active";
    const next: ClusterState = current === "active" ? "collapsed" : "active";
    const newStates = { ...clusterStates, [index]: next };
    setClusterStates(newStates);
    const allCollapsed = data!.clusters.every((_, i) => newStates[i] === "collapsed");
    setAllDone(allCollapsed);
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
    updated.clusters = updated.clusters.filter(c => c.urls.length > 0);
    persist(updated);
  }

  function moveTabTo(fromCluster: number, tabIndex: number, toCluster: number) {
    const updated = { ...data! };
    const tab = updated.clusters[fromCluster].urls[tabIndex];
    updated.clusters = updated.clusters.map((c, ci) => {
      if (ci === fromCluster) {
        return { ...c, urls: c.urls.filter((_, ui) => ui !== tabIndex) };
      }
      if (ci === toCluster) {
        return { ...c, urls: [...c.urls, tab] };
      }
      return c;
    });
    updated.clusters = updated.clusters.filter(c => c.urls.length > 0);
    persist(updated);
    setMoveTab(null);
  }

  function renameCluster(index: number, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const updated = { ...data! };
    updated.clusters = updated.clusters.map((c, ci) =>
      ci === index ? { ...c, name: trimmed } : c
    );
    persist(updated);
    setEditingCluster(null);
  }

  function copyClusterLinks(cluster: Cluster) {
    const text = cluster.urls.map(t => t.url).join("\n");
    navigator.clipboard.writeText(text);
  }

  const OPEN_ALL_WARN_THRESHOLD = 15;

  function openAll(cluster: Cluster) {
    if (cluster.urls.length > OPEN_ALL_WARN_THRESHOLD) {
      if (!confirm(`Open ${cluster.urls.length} tabs at once?`)) return;
    }
    let blocked = false;
    for (const tab of cluster.urls) {
      const w = window.open(tab.url, "_blank", "noopener,noreferrer");
      if (!w) { blocked = true; break; }
    }
    if (blocked) {
      alert("Your browser blocked popups. Allow popups for this site and try again.");
    }
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

  const searchLower = search.toLowerCase();
  const hasSearch = searchLower.length > 0;

  function tabMatchesSearch(tab: TabItem): boolean {
    if (!hasSearch) return true;
    return tab.url.toLowerCase().includes(searchLower) ||
      tab.title.toLowerCase().includes(searchLower);
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

        {/* Search */}
        <input
          type="text"
          placeholder="Search tabs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

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
          const filteredUrls = hasSearch
            ? cluster.urls.filter(tabMatchesSearch)
            : cluster.urls;

          if (hasSearch && filteredUrls.length === 0) return null;

          return (
            <div
              key={ci}
              className={`rounded-lg border transition-all ${
                state === "collapsed"
                  ? "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 opacity-60"
                  : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              }`}
            >
              <div
                className={`flex items-center justify-between p-4 ${state === "collapsed" ? "cursor-pointer" : ""}`}
                onClick={state === "collapsed" ? () => toggleCluster(ci) : undefined}
              >
                <div className="flex-1 min-w-0">
                  {editingCluster === ci ? (
                    <input
                      ref={editInputRef}
                      defaultValue={cluster.name}
                      onBlur={(e) => renameCluster(ci, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameCluster(ci, e.currentTarget.value);
                        if (e.key === "Escape") setEditingCluster(null);
                      }}
                      className="font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-zinc-400 dark:border-zinc-500 outline-none w-full"
                    />
                  ) : (
                    <h2
                      className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-text"
                      onClick={(e) => {
                        if (state === "active") {
                          e.stopPropagation();
                          setEditingCluster(ci);
                        }
                      }}
                      title="Click to rename"
                    >
                      {cluster.name}
                    </h2>
                  )}
                  <span className="text-xs text-zinc-500">
                    {cluster.urls.length} tabs
                    {hasSearch && filteredUrls.length !== cluster.urls.length && ` (${filteredUrls.length} matching)`}
                    {state === "collapsed" ? " · click to expand" : ""}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  {state === "active" && (
                    <>
                      <button
                        onClick={() => openAll(cluster)}
                        className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Open all
                      </button>
                      <button
                        onClick={() => copyClusterLinks(cluster)}
                        className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Copy links
                      </button>
                      <button
                        onClick={() => toggleCluster(ci)}
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
                  {filteredUrls.map((tab, filteredIdx) => {
                    const ti = cluster.urls.indexOf(tab);
                    const isVisited = visited.has(tab.url);
                    return (
                      <div
                        key={ti}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 group"
                      >
                        <a
                          href={tab.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-1 min-w-0 ${isVisited ? "opacity-50" : ""}`}
                          onClick={() => markVisited(tab.url)}
                        >
                          <div className="flex items-center gap-2">
                            {isVisited && (
                              <span className="text-green-500 text-xs shrink-0" title="Visited">&#10003;</span>
                            )}
                            <div className="min-w-0">
                              <p className={`text-sm truncate ${isVisited ? "text-zinc-400 dark:text-zinc-500 line-through" : "text-zinc-800 dark:text-zinc-200"}`}>
                                {tab.title || tab.url}
                              </p>
                              {tab.title && (
                                <p className="text-xs text-zinc-400 truncate">{tab.url}</p>
                              )}
                            </div>
                          </div>
                        </a>
                        <div className="flex items-center gap-1 shrink-0">
                          {moveTab?.ci === ci && moveTab?.ti === ti ? (
                            <select
                              className="text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-1 py-0.5 text-zinc-700 dark:text-zinc-300"
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) moveTabTo(ci, ti, Number(e.target.value));
                              }}
                              onBlur={() => setMoveTab(null)}
                              autoFocus
                            >
                              <option value="" disabled>Move to...</option>
                              {data!.clusters.map((c, i) =>
                                i !== ci ? (
                                  <option key={i} value={i}>{c.name}</option>
                                ) : null
                              )}
                            </select>
                          ) : (
                            <button
                              onClick={() => setMoveTab({ ci, ti })}
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-zinc-400 hover:text-blue-500 text-xs p-1 transition-opacity"
                              title="Move to another cluster"
                            >
                              &#8594;
                            </button>
                          )}
                          <button
                            onClick={() => removeTab(ci, ti)}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs p-1 transition-opacity"
                            title="Remove"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
