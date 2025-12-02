"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AGENTS = [
  { id: "jake", name: "Jake", role: "Performance", color: "bg-orange-500" },
  { id: "grandma", name: "Rose", role: "Accessibility", color: "bg-pink-500" },
  { id: "alex", name: "Alex", role: "Security", color: "bg-red-500" },
  { id: "priya", name: "Priya", role: "QA", color: "bg-blue-500" },
  { id: "marcus", name: "Marcus", role: "Mobile", color: "bg-purple-500" },
];

interface Bug {
  title: string;
  severity: string;
  description: string;
  impact?: string;
  recommendation?: string;
  found_by?: string;
}

interface Update {
  type: string;
  persona?: string;
  thought?: string;
  phase?: string;
  bug?: Bug;
  bugs_count?: number;
  quality_score?: number;
  message?: string;
}

interface AgentResult {
  persona: string;
  status: string;
  bugs_found: Bug[];
  quality_score: number;
  summary: string;
}

interface TestResults {
  id: number;
  url: string;
  status: string;
  summary?: { total_bugs: number; critical: number; high: number; medium: number; low: number; avg_score: number };
  results: AgentResult[];
}

interface Usage {
  tests_used: number;
  tests_limit: number;
  tests_remaining: number;
  beta_active: boolean;
  beta_ends: string;
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored ? stored === 'dark' : true;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);
  const toggle = () => {
    const newDark = !dark;
    setDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDark);
  };
  return (
    <button onClick={toggle} className="p-2 rounded-lg btn-secondary" title="Toggle theme">
      {dark ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
      )}
    </button>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = { critical: "badge-critical", high: "badge-high", medium: "badge-medium", low: "badge-low" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls[severity] || cls.low}`}>{severity}</span>;
}

export default function Dashboard() {
  const { user } = useUser();
  const [url, setUrl] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["priya"]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [testId, setTestId] = useState<number | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [results, setResults] = useState<TestResults | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "bugs">("overview");
  const [usage, setUsage] = useState<Usage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch usage on load
  useEffect(() => {
    if (user?.id) {
      fetch(`${API_URL}/usage/${user.id}`)
        .then(res => res.json())
        .then(setUsage)
        .catch(() => {});
    }
  }, [user?.id]);

  const connectWebSocket = useCallback((id: number) => {
    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/ws/${id}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const update = JSON.parse(e.data);
      if (["keepalive", "pong", "connected"].includes(update.type)) return;
      setUpdates(prev => [...prev, update]);
      if (update.type === "test_completed") {
        setIsRunning(false);
        setIsCancelling(false);
        fetchResults(id);
      }
      if (update.type === "test_cancelling") {
        setIsCancelling(true);
      }
    };
    ws.onerror = () => setError("Connection failed. Is the backend running?");
    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 25000);
    return () => { clearInterval(ping); ws.close(); };
  }, []);

  const toggleAgent = (id: string) => setSelectedAgents(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const refreshUsage = useCallback(() => {
    if (user?.id) {
      fetch(`${API_URL}/usage/${user.id}`)
        .then(res => res.json())
        .then(setUsage)
        .catch(() => {});
    }
  }, [user?.id]);

  const startTest = async () => {
    if (!url || selectedAgents.length === 0) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError("URL must start with http:// or https://");
      return;
    }
    
    // Check if user has tests remaining
    if (usage && usage.tests_remaining <= 0) {
      setError("You've used all your free tests. Paid plans coming soon!");
      return;
    }
    
    setIsRunning(true);
    setIsCancelling(false);
    setUpdates([]);
    setResults(null);
    setError("");
    setActiveTab("overview");

    try {
      const res = await fetch(`${API_URL}/test/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, personas: selectedAgents, user_id: user?.id || "anonymous" }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to start");
      const data = await res.json();
      setTestId(data.test_id);
      connectWebSocket(data.test_id);
      refreshUsage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start test");
      setIsRunning(false);
    }
  };

  const stopTest = async () => {
    if (!testId) return;
    setIsCancelling(true);
    try {
      await fetch(`${API_URL}/test/${testId}/cancel`, { method: "POST" });
    } catch {
      setError("Failed to cancel test");
    }
  };

  const fetchResults = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/test/${id}`);
      setResults(await res.json());
    } catch { setError("Failed to fetch results"); }
  };

  const stats = results?.summary || (results?.results ? {
    total_bugs: results.results.reduce((a, r) => a + (r.bugs_found?.length || 0), 0),
    critical: results.results.reduce((a, r) => a + (r.bugs_found?.filter(b => b.severity === 'critical').length || 0), 0),
    high: results.results.reduce((a, r) => a + (r.bugs_found?.filter(b => b.severity === 'high').length || 0), 0),
    medium: results.results.reduce((a, r) => a + (r.bugs_found?.filter(b => b.severity === 'medium').length || 0), 0),
    low: results.results.reduce((a, r) => a + (r.bugs_found?.filter(b => b.severity === 'low').length || 0), 0),
    avg_score: results.results.length ? Math.round(results.results.reduce((a, r) => a + (r.quality_score || 0), 0) / results.results.length * 10) / 10 : 0
  } : null);

  const allBugs = results?.results?.flatMap(r => (r.bugs_found || []).map(b => ({ ...b, agent: r.persona }))) || [];
  const sortedBugs = [...allBugs].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-50 backdrop-blur-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            Simulant
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Test Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">Run professional AI testing on any website</p>
          </div>
          {usage && (
            <div className="card px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-semibold">{usage.tests_remaining}</span>
                  <span style={{ color: 'var(--text-muted)' }}> / {usage.tests_limit} tests left</span>
                </div>
                <div className="w-24 h-2 rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
                  <div 
                    className="h-full rounded-full bg-green-500" 
                    style={{ width: `${(usage.tests_remaining / usage.tests_limit) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Beta ends Dec 13, 2024
              </p>
            </div>
          )}
        </div>

        {error && <div className="mb-6 p-4 rounded-lg badge-critical text-sm">{error}</div>}

        {/* Test Config */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 card p-6">
            <label className="block text-sm font-medium mb-3">Target URL</label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="input flex-1 px-4 py-3 text-sm"
                disabled={isRunning}
              />
              {isRunning ? (
                <button
                  onClick={stopTest}
                  disabled={isCancelling}
                  className="px-6 py-3 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {isCancelling ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /></svg>Stopping...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Stop Test</>
                  )}
                </button>
              ) : (
                <button
                  onClick={startTest}
                  disabled={!url || selectedAgents.length === 0 || (usage && usage.tests_remaining <= 0)}
                  className="btn-primary px-6 py-3 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                  Start Test
                </button>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium">Agents</label>
              <button onClick={() => setSelectedAgents(AGENTS.map(a => a.id))} className="text-xs" style={{ color: 'var(--text-muted)' }} disabled={isRunning}>All</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {AGENTS.map((a) => (
                <button key={a.id} onClick={() => toggleAgent(a.id)} disabled={isRunning}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedAgents.includes(a.id) ? `${a.color} text-white` : 'btn-secondary'}`}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Feed */}
        <AnimatePresence>
          {isRunning && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${isCancelling ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
                <span className="text-sm font-medium">{isCancelling ? 'Stopping...' : 'Testing in progress'}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{updates.length} events</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {updates.map((u, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    {u.type === "persona_started" && <span><strong>{u.persona}</strong> started testing</span>}
                    {u.type === "phase" && <span style={{ color: 'var(--text-muted)' }}>{u.phase}</span>}
                    {u.type === "action" && u.thought && <span style={{ color: 'var(--text-secondary)' }}>{u.persona}: {u.thought.slice(0, 100)}...</span>}
                    {u.type === "bug_found" && u.bug && <span className="flex items-center gap-2"><SeverityBadge severity={u.bug.severity} /><strong>{u.bug.title}</strong></span>}
                    {u.type === "persona_completed" && <span className="text-green-600 dark:text-green-400"><strong>{u.persona}</strong> done · {u.bugs_count || 0} bugs · Score: {u.quality_score}/10</span>}
                    {u.type === "test_cancelling" && <span className="text-yellow-600 dark:text-yellow-400">{u.message}</span>}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {results && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {results.status === "cancelled" && (
              <div className="mb-6 p-4 rounded-lg badge-warning text-sm">
                Test was stopped early. Results shown are from completed work.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold">{stats.total_bugs}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Issues</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-red-500">{stats.critical}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Critical</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-orange-500">{stats.high}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>High</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold text-yellow-500">{stats.medium}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Medium</div>
              </div>
              <div className="card p-5 text-center">
                <div className="text-3xl font-bold">{stats.avg_score}<span className="text-lg" style={{ color: 'var(--text-muted)' }}>/10</span></div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Avg Score</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <button onClick={() => setActiveTab("overview")} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === "overview" ? "bg-white dark:bg-zinc-800 shadow-sm" : ""}`}>Agent Reports</button>
                <button onClick={() => setActiveTab("bugs")} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === "bugs" ? "bg-white dark:bg-zinc-800 shadow-sm" : ""}`}>All Issues ({stats.total_bugs})</button>
              </div>
              {activeTab === "bugs" && stats.total_bugs > 0 && (
                <div className="flex gap-2 text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Filter:</span>
                  <button className="badge-critical px-2 py-0.5 rounded">{stats.critical} Critical</button>
                  <button className="badge-high px-2 py-0.5 rounded">{stats.high} High</button>
                  <button className="badge-medium px-2 py-0.5 rounded">{stats.medium} Medium</button>
                </div>
              )}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-4">
                {results.results?.map((r) => {
                  const agent = AGENTS.find(a => a.id === r.persona);
                  return (
                    <div key={r.persona} className="card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${agent?.color || 'bg-gray-500'} flex items-center justify-center text-white font-bold`}>
                            {agent?.name[0] || r.persona[0]}
                          </div>
                          <div>
                            <div className="font-medium">{agent?.name || r.persona}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{agent?.role} Analyst</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div><div className="font-bold">{r.bugs_found?.length || 0}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>issues</div></div>
                          <div><div className="font-bold">{r.quality_score}/10</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>score</div></div>
                        </div>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.summary}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "bugs" && (
              <div className="space-y-3">
                {sortedBugs.length === 0 ? (
                  <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>No issues found.</div>
                ) : (
                  sortedBugs.map((bug, i) => (
                    <div key={i} className="card p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-start gap-3">
                          <SeverityBadge severity={bug.severity} />
                          <h3 className="font-semibold leading-tight">{bug.title}</h3>
                        </div>
                        <span className="text-xs whitespace-nowrap px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                          {bug.agent}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                        {bug.description}
                      </p>
                      {(bug.impact || bug.recommendation) && (
                        <div className="space-y-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                          {bug.impact && (
                            <div className="flex gap-2 text-sm">
                              <span className="font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>Impact:</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{bug.impact}</span>
                            </div>
                          )}
                          {bug.recommendation && (
                            <div className="flex gap-2 text-sm">
                              <span className="font-medium shrink-0 text-green-600 dark:text-green-400">Fix:</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{bug.recommendation}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {!isRunning && !results && (
          <div className="card p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            <h3 className="font-medium mb-1">Ready to test</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Enter a URL and select agents to begin</p>
          </div>
        )}
      </main>
    </div>
  );
}
