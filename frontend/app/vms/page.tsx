"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Play, Square, RotateCcw, Trash2, Server, Wifi, WifiOff, Loader2, Search, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const WS  = API.replace("http", "ws");

interface VMInstance {
  display_name: string;
  public_ip: string;
  state: string;
  shape: string;
  instance_id: string;
  workspace_id?: string;
}

interface Workspace {
  workspace_id: string;
  instances: VMInstance[];
  resource_count: number;
  modified: number;
}

interface Tenancy { id: string; name: string; region: string; }

type ActionType = "START" | "STOP" | "RESET";

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    RUNNING:      "bg-green-900 text-green-300 border-green-700",
    STOPPED:      "bg-gray-800 text-gray-400 border-gray-600",
    STOPPING:     "bg-yellow-900 text-yellow-300 border-yellow-700",
    STARTING:     "bg-blue-900 text-blue-300 border-blue-700",
    TERMINATED:   "bg-red-900 text-red-400 border-red-700",
    PROVISIONING: "bg-purple-900 text-purple-300 border-purple-700",
  };
  const cls = map[state] || "bg-gray-800 text-gray-400 border-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {state}
    </span>
  );
}

export default function VMsPage() {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [selectedTenancy, setSelectedTenancy] = useState<string>("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>("");
  const [destroyWs, setDestroyWs] = useState<string | null>(null);
  const [destroyLogs, setDestroyLogs] = useState<string[]>([]);
  const [destroyDone, setDestroyDone] = useState(false);
  const [destroySuccess, setDestroySuccess] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [search, setSearch] = useState("");

  // โหลด tenancies
  useEffect(() => {
    fetch(`${API}/api/tenancies`).then(r => r.json()).then(d => setTenancies(d.tenancies || []));
  }, []);


  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedTenancy
        ? `${API}/api/terraform/workspaces?tenancy_id=${selectedTenancy}`
        : `${API}/api/terraform/workspaces`;
      const res = await fetch(url);
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedTenancy]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!autoRefresh) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    setCountdown(15);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { fetchWorkspaces(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [autoRefresh, fetchWorkspaces]);

  async function handleVMAction(instanceId: string, action: ActionType) {
    setActionLoading(instanceId + action);
    try {
      const body: Record<string, string> = { instance_id: instanceId, action };
      if (selectedTenancy) body.tenancy_id = selectedTenancy;
      const res = await fetch(`${API}/api/vms/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        await fetchWorkspaces();
      } else {
        alert("Error: " + (data.error || "Unknown error"));
      }
    } finally {
      setActionLoading("");
    }
  }

  function startDestroy(wsId: string) {
    setDestroyWs(wsId);
    setDestroyLogs([]);
    setDestroyDone(false);
    setDestroySuccess(false);
    const socket = new WebSocket(`${WS}/ws/terraform/destroy`);
    socket.onopen = () => socket.send(JSON.stringify({ workspace_id: wsId }));
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "log") {
        setDestroyLogs((prev) => [...prev, msg.message]);
      } else if (msg.type === "done") {
        setDestroyDone(true);
        setDestroySuccess(msg.success);
        if (msg.success) fetchWorkspaces();
      } else if (msg.type === "error") {
        setDestroyLogs((prev) => [...prev, "ERROR: " + msg.message]);
        setDestroyDone(true);
        setDestroySuccess(false);
      }
    };
  }

  const allInstances = workspaces
    .flatMap((ws) => ws.instances.map((inst) => ({ ...inst, workspace_id: ws.workspace_id })))
    .filter((vm) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        vm.display_name.toLowerCase().includes(q) ||
        vm.public_ip.includes(q) ||
        vm.state.toLowerCase().includes(q) ||
        vm.shape.toLowerCase().includes(q) ||
        (vm.workspace_id || "").includes(q)
      );
    });

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">OCI</div>
        <h1 className="text-xl font-semibold">VM Manager</h1>

        {/* Tenancy selector */}
        {tenancies.length > 0 && (
          <select
            title="เลือก Tenancy"
            value={selectedTenancy}
            onChange={e => setSelectedTenancy(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">🏢 ทุก Tenancy</option>
            {tenancies.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.region})</option>
            ))}
          </select>
        )}
        <div className="flex-1 max-w-xs mx-4 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา VM, IP, State..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          {search && (
            <button onClick={() => setSearch("")} title="ล้างการค้นหา" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={fetchWorkspaces} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href="/credentials"
            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition">
            + Deploy ใหม่
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* VM Cards */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Server size={18} className="text-red-400" /> VM Instances
          </h2>
          {loading && allInstances.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-400 py-8">
              <Loader2 size={16} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : allInstances.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
              ยังไม่มี VM —{" "}
              <Link href="/credentials" className="text-red-400 underline">Deploy ใหม่</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {allInstances.map((vm) => (
                <div key={vm.instance_id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold truncate">{vm.display_name || "Unnamed VM"}</span>
                      <StateBadge state={vm.state} />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span>🖥 {vm.shape || "-"}</span>
                      <span className="flex items-center gap-1">
                        {vm.public_ip
                          ? <><Wifi size={12} className="text-green-400" /> {vm.public_ip}</>
                          : <><WifiOff size={12} /> No Public IP</>}
                      </span>
                      <span className="text-xs text-gray-600 font-mono">ws: {vm.workspace_id}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleVMAction(vm.instance_id, "START")}
                      disabled={vm.state === "RUNNING" || !!actionLoading}
                      title="Start"
                      className="p-2 rounded-lg bg-green-900/40 hover:bg-green-800 text-green-400 disabled:opacity-30 transition">
                      {actionLoading === vm.instance_id + "START"
                        ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    </button>
                    <button onClick={() => handleVMAction(vm.instance_id, "STOP")}
                      disabled={vm.state === "STOPPED" || !!actionLoading}
                      title="Stop"
                      className="p-2 rounded-lg bg-yellow-900/40 hover:bg-yellow-800 text-yellow-400 disabled:opacity-30 transition">
                      {actionLoading === vm.instance_id + "STOP"
                        ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                    </button>
                    <button onClick={() => handleVMAction(vm.instance_id, "RESET")}
                      disabled={vm.state !== "RUNNING" || !!actionLoading}
                      title="Reboot"
                      className="p-2 rounded-lg bg-blue-900/40 hover:bg-blue-800 text-blue-400 disabled:opacity-30 transition">
                      {actionLoading === vm.instance_id + "RESET"
                        ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Destroy workspace ${vm.workspace_id}?\nจะลบ resources ทั้งหมด!`))
                          startDestroy(vm.workspace_id!);
                      }}
                      title="Destroy (Terraform)"
                      className="p-2 rounded-lg bg-red-900/40 hover:bg-red-800 text-red-400 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Workspaces Table */}
        <section>
          <h2 className="text-lg font-semibold mb-4">📁 Terraform Workspaces</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Workspace ID</th>
                  <th className="px-4 py-3 text-left">VMs</th>
                  <th className="px-4 py-3 text-left">Resources</th>
                  <th className="px-4 py-3 text-left">Last Modified</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">ไม่มี workspace</td></tr>
                ) : workspaces.map((ws) => (
                  <tr key={ws.workspace_id} className="border-t border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{ws.workspace_id}</td>
                    <td className="px-4 py-3">
                      {ws.instances.length > 0 ? (
                        <div className="space-y-1">
                          {ws.instances.map((inst, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <StateBadge state={inst.state} />
                              <span className="text-gray-300">{inst.display_name}</span>
                              {inst.public_ip && <span className="text-gray-500 text-xs">{inst.public_ip}</span>}
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{ws.resource_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(ws.modified * 1000).toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (confirm(`Destroy workspace ${ws.workspace_id}?\nจะลบ resources ทั้งหมด!`))
                            startDestroy(ws.workspace_id);
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-red-900/40 hover:bg-red-800 text-red-400 rounded-lg transition text-xs">
                        <Trash2 size={12} /> Destroy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Destroy Modal */}
      {destroyWs && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-red-400">Terraform Destroy — {destroyWs}</h3>
              {destroyDone && (
                <button onClick={() => setDestroyWs(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
              )}
            </div>
            <div className="p-4 h-80 overflow-y-auto font-mono text-xs bg-black/40">
              {destroyLogs.length === 0 && !destroyDone && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> กำลัง destroy...
                </div>
              )}
              {destroyLogs.map((log, i) => (
                <div key={i} className="text-gray-300 leading-5">{log}</div>
              ))}
              {destroyDone && (
                <div className={`mt-3 font-bold text-sm ${destroySuccess ? "text-green-400" : "text-red-400"}`}>
                  {destroySuccess ? "✅ Destroy สำเร็จ!" : "❌ Destroy ล้มเหลว"}
                </div>
              )}
            </div>
            {destroyDone && (
              <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
                <button onClick={() => setDestroyWs(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
                  ปิด
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
