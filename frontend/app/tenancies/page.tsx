"use client";
import { useState, useEffect } from "react";
import { useToast } from "../components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "";

interface Tenancy {
  id: string;
  name: string;
  tenancy_ocid: string;
  user_ocid: string;
  fingerprint: string;
  region: string;
  created_at: string;
}

const BLANK = {
  name: "", tenancy_ocid: "", user_ocid: "",
  fingerprint: "", region: "ap-pathumthani-1", private_key: "",
};

export default function TenanciesPage() {
  const { toast } = useToast();
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Tenancy | null>(null);
  const [editForm, setEditForm] = useState({ name: "", region: "", fingerprint: "", private_key: "" });
  const [editSaving, setEditSaving] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/tenancies`);
      const d = await r.json();
      setTenancies(d.tenancies || []);
    } catch { toast("โหลด tenancies ล้มเหลว", "error"); }
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.tenancy_ocid || !form.user_ocid || !form.fingerprint || !form.private_key) {
      toast("กรุณากรอกข้อมูลให้ครบ", "warning"); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/tenancies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Error");
      toast(`เพิ่ม tenancy "${form.name}" สำเร็จ ✅`, "success");
      setShowForm(false);
      setForm(BLANK);
      fetch_();
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Error", "error"); }
    setSaving(false);
  };

  const handleDelete = async (t: Tenancy) => {
    if (!confirm(`ลบ "${t.name}"?`)) return;
    try {
      await fetch(`${API}/api/tenancies/${t.id}`, { method: "DELETE" });
      toast(`ลบ "${t.name}" แล้ว`, "info");
      fetch_();
    } catch { toast("ลบล้มเหลว", "error"); }
  };

  const handleValidate = async (t: Tenancy) => {
    setValidating(t.id);
    try {
      const r = await fetch(`${API}/api/tenancies/${t.id}/validate`, { method: "POST" });
      const d = await r.json();
      toast(d.success ? `✅ "${t.name}" เชื่อมต่อ OCI ได้` : `❌ "${t.name}" เชื่อมต่อไม่ได้`, d.success ? "success" : "error");
    } catch { toast("Validate ล้มเหลว", "error"); }
    setValidating(null);
  };

  const openEdit = (t: Tenancy) => {
    setEditTarget(t);
    setEditForm({ name: t.name, region: t.region, fingerprint: t.fingerprint, private_key: "" });
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    const body: Record<string, string> = {};
    if (editForm.name)        body.name        = editForm.name;
    if (editForm.region)      body.region      = editForm.region;
    if (editForm.fingerprint) body.fingerprint = editForm.fingerprint;
    if (editForm.private_key) body.private_key = editForm.private_key;
    try {
      const r = await fetch(`${API}/api/tenancies/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Error");
      toast(`อัปเดต "${editTarget.name}" สำเร็จ ✅`, "success");
      setEditTarget(null);
      fetch_();
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Error", "error"); }
    setEditSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">🏢 Tenancy Manager</h1>
            <p className="text-gray-400 mt-1">จัดการ OCI Credentials หลาย Tenancy</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition"
          >
            + เพิ่ม Tenancy
          </button>
        </div>

        {/* Add Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-semibold mb-4">➕ เพิ่ม Tenancy</h2>
              <div className="space-y-3">
                {[
                  { key: "name", label: "ชื่อ (เช่น Production, Staging)", type: "text" },
                  { key: "tenancy_ocid", label: "Tenancy OCID", type: "text" },
                  { key: "user_ocid", label: "User OCID", type: "text" },
                  { key: "fingerprint", label: "Fingerprint", type: "text" },
                  { key: "region", label: "Region", type: "text" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="text-sm text-gray-400 mb-1 block">{label}</label>
                    <input
                      title={label} placeholder={label} type={type}
                      value={(form as Record<string, string>)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Private Key (PEM)</label>
                  <textarea rows={5} value={form.private_key}
                    onChange={e => setForm(f => ({ ...f, private_key: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-green-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowForm(false); setForm(BLANK); }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition">
                  ยกเลิก
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2.5 rounded-xl font-medium transition">
                  {saving ? "⏳ กำลัง validate..." : "💾 บันทึก"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-semibold mb-1">✏️ แก้ไข Tenancy</h2>
              <p className="text-gray-400 text-sm mb-4">ID: <span className="font-mono">{editTarget.id}</span></p>
              <div className="space-y-3">
                {[
                  { key: "name",        label: "ชื่อ" },
                  { key: "region",      label: "Region" },
                  { key: "fingerprint", label: "Fingerprint" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm text-gray-400 mb-1 block">{label}</label>
                    <input
                      title={label} placeholder={label} type="text"
                      value={(editForm as Record<string, string>)[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Private Key ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
                  <textarea rows={4} value={editForm.private_key}
                    onChange={e => setEditForm(f => ({ ...f, private_key: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-green-400 font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;(เว้นว่างถ้าไม่ต้องการเปลี่ยน key)&#10;-----END RSA PRIVATE KEY-----"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditTarget(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition">
                  ยกเลิก
                </button>
                <button onClick={handleUpdate} disabled={editSaving}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-2.5 rounded-xl font-medium transition">
                  {editSaving ? "⏳ กำลังบันทึก..." : "💾 อัปเดต"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tenancy List */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">⏳ กำลังโหลด...</div>
        ) : tenancies.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-gray-400">ยังไม่มี Tenancy — กดปุ่ม "เพิ่ม Tenancy" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tenancies.map(t => (
              <div key={t.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-semibold">{t.name}</span>
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-mono">{t.id}</span>
                    </div>
                    <div className="space-y-0.5 text-sm text-gray-400">
                      <div>🌏 Region: <span className="text-gray-300">{t.region}</span></div>
                      <div>🔑 Tenancy: <span className="text-gray-300 font-mono text-xs">{t.tenancy_ocid?.slice(0, 40)}...</span></div>
                      <div>👤 User: <span className="text-gray-300 font-mono text-xs">{t.user_ocid?.slice(0, 40)}...</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button onClick={() => handleValidate(t)} disabled={validating === t.id}
                      className="text-xs bg-green-900/40 hover:bg-green-800 border border-green-700 text-green-300 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                      {validating === t.id ? "⏳..." : "✅ Test"}
                    </button>
                    <button onClick={() => openEdit(t)}
                      className="text-xs bg-yellow-900/40 hover:bg-yellow-800 border border-yellow-700 text-yellow-300 px-3 py-1.5 rounded-lg transition">
                      ✏️ แก้ไข
                    </button>
                    <a href={`/landing-zone?tenancy=${t.id}`}
                      className="text-xs bg-purple-900/40 hover:bg-purple-800 border border-purple-700 text-purple-300 px-3 py-1.5 rounded-lg transition text-center">
                      🏗️ LZ
                    </a>
                    <button onClick={() => handleDelete(t)}
                      className="text-xs bg-red-900/40 hover:bg-red-800 border border-red-700 text-red-300 px-3 py-1.5 rounded-lg transition">
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
