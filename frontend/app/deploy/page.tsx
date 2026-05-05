"use client";
import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Loader, Terminal, Play } from "lucide-react";
import { API_URL, WS_URL } from "@/lib/config";

type Phase = "plan" | "applying" | "done" | "error";

export default function DeployPage() {
  const [phase, setPhase] = useState<Phase>("plan");
  const [planOutput, setPlanOutput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const logsEndRef = useRef<HTMLDivElement>(null);

  const getPayload = () => ({
    credentials: JSON.parse(localStorage.getItem("oci_credentials") || "{}"),
    vcn: JSON.parse(localStorage.getItem("oci_vcn") || "{}"),
    resources: JSON.parse(localStorage.getItem("oci_resources") || "{}"),
  });

  // ดึง terraform plan
  useEffect(() => {
    setLoadingPlan(true);
    fetch(`${API_URL}/api/terraform/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getPayload()),
    })
      .then((r) => r.json())
      .then((d) => setPlanOutput(d.plan_output || d.output || "No output"))
      .catch(() => setPlanOutput("Error generating plan"))
      .finally(() => setLoadingPlan(false));
  }, []);

  // scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleApply = async () => {
    setPhase("applying");
    setLogs([]);

    // WebSocket สำหรับ realtime logs
    const ws = new WebSocket(`${WS_URL}/ws/terraform/logs`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "log") {
        setLogs((prev) => [...prev, msg.message || msg.data]);
      } else if (msg.type === "done") {
        if (!msg.success) {
          setLogs((prev) => [...prev, "Apply failed"]);
          setPhase("error");
          ws.close();
          return;
        }
        setOutputs(msg.outputs || {});
        setPhase("done");
        ws.close();
      } else if (msg.type === "error") {
        setLogs((prev) => [...prev, `❌ ERROR: ${msg.data}`]);
        setPhase("error");
        ws.close();
      }
    };
    ws.onerror = () => {
      setLogs((prev) => [...prev, "❌ WebSocket connection failed"]);
      setPhase("error");
    };

    // ส่ง payload ไป apply
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "apply", payload: getPayload() }));
    };
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-4 flex items-center gap-3">
        <a href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">OCI</div>
          <span className="text-xl font-semibold">OCI Terraform Manager</span>
        </a>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {["Credentials", "VCN", "Resources", "Deploy"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 3 ? "bg-red-600" : "bg-green-600"}`}>{i + 1}</div>
              <span className="text-white">{s}</span>
              {i < 3 && <span className="text-gray-700">→</span>}
            </div>
          ))}
        </div>

        <h2 className="text-3xl font-bold mb-2">Deploy Infrastructure</h2>
        <p className="text-gray-400 mb-8">ตรวจสอบ Terraform Plan แล้วกด Apply</p>

        {/* Plan output */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={16} className="text-gray-400" />
            <span className="font-semibold">Terraform Plan</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-xs text-gray-300 max-h-72 overflow-y-auto">
            {loadingPlan ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader size={14} className="animate-spin" /> กำลังสร้าง plan...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap">{planOutput}</pre>
            )}
          </div>
        </div>

        {/* Apply button */}
        {phase === "plan" && !loadingPlan && (
          <button
            onClick={handleApply}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 text-lg transition mb-6"
          >
            <Play size={20} /> Apply — สร้าง Infrastructure เลย!
          </button>
        )}

        {/* Logs */}
        {(phase === "applying" || phase === "done" || phase === "error") && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              {phase === "applying" && <Loader size={16} className="animate-spin text-yellow-400" />}
              {phase === "done" && <CheckCircle size={16} className="text-green-400" />}
              {phase === "error" && <XCircle size={16} className="text-red-400" />}
              <span className="font-semibold">
                {phase === "applying" ? "กำลัง Apply..." : phase === "done" ? "เสร็จแล้ว! ✅" : "เกิดข้อผิดพลาด ❌"}
              </span>
            </div>
            <div className="bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs max-h-96 overflow-y-auto">
              {logs.map((line, i) => (
                <div key={i} className={`py-0.5 ${line.includes("Error") || line.includes("error") ? "text-red-400" : line.includes("complete") || line.includes("Created") ? "text-green-400" : "text-gray-300"}`}>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Outputs */}
        {phase === "done" && (
          <div className="bg-gray-900 border border-green-800 rounded-xl p-6">
            <h3 className="font-semibold text-green-400 mb-4">🎉 Infrastructure พร้อมแล้ว!</h3>
            <div className="space-y-3">
              {Object.entries(outputs).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <span className="text-gray-400 text-sm">{key}</span>
                  <span className="font-mono text-sm text-white break-all">{value}</span>
                </div>
              ))}
            </div>
            {outputs.vm_public_ip && (
              <div className="mt-5 bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-2">�� SSH Command</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm text-green-300 break-all">
                    ssh opc@{outputs.vm_public_ip}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText("ssh opc@" + outputs.vm_public_ip)}
                    className="flex-shrink-0 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded-lg transition"
                  >
                    Copy
                  </button>
                </div>
                <div className="text-xs text-yellow-500 mt-2">
                  ⚠️ ต้องมี SSH Private Key ของ public key ที่ใส่ไว้ตอน deploy
                </div>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <a href="/vms" className="flex-1 text-center py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition">
                📋 ไปหน้า VM Manager
              </a>
              <a href="/" className="flex-1 text-center py-2 text-red-500 hover:underline text-sm flex items-center justify-center">
                กลับหน้าหลัก
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
