"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle, XCircle, Loader } from "lucide-react";
import { API_URL } from "@/lib/config";

export default function CredentialsPage() {
  const router = useRouter();
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [form, setForm] = useState({
    tenancy_ocid: "",
    user_ocid: "",
    fingerprint: "",
    private_key: "",
    region: "ap-pathumthani-1",
  });

  const regions = [
    "ap-pathumthani-1",
    "ap-bangkok-1",
    "ap-singapore-1",
    "ap-tokyo-1",
    "ap-sydney-1",
    "us-ashburn-1",
    "us-phoenix-1",
    "eu-frankfurt-1",
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleValidate = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch(`${API_URL}/api/credentials/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("ok");
        // เก็บ credentials ใน sessionStorage
        sessionStorage.setItem("oci_credentials", JSON.stringify(form));
        setTimeout(() => { window.location.href = "/vcn"; }, 1000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setLoading(false);
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
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-red-600" : "bg-gray-700"}`}>{i + 1}</div>
              <span className={i === 0 ? "text-white" : "text-gray-500"}>{s}</span>
              {i < 3 && <span className="text-gray-700">→</span>}
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold mb-2">OCI Credentials</h2>
        <p className="text-gray-400 mb-8">ใส่ข้อมูล API key จาก OCI Console เพื่อเชื่อมต่อ</p>

        <div className="space-y-5">
          {/* Tenancy OCID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Tenancy OCID <span className="text-red-500">*</span></label>
            <input
              name="tenancy_ocid"
              value={form.tenancy_ocid}
              onChange={handleChange}
              placeholder="ocid1.tenancy.oc1..aaaaaa..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 placeholder-gray-600"
            />
          </div>

          {/* User OCID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">User OCID <span className="text-red-500">*</span></label>
            <input
              name="user_ocid"
              value={form.user_ocid}
              onChange={handleChange}
              placeholder="ocid1.user.oc1..aaaaaa..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 placeholder-gray-600"
            />
          </div>

          {/* Fingerprint */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Fingerprint <span className="text-red-500">*</span></label>
            <input
              name="fingerprint"
              value={form.fingerprint}
              onChange={handleChange}
              placeholder="xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 placeholder-gray-600 font-mono"
            />
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Region <span className="text-red-500">*</span></label>
            <select
              name="region"
              value={form.region}
              onChange={handleChange}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500"
            >
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Private Key */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Private Key (PEM) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                name="private_key"
                value={form.private_key}
                onChange={handleChange}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                rows={showKey ? 8 : 3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 placeholder-gray-600 font-mono resize-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">⚠️ Key จะไม่ถูกเก็บถาวร ใช้ใน session นี้เท่านั้น</p>
          </div>

          {/* Validate Button */}
          <button
            onClick={handleValidate}
            disabled={loading || !form.tenancy_ocid || !form.user_ocid || !form.fingerprint || !form.private_key}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
          >
            {loading ? (
              <><Loader size={18} className="animate-spin" /> กำลังตรวจสอบ...</>
            ) : status === "ok" ? (
              <><CheckCircle size={18} /> ยืนยันแล้ว! กำลังไปหน้าถัดไป...</>
            ) : status === "error" ? (
              <><XCircle size={18} /> ข้อมูลไม่ถูกต้อง ลองใหม่</>
            ) : (
              "ตรวจสอบและดำเนินการต่อ →"
            )}
          </button>

          {status === "error" && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-sm text-red-300">
              ❌ ไม่สามารถเชื่อมต่อ OCI ได้ กรุณาตรวจสอบ credentials อีกครั้ง
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
