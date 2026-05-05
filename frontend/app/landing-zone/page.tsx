"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "../components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tenancy { id: string; name: string; region: string; tenancy_ocid: string; }

interface LZConfig {
  tenancy_id: string;
  parent_compartment_ocid: string;
  compartments: { compartments: { name: string; description: string }[] };
  iam: { groups: { name: string; description: string }[]; policies: { name: string; statements: string[]; description: string }[] };
  network: { vcns: { name: string; cidr: string; subnets: { name: string; cidr: string; public: boolean }[] }[] };
  security: { cloud_guard: boolean; audit_log: boolean };
  bastion: { enabled: boolean; allowed_cidrs: string[] };
  storage: { buckets: { name: string; versioning: string }[] };
  vault: { enabled: boolean };
}

const STEPS = ["🏢 Tenancy", "📦 Compartments", "👤 IAM", "🌐 Network", "🔒 Security", "🖥️ Bastion", "💾 Storage", "🔑 Vault", "🚀 Deploy"];

// ─── Default LZ Config (Best Practice) ───────────────────────────────────────
function defaultConfig(tenancy_id: string): LZConfig {
  return {
    tenancy_id,
    parent_compartment_ocid: "",
    compartments: {
      compartments: [
        { name: "lz-network", description: "Network resources" },
        { name: "lz-security", description: "Security resources" },
        { name: "lz-workload", description: "Workload / Application resources" },
        { name: "lz-logging", description: "Logging and audit" },
      ],
    },
    iam: {
      groups: [
        { name: "lz-admins", description: "Landing Zone Administrators" },
        { name: "lz-developers", description: "Developers with limited access" },
        { name: "lz-auditors", description: "Read-only audit access" },
      ],
      policies: [
        {
          name: "lz-admin-policy",
          description: "Admin policy for LZ",
          statements: [
            "Allow group lz-admins to manage all-resources in tenancy",
          ],
        },
        {
          name: "lz-developer-policy",
          description: "Developer policy",
          statements: [
            "Allow group lz-developers to manage instances in compartment lz-workload",
            "Allow group lz-developers to manage object-family in compartment lz-workload",
          ],
        },
        {
          name: "lz-auditor-policy",
          description: "Auditor read-only policy",
          statements: [
            "Allow group lz-auditors to read all-resources in tenancy",
          ],
        },
      ],
    },
    network: {
      vcns: [
        {
          name: "lz-hub-vcn",
          cidr: "10.0.0.0/16",
          subnets: [
            { name: "public-subnet", cidr: "10.0.1.0/24", public: true },
            { name: "private-subnet", cidr: "10.0.2.0/24", public: false },
            { name: "db-subnet", cidr: "10.0.3.0/24", public: false },
          ],
        },
      ],
    },
    security: { cloud_guard: true, audit_log: true },
    bastion: { enabled: true, allowed_cidrs: ["0.0.0.0/0"] },
    storage: {
      buckets: [
        { name: "lz-logs-bucket", versioning: "Enabled" },
        { name: "lz-backup-bucket", versioning: "Disabled" },
      ],
    },
    vault: { enabled: true },
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
function LandingZoneInner() {
  const params = useSearchParams();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [config, setConfig] = useState<LZConfig>(defaultConfig(params.get("tenancy") || ""));
  const [planOutput, setPlanOutput] = useState("");
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [jobId, setJobId] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState("");
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/tenancies`).then(r => r.json()).then(d => setTenancies(d.tenancies || []));
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  // ── Plan ──────────────────────────────────────────────────────────────────
  const handlePlan = async () => {
    if (!config.tenancy_id) { toast("กรุณาเลือก Tenancy", "warning"); return; }
    setPlanning(true);
    setPlanOutput("");
    try {
      const r = await fetch(`${API}/api/landing-zone/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Plan failed");
      setPlanOutput(d.plan_output);
      toast("Plan สำเร็จ ✅", "success");
    } catch (e: any) { toast(e.message, "error"); }
    setPlanning(false);
  };

  // ── Apply (WebSocket streaming) ───────────────────────────────────────────
  const handleApply = async () => {
    if (!config.tenancy_id) { toast("กรุณาเลือก Tenancy", "warning"); return; }
    setApplying(true);
    setLogs([]);
    setJobStatus("starting");
    try {
      const r = await fetch(`${API}/api/landing-zone/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Apply failed");
      const jid = d.job_id;
      setJobId(jid);
      toast(`Apply เริ่มแล้ว — Job: ${jid}`, "info");

      const wsUrl = `${API.replace("http", "ws")}/ws/landing-zone/logs/${jid}`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "log") setLogs(l => [...l, msg.message]);
        if (msg.type === "done") {
          setJobStatus(msg.status);
          setApplying(false);
          toast(msg.status === "success" ? "🎉 Landing Zone deploy สำเร็จ!" : "❌ Apply ล้มเหลว", msg.status === "success" ? "success" : "error");
          ws.close();
        }
      };
      ws.onerror = () => { toast("WebSocket error", "error"); setApplying(false); };
    } catch (e: any) { toast(e.message, "error"); setApplying(false); }
  };

  // ── Step helpers ─────────────────────────────────────────────────────────
  const setC = (patch: Partial<LZConfig>) => setConfig(c => ({ ...c, ...patch }));

  // ── Render Steps ──────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // Step 0: Tenancy selection
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-gray-400">เลือก Tenancy ที่ต้องการ deploy Landing Zone</p>
            {tenancies.length === 0 ? (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 text-yellow-300">
                ⚠️ ยังไม่มี Tenancy — <a href="/tenancies" className="underline">เพิ่ม Tenancy ก่อน</a>
              </div>
            ) : (
              <div className="grid gap-3">
                {tenancies.map(t => (
                  <button key={t.id}
                    onClick={() => { setC({ tenancy_id: t.id }); setConfig(c => ({ ...defaultConfig(t.id), tenancy_id: t.id })); }}
                    className={`text-left p-4 rounded-xl border transition ${config.tenancy_id === t.id ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-900 hover:border-gray-500"}`}>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-sm text-gray-400">{t.region} · {t.id}</div>
                  </button>
                ))}
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Parent Compartment OCID (เว้นว่าง = root tenancy)</label>
              <input value={config.parent_compartment_ocid}
                onChange={e => setC({ parent_compartment_ocid: e.target.value })}
                placeholder="ocid1.compartment.oc1...(เว้นว่างได้)"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        );

      // Step 1: Compartments
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">กำหนด Compartment structure สำหรับ Landing Zone</p>
            {config.compartments.compartments.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={c.name}
                  onChange={e => {
                    const arr = [...config.compartments.compartments];
                    arr[i] = { ...arr[i], name: e.target.value };
                    setC({ compartments: { compartments: arr } });
                  }}
                  placeholder="ชื่อ compartment"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={c.description}
                  onChange={e => {
                    const arr = [...config.compartments.compartments];
                    arr[i] = { ...arr[i], description: e.target.value };
                    setC({ compartments: { compartments: arr } });
                  }}
                  placeholder="description"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => {
                  const arr = config.compartments.compartments.filter((_, j) => j !== i);
                  setC({ compartments: { compartments: arr } });
                }} className="text-red-400 hover:text-red-300 px-2">✕</button>
              </div>
            ))}
            <button onClick={() => setC({ compartments: { compartments: [...config.compartments.compartments, { name: "", description: "" }] } })}
              className="text-sm text-blue-400 hover:text-blue-300">+ เพิ่ม Compartment</button>
          </div>
        );

      // Step 2: IAM
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Groups</h3>
              {config.iam.groups.map((g, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={g.name}
                    onChange={e => { const a = [...config.iam.groups]; a[i] = { ...a[i], name: e.target.value }; setC({ iam: { ...config.iam, groups: a } }); }}
                    placeholder="group name"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={() => setC({ iam: { ...config.iam, groups: config.iam.groups.filter((_, j) => j !== i) } })}
                    className="text-red-400 px-2">✕</button>
                </div>
              ))}
              <button onClick={() => setC({ iam: { ...config.iam, groups: [...config.iam.groups, { name: "", description: "" }] } })}
                className="text-sm text-blue-400 hover:text-blue-300">+ เพิ่ม Group</button>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Policies</h3>
              {config.iam.policies.map((p, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-3">
                  <input value={p.name}
                    onChange={e => { const a = [...config.iam.policies]; a[i] = { ...a[i], name: e.target.value }; setC({ iam: { ...config.iam, policies: a } }); }}
                    placeholder="policy name"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white mb-2 focus:outline-none" />
                  <textarea rows={3} value={p.statements.join("\n")}
                    onChange={e => { const a = [...config.iam.policies]; a[i] = { ...a[i], statements: e.target.value.split("\n") }; setC({ iam: { ...config.iam, policies: a } }); }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-green-300 font-mono focus:outline-none"
                    placeholder="Allow group ... to manage ... in ..." />
                </div>
              ))}
            </div>
          </div>
        );

      // Step 3: Network
      case 3:
        return (
          <div className="space-y-4">
            {config.network.vcns.map((vcn, vi) => (
              <div key={vi} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex gap-2 mb-3">
                  <input value={vcn.name}
                    onChange={e => { const v = [...config.network.vcns]; v[vi] = { ...v[vi], name: e.target.value }; setC({ network: { vcns: v } }); }}
                    placeholder="VCN name"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                  <input value={vcn.cidr}
                    onChange={e => { const v = [...config.network.vcns]; v[vi] = { ...v[vi], cidr: e.target.value }; setC({ network: { vcns: v } }); }}
                    placeholder="CIDR"
                    className="w-36 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
                </div>
                <div className="pl-2 border-l-2 border-gray-600 space-y-2">
                  {vcn.subnets.map((sn, si) => (
                    <div key={si} className="flex gap-2 items-center">
                      <input value={sn.name}
                        onChange={e => { const v = [...config.network.vcns]; v[vi].subnets[si] = { ...sn, name: e.target.value }; setC({ network: { vcns: v } }); }}
                        placeholder="subnet name"
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" />
                      <input value={sn.cidr}
                        title="CIDR"
                        placeholder="CIDR"
                        onChange={e => { const v = [...config.network.vcns]; v[vi].subnets[si] = { ...sn, cidr: e.target.value }; setC({ network: { vcns: v } }); }}
                        className="w-32 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" />
                      <label className="text-xs text-gray-400 flex items-center gap-1">
                        <input type="checkbox" checked={sn.public}
                          onChange={e => { const v = [...config.network.vcns]; v[vi].subnets[si] = { ...sn, public: e.target.checked }; setC({ network: { vcns: v } }); }} />
                        Public
                      </label>
                    </div>
                  ))}
                  <button onClick={() => { const v = [...config.network.vcns]; v[vi].subnets.push({ name: "", cidr: "", public: false }); setC({ network: { vcns: v } }); }}
                    className="text-xs text-blue-400">+ subnet</button>
                </div>
              </div>
            ))}
          </div>
        );

      // Step 4: Security
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">เปิด/ปิด security features</p>
            {[
              { key: "cloud_guard", label: "☁️ Cloud Guard", desc: "ตรวจจับ threats อัตโนมัติ" },
              { key: "audit_log", label: "📋 Audit Log Notification", desc: "ส่ง notification เมื่อมี audit events" },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-700 rounded-xl cursor-pointer hover:border-gray-500">
                <input type="checkbox" checked={(config.security as any)[key]}
                  onChange={e => setC({ security: { ...config.security, [key]: e.target.checked } })}
                  className="w-4 h-4 accent-blue-500" />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-sm text-gray-400">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        );

      // Step 5: Bastion
      case 5:
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-700 rounded-xl cursor-pointer">
              <input type="checkbox" checked={config.bastion.enabled}
                onChange={e => setC({ bastion: { ...config.bastion, enabled: e.target.checked } })}
                className="w-4 h-4 accent-blue-500" />
              <div>
                <div className="font-medium">🖥️ OCI Bastion Service</div>
                <div className="text-sm text-gray-400">Secure SSH access โดยไม่ต้องมี Jump host</div>
              </div>
            </label>
            {config.bastion.enabled && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Allowed CIDRs (1 บรรทัดต่อ 1 CIDR)</label>
                <textarea rows={3} value={config.bastion.allowed_cidrs.join("\n")}
                  onChange={e => setC({ bastion: { ...config.bastion, allowed_cidrs: e.target.value.split("\n").filter(Boolean) } })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.0.0.0/0" />
              </div>
            )}
          </div>
        );

      // Step 6: Storage
      case 6:
        return (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">Object Storage buckets สำหรับ Landing Zone</p>
            {config.storage.buckets.map((b, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={b.name}
                  onChange={e => { const a = [...config.storage.buckets]; a[i] = { ...a[i], name: e.target.value }; setC({ storage: { buckets: a } }); }}
                  placeholder="bucket name"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select title="Versioning" value={b.versioning}
                  onChange={e => { const a = [...config.storage.buckets]; a[i] = { ...a[i], versioning: e.target.value }; setC({ storage: { buckets: a } }); }}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  <option value="Disabled">Versioning Off</option>
                  <option value="Enabled">Versioning On</option>
                </select>
                <button onClick={() => setC({ storage: { buckets: config.storage.buckets.filter((_, j) => j !== i) } })}
                  className="text-red-400 px-2">✕</button>
              </div>
            ))}
            <button onClick={() => setC({ storage: { buckets: [...config.storage.buckets, { name: "", versioning: "Disabled" }] } })}
              className="text-sm text-blue-400 hover:text-blue-300">+ เพิ่ม Bucket</button>
          </div>
        );

      // Step 7: Vault
      case 7:
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-gray-900 border border-gray-700 rounded-xl cursor-pointer">
              <input type="checkbox" checked={config.vault.enabled}
                onChange={e => setC({ vault: { enabled: e.target.checked } })}
                className="w-4 h-4 accent-blue-500" />
              <div>
                <div className="font-medium">🔑 OCI Vault + Master Key</div>
                <div className="text-sm text-gray-400">Hardware-based key management (AES-256)</div>
              </div>
            </label>
          </div>
        );

      // Step 8: Deploy
      case 8:
        return (
          <div className="space-y-5">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <h3 className="font-semibold mb-3">📋 Summary</h3>
              <div className="space-y-1 text-sm text-gray-300">
                <div>🏢 Tenancy: <strong>{tenancies.find(t => t.id === config.tenancy_id)?.name || config.tenancy_id}</strong></div>
                <div>📦 Compartments: <strong>{config.compartments.compartments.length}</strong></div>
                <div>👤 Groups: <strong>{config.iam.groups.length}</strong> | Policies: <strong>{config.iam.policies.length}</strong></div>
                <div>🌐 VCNs: <strong>{config.network.vcns.length}</strong> | Subnets: <strong>{config.network.vcns.reduce((a, v) => a + v.subnets.length, 0)}</strong></div>
                <div>☁️ Cloud Guard: <strong>{config.security.cloud_guard ? "✅" : "❌"}</strong> | Audit: <strong>{config.security.audit_log ? "✅" : "❌"}</strong></div>
                <div>🖥️ Bastion: <strong>{config.bastion.enabled ? "✅" : "❌"}</strong></div>
                <div>💾 Buckets: <strong>{config.storage.buckets.length}</strong></div>
                <div>🔑 Vault: <strong>{config.vault.enabled ? "✅" : "❌"}</strong></div>
              </div>
            </div>

            {/* Plan */}
            <div className="flex gap-3">
              <button onClick={handlePlan} disabled={planning || applying}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-white py-3 rounded-xl font-medium transition">
                {planning ? "⏳ Planning..." : "📋 Terraform Plan"}
              </button>
              <button onClick={handleApply} disabled={applying || planning}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white py-3 rounded-xl font-medium transition">
                {applying ? "⚙️ Applying..." : "🚀 Apply Landing Zone"}
              </button>
            </div>

            {/* Plan Output */}
            {planOutput && (
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2 font-semibold">TERRAFORM PLAN OUTPUT</div>
                <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">{planOutput}</pre>
              </div>
            )}

            {/* Apply Logs */}
            {(logs.length > 0 || applying) && (
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-semibold">APPLY LOGS {jobId && `— Job: ${jobId}`}</span>
                  {jobStatus && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${jobStatus === "success" ? "bg-green-900 text-green-300" : jobStatus === "failed" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}`}>
                      {jobStatus}
                    </span>
                  )}
                </div>
                <div ref={logsRef} className="text-xs text-green-300 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {logs.map((l, i) => <div key={i}>{l}</div>)}
                  {applying && <div className="animate-pulse text-gray-500">█</div>}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">🏗️ Landing Zone Wizard</h1>
          <p className="text-gray-400 mt-1">Deploy OCI Landing Zone แบบ Best Practice</p>
        </div>

        {/* Step Progress */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${i === step ? "bg-blue-600 text-white" : i < step ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-500 hover:bg-gray-700"}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 min-h-64">
          <h2 className="text-lg font-semibold mb-4">{STEPS[step]}</h2>
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-5">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition">
              ← ย้อนกลับ
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button onClick={() => setStep(s => s + 1)}
              className="ml-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition">
              ถัดไป →
            </button>
          )}
        </div>

        <div className="mt-6">
          <a href="/tenancies" className="text-gray-500 hover:text-gray-300 text-sm transition">← Tenancy Manager</a>
        </div>
      </div>
    </div>
  );
}

export default function LandingZonePage() {
  return <Suspense><LandingZoneInner /></Suspense>;
}
