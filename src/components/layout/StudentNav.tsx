"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { 
  LogOut, 
  User, 
  ShieldCheck,
  History,
  Trophy,
  Menu,
  X,
  Settings,
  LayoutDashboard
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useState } from "react";

export function StudentNav() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const user = session?.user as any;

  const NavLinks = () => (
    <>
      <Link href="/dashboard" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
        <LayoutDashboard size={16} />
        {t.upcomingEvents}
      </Link>
      <Link href="/dashboard/history" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
        <History size={16} />
        {t.eventHistory}
      </Link>
      <Link href="/dashboard/houses" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
        <Trophy size={16} />
        {t.leaderboard}
      </Link>
      <Link href="/dashboard/profile" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
        <Settings size={16} />
        {t.editProfile}
      </Link>
    </>
  );

  return (
    <nav className="student-nav">
      <div className="nav-content">
        {/* Left: Brand */}
        <div className="nav-left">
          <Link href="/dashboard" className="logo">
            <div className="logo-icon">A</div>
            <div className="logo-text">
              <span className="gradient-text">ActiveCAMT</span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Nav (Hidden on Mobile) */}
        <div className="nav-center desktop-links">
          <NavLinks />
        </div>

        {/* Right: Actions & User (Responsive) */}
        <div className="nav-right">
          <div className="desktop-links">
            <LanguageSwitcher />
          </div>

          <div className="user-section">
            <div className="user-info desktop-links">
              <p className="user-name">{user?.name}</p>
              <p className="user-role">{user?.role === "admin" ? "Admin" : (user?.studentId || "Student")}</p>
            </div>
            
            <div className="avatar">
               {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="avatar-img"
                    style={{ 
                      transform: user.imageTransform ? `scale(${user.imageTransform.scale}) translate(${user.imageTransform.x}%, ${user.imageTransform.y}%)` : 'none'
                    }}
                  />
                ) : (
                  <User size={18} color="var(--text-secondary)" />
                )}
            </div>
          </div>

          {/* Desktop Only Actions */}
          <div className="desktop-links actions">
            {((user as any)?.role === "admin" || (user as any)?.email?.toLowerCase() === "smocamt.official@gmail.com") && (
              <Link href="/admin/dashboard" className="btn btn-primary btn-sm rounded-full">
                <ShieldCheck size={14} />
              </Link>
            )}
            <button className="btn btn-ghost btn-sm rounded-full" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut size={16} />
            </button>
          </div>

          {/* Mobile Toggle (Hidden on Desktop) */}
          <button 
            className="mobile-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            <div className="mobile-links">
              <NavLinks />
              {((user as any)?.role === "admin" || (user as any)?.email?.toLowerCase() === "smocamt.official@gmail.com") && (
                <Link href="/admin/dashboard" className="nav-link admin-link" onClick={() => setIsMobileMenuOpen(false)}>
                  <ShieldCheck size={16} /> {t.adminPanel}
                </Link>
              )}
            </div>
            <div className="mobile-divider" />
            <div className="mobile-footer">
              <LanguageSwitcher />
              <button className="btn btn-danger btn-sm rounded-full" onClick={() => signOut({ callbackUrl: "/" })} style={{ gap: 8 }}>
                <LogOut size={14} /> {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .student-nav {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-subtle);
          position: sticky;
          top: 0;
          z-index: 1000;
          padding: 0 24px;
        }
        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          height: 72px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .nav-left {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .nav-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .nav-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }
        .logo-icon {
          width: 32px;
          height: 32px;
          background: var(--accent-primary);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 18;
          color: #fff;
        }
        .logo-text {
          font-weight: 800;
          font-size: 20px;
          letter-spacing: -0.03em;
        }
        .user-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-info {
          text-align: right;
        }
        .user-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
          margin: 0;
        }
        .user-role {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 3px;
          text-transform: capitalize;
        }
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid var(--accent-primary);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .actions {
          gap: 8px;
        }
        .mobile-toggle {
          display: none;
          padding: 8px;
          border-radius: 12px;
          background: rgba(0,0,0,0.03);
          border: none;
          cursor: pointer;
          color: var(--text-primary);
        }
        .mobile-menu-overlay {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-subtle);
          padding: 24px;
          z-index: 999;
          box-shadow: 0 20px 40px rgba(0,0,0,0.05);
        }
        .mobile-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mobile-divider {
          height: 1px;
          background: var(--border-subtle);
          margin: 16px 0;
        }
        .mobile-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .admin-link {
          color: var(--accent-primary) !important;
          background: rgba(255,107,0,0.05);
        }
        .rounded-full {
          border-radius: 99px !important;
        }

        :global(.nav-link) {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          padding: 8px 16px;
          border-radius: 12px;
        }
        :global(.nav-link:hover) {
          color: var(--accent-primary);
          background: rgba(255,107,0,0.05);
        }

        @media (max-width: 1100px) {
          .desktop-links {
            display: none !important;
          }
          .mobile-toggle {
            display: flex;
          }
        }
      `}</style>
    </nav>
  );
}
