"use client";
import { useEffect, useState, useRef } from "react";
import { useToast } from "../components/Toast";

const API = "http://134.185.162.105:8000";
const UPLOAD_PASSWORD = "ociupload2026";

interface FileItem {
  name: string;
  size: number;
  time_created?: string;
}

type SortKey = "name" | "size" | "date";
type SortDir = "asc" | "desc";

function fmtSize(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}

function getExt(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    pdf: "📄", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️",
    zip: "🗜️", tar: "🗜️", gz: "🗜️",
    py: "🐍", js: "📜", ts: "📜", json: "📋", csv: "📊", xlsx: "📊",
    txt: "📝", md: "📝", sh: "⚙️", html: "🌐",
  };
  return icons[ext] || "📁";
}

export default function FilesPage() {
  const { toast } = useToast();
  const [authed, setAuthed] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ok = sessionStorage.getItem("files_auth");
    if (ok === "1") setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) fetchFiles();
  }, [authed]);

  async function fetchFiles() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/upload/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    }
    setLoading(false);
  }

  function handleLogin() {
    if (passInput === UPLOAD_PASSWORD) {
      sessionStorage.setItem("files_auth", "1");
      setAuthed(true);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const f of selectedFiles) {
      const form = new FormData();
      form.append("file", f);
      try {
        const res = await fetch(`${API}/api/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (data.success) ok++;
        else fail++;
      } catch { fail++; }
    }
    setUploading(false);
    if (fail === 0) toast(`✓ อัปโหลดสำเร็จ ${ok} ไฟล์`, "success");
    else toast(`สำเร็จ ${ok} ไฟล์, ล้มเหลว ${fail} ไฟล์`, "error");
    fetchFiles();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(name: string) {
    if (!confirm(`ลบไฟล์ "${name}" ?`)) return;
    setDeletingFile(name);
    try {
      await fetch(`${API}/api/upload/files/${encodeURIComponent(name)}`, { method: "DELETE" });
      setFiles(f => f.filter(x => x.name !== name));
      toast(`ลบ "${name}" แล้ว`, "success");
    } catch { toast("ลบไม่ได้ กรุณาลองใหม่", "error"); }
    setDeletingFile(null);
  }

  async function handleDownload(name: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/api/upload/files/${encodeURIComponent(name)}/url`);
      const data = await res.json();
      if (data.url) { window.open(data.url, "_blank"); return data.url; }
      else { toast("ไม่สามารถสร้าง download link ได้", "error"); return null; }
    } catch { toast("เกิดข้อผิดพลาด", "error"); return null; }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const isImage = (name: string) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name);

  const filtered = files
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "size") cmp = (a.size || 0) - (b.size || 0);
      else cmp = (a.time_created || "").localeCompare(b.time_created || "");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span>{sortDir === "asc" ? " ↑" : " ↓"}</span> : <span className="opacity-30"> ↕</span>;

  // ─── Login Screen ───
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔒</div>
            <h1 className="text-white text-xl font-semibold">File Manager</h1>
            <p className="text-gray-400 text-sm mt-1">ต้องใส่รหัสผ่านเพื่อเข้าถึง</p>
          </div>
          <input
            type="password"
            placeholder="Password"
            value={passInput}
            onChange={e => setPassInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 mb-3 ${
              passError ? "border-red-500 focus:ring-red-500" : "border-gray-600 focus:ring-blue-500"
            }`}
          />
          {passError && <p className="text-red-400 text-sm mb-3 text-center">❌ รหัสผ่านไม่ถูกต้อง</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  // ─── File Manager ───
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-3xl w-full">
            <img src={preview} alt="preview" className="rounded-xl max-h-[80vh] mx-auto object-contain" />
            <p className="text-center text-gray-400 text-sm mt-3">คลิกที่ใดก็ได้เพื่อปิด</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">📁 File Manager</h1>
            <p className="text-gray-400 text-sm mt-1">OCI Object Storage — upload-bucket</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchFiles} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">
              🔄 Refresh
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              {uploading ? "⏳ กำลังอัปโหลด..." : "⬆️ Upload"}
            </button>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleUpload} />
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 ค้นหาไฟล์..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-4 text-sm text-gray-400">
          <span>{filtered.length} ไฟล์</span>
          <span>รวม {fmtSize(filtered.reduce((a, f) => a + (f.size || 0), 0))}</span>
        </div>

        {/* File list */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-500">⏳ กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              {search ? "ไม่พบไฟล์ที่ค้นหา" : "ยังไม่มีไฟล์ในระบบ"}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-sm">
                  <th className="text-left px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("name")}>
                    ชื่อไฟล์<SortIcon k="name" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("size")}>
                    ขนาด<SortIcon k="size" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort("date")}>
                    วันที่<SortIcon k="date" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.name} className={`border-b border-gray-800 hover:bg-gray-800/50 transition ${i === filtered.length - 1 ? "border-b-0" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getExt(f.name)}</span>
                        <span className="text-sm text-white truncate max-w-xs">{f.name}</span>
                        {isImage(f.name) && (
                          <button onClick={async () => { const url = await handleDownload(f.name); if (url) setPreview(url); }}
                            className="text-xs text-blue-400 hover:text-blue-300">🔍</button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400">{fmtSize(f.size || 0)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {f.time_created ? new Date(f.time_created).toLocaleDateString("th-TH") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleDownload(f.name)}
                          className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-lg transition">
                          ⬇️ Download
                        </button>
                        <button onClick={() => handleDelete(f.name)} disabled={deletingFile === f.name}
                          className="text-xs bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-300 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                          {deletingFile === f.name ? "..." : "🗑️ ลบ"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-6">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition">← กลับหน้าหลัก</a>
        </div>
      </div>
    </div>
  );
}

