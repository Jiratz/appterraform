"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Server, Network, Database, Shield } from "lucide-react";

const SHAPES = ["VM.Standard.E5.Flex", "VM.Standard.E4.Flex", "VM.Standard3.Flex", "VM.Standard2.1", "VM.Standard2.2"];
const K8S_VERSIONS = ["v1.34.2", "v1.33.0", "v1.32.0"];

export default function ResourcesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({
    vm: false, oke: false, db: false, bastion: false,
  });

  const [vmConfig, setVmConfig] = useState({ name: "my-vm", shape: "VM.Standard.E5.Flex", ocpus: 2, memory: 16, ssh_key: "" });
  const [okeConfig, setOkeConfig] = useState({ name: "my-cluster", k8s_version: "v1.34.2", node_shape: "VM.Standard.E5.Flex", node_count: 2, node_ocpus: 2, node_memory: 16 });
  const [dbConfig, setDbConfig] = useState({ name: "mydb", cpu_count: 2, storage_tb: 1, password: "" });

  const toggle = (key: string) => setSelected((s) => ({ ...s, [key]: !s[key] }));

  const handleNext = () => {
    const config = {
      resources: selected,
      vm: vmConfig,
      oke: okeConfig,
      db: dbConfig,
    };
    sessionStorage.setItem("oci_resources", JSON.stringify(config));
    window.location.href = "/deploy";
  };

  const hasAny = Object.values(selected).some(Boolean);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-4 flex items-center gap-3">
        <a href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">OCI</div>
          <span className="text-xl font-semibold">OCI Terraform Manager</span>
        </a>
      </header>

      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {["Credentials", "VCN", "Resources", "Deploy"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 2 ? "bg-red-600" : i < 2 ? "bg-green-600" : "bg-gray-700"}`}>{i + 1}</div>
              <span className={i <= 2 ? "text-white" : "text-gray-500"}>{s}</span>
              {i < 3 && <span className="text-gray-700">→</span>}
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold mb-2">เลือก Resources</h2>
        <p className="text-gray-400 mb-8">เลือกสิ่งที่ต้องการสร้าง (เลือกได้หลายอย่าง)</p>

        <div className="space-y-4">

          {/* VM Instance */}
          <ResourceCard
            icon={<Server size={20} />}
            title="VM Instance"
            desc="Virtual Machine พร้อม public IP และ SSH access"
            checked={selected.vm}
            onToggle={() => toggle("vm")}
          >
            {selected.vm && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ชื่อ Instance</label>
                  <input value={vmConfig.name} onChange={(e) => setVmConfig({ ...vmConfig, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Shape</label>
                  <select value={vmConfig.shape} onChange={(e) => setVmConfig({ ...vmConfig, shape: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500">
                    {SHAPES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">OCPUs</label>
                  <input type="number" min={1} max={64} value={vmConfig.ocpus} onChange={(e) => setVmConfig({ ...vmConfig, ocpus: +e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Memory (GB)</label>
                  <input type="number" min={1} max={512} value={vmConfig.memory} onChange={(e) => setVmConfig({ ...vmConfig, memory: +e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">SSH Public Key</label>
                  <textarea value={vmConfig.ssh_key} onChange={(e) => setVmConfig({ ...vmConfig, ssh_key: e.target.value })}
                    placeholder="ssh-rsa AAAA..." rows={2}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-500 resize-none" />
                </div>
              </div>
            )}
          </ResourceCard>

          {/* OKE Cluster */}
          <ResourceCard
            icon={<Network size={20} />}
            title="OKE Cluster (Kubernetes)"
            desc="Managed Kubernetes cluster พร้อม node pool"
            checked={selected.oke}
            onToggle={() => toggle("oke")}
          >
            {selected.oke && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ชื่อ Cluster</label>
                  <input value={okeConfig.name} onChange={(e) => setOkeConfig({ ...okeConfig, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Kubernetes Version</label>
                  <select value={okeConfig.k8s_version} onChange={(e) => setOkeConfig({ ...okeConfig, k8s_version: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500">
                    {K8S_VERSIONS.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Node Shape</label>
                  <select value={okeConfig.node_shape} onChange={(e) => setOkeConfig({ ...okeConfig, node_shape: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500">
                    {SHAPES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">จำนวน Nodes</label>
                  <input type="number" min={1} max={20} value={okeConfig.node_count} onChange={(e) => setOkeConfig({ ...okeConfig, node_count: +e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
              </div>
            )}
          </ResourceCard>

          {/* Autonomous DB */}
          <ResourceCard
            icon={<Database size={20} />}
            title="Autonomous Database"
            desc="Oracle Autonomous Database (ATP)"
            checked={selected.db}
            onToggle={() => toggle("db")}
          >
            {selected.db && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ชื่อ Database</label>
                  <input value={dbConfig.name} onChange={(e) => setDbConfig({ ...dbConfig, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">CPU Count</label>
                  <input type="number" min={1} max={128} value={dbConfig.cpu_count} onChange={(e) => setDbConfig({ ...dbConfig, cpu_count: +e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Admin Password</label>
                  <input type="password" value={dbConfig.password} onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                    placeholder="Min 12 chars, uppercase + number + special"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
              </div>
            )}
          </ResourceCard>

          {/* Bastion */}
          <ResourceCard
            icon={<Shield size={20} />}
            title="Bastion Host"
            desc="SSH jump server สำหรับเข้าถึง private instances"
            checked={selected.bastion}
            onToggle={() => toggle("bastion")}
          />

        </div>

        <button
          onClick={handleNext}
          disabled={!hasAny}
          className="w-full mt-8 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
        >
          ดู Terraform Plan →
        </button>
      </div>
    </div>
  );
}

function ResourceCard({ icon, title, desc, checked, onToggle, children }: {
  icon: React.ReactNode; title: string; desc: string;
  checked: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  return (
    <div className={`border rounded-xl p-5 transition ${checked ? "border-red-600 bg-red-600/5" : "border-gray-800 hover:border-gray-600"}`}>
      <div className="flex items-start gap-4 cursor-pointer" onClick={onToggle}>
        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? "border-red-600 bg-red-600" : "border-gray-600"}`}>
          {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-0.5 ${checked ? "text-red-500" : "text-gray-400"}`}>{icon}</div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-gray-400 text-sm">{desc}</div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
