"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Server, Database, Network,
  Building2, Layers, FileText, Activity,
  CheckCircle2, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

interface DashboardData {
  tenancy_count: number;
  files_count: number;
  lz_deployed: number;
  lz_total: number;
  active_jobs: number;
  tenancies: { id: string; name: string; region: string; lz_status: string }[];
}

function LzBadge({ status }: { status: string }) {
  if (status === "deployed")
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={11} /> Deployed
      </span>
    );
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-900 text-blue-400 px-2 py-0.5 rounded-full">
        <Loader2 size={11} className="animate-spin" /> Running
      </span>
    );
  return <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">No LZ</span>;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDash = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/dashboard`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDash();
    const id = setInterval(fetchDash, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">OCI</div>
          <h1 className="text-xl font-semibold">OCI Terraform Manager</h1>
        </div>
        <button
          onClick={fetchDash}
          className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Tenancies",   value: data?.tenancy_count ?? "—", icon: <Building2 size={20} />, color: "text-purple-400", href: "/tenancies" },
            { label: "LZ Deployed", value: data ? `${data.lz_deployed}/${data.lz_total}` : "—", icon: <Layers size={20} />, color: "text-green-400", href: "/landing-zone" },
            { label: "Files",       value: data?.files_count ?? "—", icon: <FileText size={20} />, color: "text-blue-400", href: "/files" },
            { label: "Active Jobs", value: data?.active_jobs ?? "—", icon: <Activity size={20} />, color: data?.active_jobs ? "text-yellow-400" : "text-gray-500", href: "/landing-zone" },
          ].map((s) => (
            <Link key={s.label} href={s.href}>
              <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition cursor-pointer">
                <div className={`${s.color} mb-3`}>{s.icon}</div>
                <div className="text-2xl font-bold mb-1">
                  {loading ? <Loader2 size={20} className="animate-spin text-gray-600" /> : s.value}
                </div>
                <div className="text-gray-400 text-sm">{s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Tenancy Table ── */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Tenancies</h2>
            <Link href="/tenancies" className="text-sm text-purple-400 hover:text-purple-300 transition">จัดการ →</Link>
          </div>

          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : !data || data.tenancies.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
              ยังไม่มี Tenancy —{" "}
              <Link href="/tenancies" className="text-purple-400 hover:underline">เพิ่มเลย</Link>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Region</th>
                    <th className="text-left px-4 py-3">Landing Zone</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.tenancies.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3 font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-gray-400">{t.region}</td>
                      <td className="px-4 py-3"><LzBadge status={t.lz_status} /></td>
                      <td className="px-4 py-3 flex gap-2">
                        <Link href={`/landing-zone?tenancy=${t.id}`} className="text-xs bg-green-900/50 hover:bg-green-800 text-green-400 px-2 py-1 rounded transition">🏗️ LZ</Link>
                        <Link href={`/vms?tenancy=${t.id}`} className="text-xs bg-blue-900/50 hover:bg-blue-800 text-blue-400 px-2 py-1 rounded transition">🖥️ VMs</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Quick Actions ── */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: "Tenancy Manager", desc: "เพิ่ม/ลบ OCI Tenancy",            icon: "🏢", href: "/tenancies",    border: "hover:border-purple-600" },
              { title: "Landing Zone",    desc: "Deploy infrastructure wizard",     icon: "🏗️", href: "/landing-zone", border: "hover:border-green-600"  },
              { title: "VM Instances",    desc: "จัดการ VMs ใน OCI",              icon: "🖥️", href: "/vms",          border: "hover:border-blue-600"   },
              { title: "File Manager",    desc: "Object Storage files",            icon: "📁", href: "/files",        border: "hover:border-orange-600" },
            ].map((item) => (
              <Link key={item.title} href={item.href}>
                <div className={`bg-gray-900 border border-gray-800 ${item.border} rounded-xl p-6 text-center transition cursor-pointer`}>
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <div className="font-semibold mb-1">{item.title}</div>
                  <div className="text-gray-400 text-sm">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Supported Resources ── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">สร้างได้อะไรบ้าง</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <Server size={24} />,   title: "VM Instance",    desc: "E5.Flex, E4.Flex หรือ Standard shapes พร้อม SSH key" },
              { icon: <Network size={24} />,  title: "OKE Cluster",    desc: "Kubernetes cluster พร้อม node pool" },
              { icon: <Database size={24} />, title: "Autonomous DB",  desc: "Oracle Autonomous Database ATP/ADW" },
            ].map((f) => (
              <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="text-red-500 mb-3">{f.icon}</div>
                <div className="font-semibold mb-2">{f.title}</div>
                <div className="text-gray-400 text-sm">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
