"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeProvider";
import { LayoutDashboard, Building2, Layers, Server, FolderOpen } from "lucide-react";

const NAV = [
  { href: "/",             label: "Dashboard",    icon: <LayoutDashboard size={15} /> },
  { href: "/tenancies",    label: "Tenancies",    icon: <Building2 size={15} /> },
  { href: "/landing-zone", label: "Landing Zone", icon: <Layers size={15} /> },
  { href: "/vms",          label: "VMs",          icon: <Server size={15} /> },
  { href: "/files",        label: "Files",        icon: <FolderOpen size={15} /> },
];

export default function Navbar() {
  const path = usePathname();

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-6 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center font-bold text-xs text-white">
            OCI
          </div>
          <span className="font-semibold text-sm hidden sm:block">Terraform Manager</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 no-scrollbar">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive(n.href)
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-900"
              }`}
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
