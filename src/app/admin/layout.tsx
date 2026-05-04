import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { LanguageProvider } from "@/lib/LanguageContext";

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
      <aside className="sidebar" style={{ boxShadow: "10px 0 30px rgba(0,0,0,0.02)" }}>
        <div className="sidebar-logo" style={{ border: "none", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "var(--accent-primary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>A</div>
            <span className="gradient-text" style={{ fontSize: 22, fontWeight: 900 }}>ActiveCAMT</span>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginTop: 6,
              paddingLeft: 42
            }}
          >
            Admin Panel
          </div>
        </div>

        <LanguageProvider>
          <AdminNav />
        </LanguageProvider>

        <div className="divider" style={{ opacity: 0.5 }} />
        
        <div style={{ 
          background: "var(--bg-elevated)", 
          padding: "16px", 
          borderRadius: "var(--radius-lg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: "1px solid var(--border-subtle)"
        }}>
          {session.user.image ? (
            <img src={session.user.image} style={{ width: 36, height: 36, borderRadius: "50%" }} alt="" />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-glass)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={18} color="var(--text-secondary)" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.user.name}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Administrator</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "40px 48px",
          background: "var(--bg-base)",
        }}
      >
        {children}
      </main>
    </div>
  );
}