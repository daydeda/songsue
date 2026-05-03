import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const NAV = [
  { href: "/admin/dashboard", label: "Overview",         icon: "◉" },
  { href: "/admin/events",    label: "Manage Events",    icon: "📅" },
  { href: "/admin/scanner",   label: "QR Scanner",       icon: "📷" },
  { href: "/admin/students",  label: "Student Directory", icon: "👥" },
  { href: "/admin/audit-logs",label: "Audit Trails",     icon: "🔒" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="gradient-text">ActiveCAMT</span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            Admin Panel
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <p className="section-title" style={{ paddingLeft: 12 }}>Navigation</p>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="divider" />
        <div style={{ padding: "0 12px" }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Logged in as{" "}
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
              {session.user.name}
            </span>
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px",
          background: "var(--bg-base)",
        }}
      >
        {children}
      </main>
    </div>
  );
}