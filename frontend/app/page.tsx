import Link from "next/link";
import { Server, Database, Network, Rocket } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">OCI</div>
        <h1 className="text-xl font-semibold">OCI Terraform Manager</h1>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-8 py-20 text-center">
        <h2 className="text-5xl font-bold mb-4">
          สร้าง <span className="text-red-500">OCI Infrastructure</span>
          <br />ง่ายๆ ไม่ต้องเขียน Terraform
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          ใส่ Credentials → เลือก Resources → Deploy ได้เลย
        </p>
        <Link
          href="/credentials"
          className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold inline-flex items-center gap-2 transition"
        >
          <Rocket size={20} />
          เริ่มต้นใช้งาน
        </Link>
      </div>

      {/* Steps */}
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "1", title: "ใส่ Credentials", desc: "Tenancy, User, API Key", icon: "🔑", href: "/credentials" },
            { step: "2", title: "เลือก VCN", desc: "ดึง VCN จาก OCI", icon: "🌐", href: "/vcn" },
            { step: "3", title: "เลือก Resources", desc: "VM, OKE, DB, LB", icon: "⚙️", href: "/resources" },
            { step: "4", title: "Deploy!", desc: "Apply Terraform", icon: "🚀", href: "/deploy" },
          ].map((item) => (
            <Link key={item.step} href={item.href}>
              <div className="bg-gray-900 border border-gray-800 hover:border-red-600 rounded-xl p-6 text-center transition cursor-pointer">
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="text-xs text-red-500 font-semibold mb-1">Step {item.step}</div>
                <div className="font-semibold mb-1">{item.title}</div>
                <div className="text-gray-400 text-sm">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Multi-Tenancy & Landing Zone */}
      <div className="max-w-4xl mx-auto px-8 pb-16">
        <h3 className="text-2xl font-bold text-center mb-8">🏗️ Multi-Tenancy Landing Zone</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/tenancies">
            <div className="bg-gray-900 border border-gray-800 hover:border-purple-600 rounded-xl p-6 transition cursor-pointer">
              <div className="text-3xl mb-3">🏢</div>
              <div className="font-semibold mb-1">Tenancy Manager</div>
              <div className="text-gray-400 text-sm">จัดการ OCI credentials หลาย tenancy — Production, Staging, Dev</div>
            </div>
          </Link>
          <Link href="/landing-zone">
            <div className="bg-gray-900 border border-gray-800 hover:border-green-600 rounded-xl p-6 transition cursor-pointer">
              <div className="text-3xl mb-3">🏗️</div>
              <div className="font-semibold mb-1">Landing Zone Wizard</div>
              <div className="text-gray-400 text-sm">Deploy Compartments, IAM, Network, Security, Bastion, Vault ด้วย Wizard</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-8 pb-20">
        <h3 className="text-2xl font-bold text-center mb-8">สร้างได้อะไรบ้าง</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <Server size={24} />, title: "VM Instance", desc: "E5.Flex, E4.Flex หรือ Standard shapes พร้อม SSH key" },
            { icon: <Network size={24} />, title: "OKE Cluster", desc: "Kubernetes cluster พร้อม node pool" },
            { icon: <Database size={24} />, title: "Autonomous DB", desc: "Oracle Autonomous Database ATP/ADW" },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="text-red-500 mb-3">{f.icon}</div>
              <div className="font-semibold mb-2">{f.title}</div>
              <div className="text-gray-400 text-sm">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
