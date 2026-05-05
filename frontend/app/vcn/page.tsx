"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Network, Plus, RefreshCw, Loader } from "lucide-react";
import { API_URL } from "@/lib/config";

interface VCN {
  id: string;
  display_name: string;
  cidr_block: string;
  lifecycle_state: string;
}

interface Compartment {
  id: string;
  name: string;
}

export default function VCNPage() {
  const router = useRouter();
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [vcns, setVcns] = useState<VCN[]>([]);
  const [selectedCompartment, setSelectedCompartment] = useState("");
  const [selectedVCN, setSelectedVCN] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [newVCNName, setNewVCNName] = useState("");
  const [newVCNCidr, setNewVCNCidr] = useState("10.0.0.0/16");
  const [loading, setLoading] = useState(false);
  const [loadingVCN, setLoadingVCN] = useState(false);

  const getHeaders = () => {
    const creds = localStorage.getItem("oci_credentials");
    return {
      "Content-Type": "application/json",
      "X-Credentials": creds || "",
    };
  };

  useEffect(() => {
    // ดึง compartments
    setLoading(true);
    fetch(`${API_URL}/api/compartments`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => setCompartments(Array.isArray(data) ? data : (data.compartments || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCompartment) return;
    setLoadingVCN(true);
    setVcns([]);
    fetch(`${API_URL}/api/vcns?compartment_id=${selectedCompartment}`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => setVcns(Array.isArray(data) ? data : (data.vcns || [])))
      .catch(() => {})
      .finally(() => setLoadingVCN(false));
  }, [selectedCompartment]);

  const handleNext = () => {
    const vcnData = createNew
      ? { type: "new", name: newVCNName, cidr: newVCNCidr, compartment_id: selectedCompartment }
      : { type: "existing", vcn_id: selectedVCN, compartment_id: selectedCompartment };
    localStorage.setItem("oci_vcn", JSON.stringify(vcnData));
    window.location.href = "/resources";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-4 flex items-center gap-3">
        <a href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">OCI</div>
          <span className="text-xl font-semibold">OCI Terraform Manager</span>
        </a>
      </header>

      <div className="max-w-2xl mx-auto px-8 py-12">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {["Credentials", "VCN", "Resources", "Deploy"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 1 ? "bg-red-600" : i < 1 ? "bg-green-600" : "bg-gray-700"}`}>{i + 1}</div>
              <span className={i <= 1 ? "text-white" : "text-gray-500"}>{s}</span>
              {i < 3 && <span className="text-gray-700">→</span>}
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold mb-2">เลือก VCN</h2>
        <p className="text-gray-400 mb-8">เลือก VCN ที่มีอยู่ หรือสร้างใหม่</p>

        {/* Compartment */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-300">Compartment</label>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader size={16} className="animate-spin" /> กำลังดึงข้อมูล...
            </div>
          ) : (
            <select
              value={selectedCompartment}
              onChange={(e) => setSelectedCompartment(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500"
            >
              <option value="">-- เลือก Compartment --</option>
              {compartments.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Toggle: ใช้ existing หรือสร้างใหม่ */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setCreateNew(false)}
            className={`flex-1 py-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition ${!createNew ? "border-red-600 bg-red-600/10 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}
          >
            <Network size={16} /> ใช้ VCN ที่มีอยู่
          </button>
          <button
            onClick={() => setCreateNew(true)}
            className={`flex-1 py-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition ${createNew ? "border-red-600 bg-red-600/10 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}
          >
            <Plus size={16} /> สร้าง VCN ใหม่
          </button>
        </div>

        {/* Existing VCN list */}
        {!createNew && (
          <div>
            {loadingVCN ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Loader size={16} className="animate-spin" /> กำลังดึง VCN...
              </div>
            ) : vcns.length > 0 ? (
              <div className="space-y-3">
                {vcns.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVCN(v.id)}
                    className={`border rounded-xl p-4 cursor-pointer transition ${selectedVCN === v.id ? "border-red-600 bg-red-600/10" : "border-gray-800 hover:border-gray-600"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{v.display_name}</div>
                        <div className="text-gray-400 text-sm">{v.cidr_block}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${v.lifecycle_state === "AVAILABLE" ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`}>
                        {v.lifecycle_state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedCompartment ? (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-xl">
                <Network size={32} className="mx-auto mb-2 opacity-50" />
                <p>ไม่พบ VCN ใน Compartment นี้</p>
                <button onClick={() => setCreateNew(true)} className="text-red-500 text-sm mt-2 hover:underline">สร้าง VCN ใหม่</button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 border border-dashed border-gray-800 rounded-xl">
                <RefreshCw size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">เลือก Compartment ก่อน</p>
              </div>
            )}
          </div>
        )}

        {/* Create new VCN */}
        {createNew && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">ชื่อ VCN</label>
              <input
                value={newVCNName}
                onChange={(e) => setNewVCNName(e.target.value)}
                placeholder="my-vcn"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">CIDR Block</label>
              <input
                value={newVCNCidr}
                onChange={(e) => setNewVCNCidr(e.target.value)}
                placeholder="10.0.0.0/16"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 font-mono"
              />
            </div>
          </div>
        )}

        {/* Next */}
        <button
          onClick={handleNext}
          disabled={!selectedCompartment || (!createNew && !selectedVCN) || (createNew && !newVCNName)}
          className="w-full mt-8 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition"
        >
          ไปขั้นตอนถัดไป: เลือก Resources →
        </button>
      </div>
    </div>
  );
}
