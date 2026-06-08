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
import { translations } from "@/lib/i18n";

interface NavLinksProps {
  t: typeof translations.en;
  onLinkClick: () => void;
}

function NavLinks({ t, onLinkClick }: NavLinksProps) {
  return (
    <>
      <Link href="/dashboard" className="nav-link" onClick={onLinkClick}>
        <LayoutDashboard size={16} />
        {t.upcomingEvents}
      </Link>
      <Link href="/dashboard/history" className="nav-link" onClick={onLinkClick}>
        <History size={16} />
        {t.eventHistory}
      </Link>
      <Link href="/dashboard/houses" className="nav-link" onClick={onLinkClick}>
        <Trophy size={16} />
        {t.leaderboard}
      </Link>
      <Link href="/dashboard/profile" className="nav-link" onClick={onLinkClick}>
        <Settings size={16} />
        {t.editProfile}
      </Link>
    </>
  );
}

export function StudentNav() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const user = session?.user;

  return (
    <nav className="student-nav">
      <div className="nav-content">
        
        {/* Mobile Left: Hamburger and Profile Icon */}
        <div className="mobile-controls">
          <button
            className="mobile-toggle touch-target"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open Menu"
          >
            <Menu size={24} />
          </button>
          
          <div className="mobile-profile-wrapper">
            <button
              className="avatar-btn"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              aria-label="User Menu"
            >
              <div className="avatar">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User Avatar"}
                    className="avatar-img"
                    style={{
                      transform: user.imageTransform ? `scale(${user.imageTransform.scale}) translate(${user.imageTransform.x}%, ${user.imageTransform.y}%)` : 'none'
                    }}
                  />
                ) : (
                  <User size={18} color="var(--text-secondary)" />
                )}
              </div>
            </button>
            
            {/* Mobile Profile Dropdown (GitHub style) */}
            {isProfileDropdownOpen && (
              <>
                <div className="dropdown-backdrop" onClick={() => setIsProfileDropdownOpen(false)} />
                <div className="profile-dropdown mobile-dropdown-pos">
                  <div className="dropdown-header">
                    <p className="dropdown-name">{user?.name}</p>
                    <p className="dropdown-sub">
                      {user?.role === "super_admin" ? t.roleSuperAdmin :
                       user?.role === "admin" ? t.roleAdmin :
                       user?.role === "registration" ? t.roleRegistration :
                       user?.role === "organizer" ? t.roleOrganizer :
                       user?.role === "staff" ? t.roleStaff :
                       (user?.studentId || t.roleStudent)}
                    </p>
                  </div>
                  <div className="dropdown-divider" />
                  <Link href="/dashboard/profile" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
                    <Settings size={14} />
                    {t.editProfile}
                  </Link>
                  {(["super_admin", "admin", "registration", "organizer"].includes(user?.role || "") || user?.email?.toLowerCase() === "smocamt.official@gmail.com") && (
                    <Link href="/admin/dashboard" className="dropdown-item admin-item" onClick={() => setIsProfileDropdownOpen(false)}>
                      <ShieldCheck size={14} />
                      {t.adminPanel}
                    </Link>
                  )}
                  <div className="dropdown-divider" />
                  <button className="dropdown-item text-danger" onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut size={14} />
                    {t.signOut}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Brand/Logo (Desktop Left, Mobile Right) */}
        <div className="nav-left">
          <Link href="/dashboard" className="logo">
            <img src="/smocamt-logo.png" alt="SMOCAMT Logo" className="logo-icon" />
            <div className="logo-text">
              <span className="gradient-text">ActiveCAMT</span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Nav (Hidden on Mobile) */}
        <div className="nav-center desktop-links">
          <NavLinks t={t} onLinkClick={() => {}} />
        </div>

        {/* Right: Desktop Actions & User */}
        <div className="nav-right desktop-links">
          <LanguageSwitcher />

          <div className="user-section">
            <div className="user-info">
              <p className="user-name">{user?.name}</p>
              <p className="user-role">
                {user?.role === "super_admin" ? t.roleSuperAdmin :
                 user?.role === "admin" ? t.roleAdmin :
                 user?.role === "registration" ? t.roleRegistration :
                 user?.role === "organizer" ? t.roleOrganizer :
                 user?.role === "staff" ? t.roleStaff :
                 (user?.studentId || t.roleStudent)}
              </p>
            </div>

            <div className="desktop-profile-wrapper">
              <button
                className="avatar-btn"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                aria-label="User Menu"
              >
                <div className="avatar">
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user.name || "User Avatar"}
                      className="avatar-img"
                      style={{
                        transform: user.imageTransform ? `scale(${user.imageTransform.scale}) translate(${user.imageTransform.x}%, ${user.imageTransform.y}%)` : 'none'
                      }}
                    />
                  ) : (
                    <User size={18} color="var(--text-secondary)" />
                  )}
                </div>
              </button>

              {/* Desktop Profile Dropdown (GitHub style) */}
              {isProfileDropdownOpen && (
                <>
                  <div className="dropdown-backdrop" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div className="profile-dropdown desktop-dropdown-pos">
                    <div className="dropdown-header">
                      <p className="dropdown-name">{user?.name}</p>
                      <p className="dropdown-sub">
                        {user?.role === "super_admin" ? t.roleSuperAdmin :
                         user?.role === "admin" ? t.roleAdmin :
                         user?.role === "registration" ? t.roleRegistration :
                         user?.role === "organizer" ? t.roleOrganizer :
                         user?.role === "staff" ? t.roleStaff :
                         (user?.studentId || t.roleStudent)}
                      </p>
                    </div>
                    <div className="dropdown-divider" />
                    <Link href="/dashboard/profile" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
                      <Settings size={14} />
                      {t.editProfile}
                    </Link>
                    {(["super_admin", "admin", "registration", "organizer"].includes(user?.role || "") || user?.email?.toLowerCase() === "smocamt.official@gmail.com") && (
                      <Link href="/admin/dashboard" className="dropdown-item admin-item" onClick={() => setIsProfileDropdownOpen(false)}>
                        <ShieldCheck size={14} />
                        {t.adminPanel}
                      </Link>
                    )}
                    <div className="dropdown-divider" />
                    <button className="dropdown-item text-danger" onClick={() => signOut({ callbackUrl: "/" })}>
                      <LogOut size={14} />
                      {t.signOut}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar (Drawer sliding from Left) */}
      <div className={`mobile-sidebar-overlay ${isMobileMenuOpen ? "open" : ""}`} onClick={() => setIsMobileMenuOpen(false)} />
      <aside className={`mobile-sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src="/smocamt-logo.png" alt="SMOCAMT Logo" className="logo-icon" />
            <div className="logo-text">
              <span className="gradient-text">ActiveCAMT</span>
            </div>
          </div>
          <button
            className="sidebar-close touch-target"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="sidebar-body">
          <NavLinks t={t} onLinkClick={() => setIsMobileMenuOpen(false)} />
          {(["super_admin", "admin", "registration", "organizer"].includes(user?.role || "") || user?.email?.toLowerCase() === "smocamt.official@gmail.com") && (
            <Link href="/admin/dashboard" className="nav-link admin-link" onClick={() => setIsMobileMenuOpen(false)}>
              <ShieldCheck size={16} /> {t.adminPanel}
            </Link>
          )}
        </div>

        <div className="sidebar-footer">
          <LanguageSwitcher />
          <button className="btn btn-danger btn-sm rounded-full w-full" onClick={() => signOut({ callbackUrl: "/" })} style={{ gap: 8, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={14} /> {t.signOut}
          </button>
        </div>
      </aside>

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
          object-fit: contain;
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
        .avatar-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: block;
        }
        
        /* Dropdown style */
        .dropdown-backdrop {
          position: fixed;
          inset: 0;
          z-index: 998;
          background: transparent;
        }
        .mobile-profile-wrapper,
        .desktop-profile-wrapper {
          position: relative;
        }
        .profile-dropdown {
          position: absolute;
          width: 220px;
          background: white;
          border-radius: 16px;
          border: 1px solid var(--border-subtle);
          box-shadow: 0 10px 40px rgba(0,0,0,0.12);
          z-index: 999;
          padding: 8px 0;
          margin-top: 8px;
          display: flex;
          flex-direction: column;
        }
        .profile-dropdown::before {
          content: '';
          position: absolute;
          top: -6px;
          width: 10px;
          height: 10px;
          background: white;
          border-left: 1px solid var(--border-subtle);
          border-top: 1px solid var(--border-subtle);
          transform: rotate(45deg);
        }
        .desktop-dropdown-pos {
          right: 0;
          top: 100%;
        }
        .desktop-dropdown-pos::before {
          right: 14px;
        }
        .mobile-dropdown-pos {
          left: 0;
          top: 100%;
        }
        .mobile-dropdown-pos::before {
          left: 14px;
        }
        .dropdown-header {
          padding: 12px 16px 10px;
          text-align: left;
        }
        .dropdown-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.2;
        }
        .dropdown-sub {
          font-size: 11px;
          color: var(--text-muted);
          margin: 4px 0 0;
          font-weight: 600;
        }
        .dropdown-divider {
          height: 1px;
          background: var(--border-subtle);
          margin: 6px 0;
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          text-decoration: none;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
        }
        .dropdown-item:hover {
          background: rgba(255, 107, 0, 0.05);
          color: var(--accent-primary);
        }
        .dropdown-item.admin-item {
          color: var(--accent-primary);
        }
        .dropdown-item.text-danger {
          color: #ef4444;
        }
        .dropdown-item.text-danger:hover {
          background: rgba(239, 68, 68, 0.05);
        }

        /* Mobile Controls */
        .mobile-controls {
          display: none;
          align-items: center;
          gap: 12px;
        }
        .mobile-toggle {
          padding: 8px;
          border-radius: 12px;
          background: rgba(0,0,0,0.03);
          border: none;
          cursor: pointer;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Mobile Sidebar Drawer styling */
        .mobile-sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 2000;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        .mobile-sidebar-overlay.open {
          opacity: 1;
          visibility: visible;
        }
        .mobile-sidebar {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          width: 280px;
          background: white;
          box-shadow: 20px 0 40px rgba(0, 0, 0, 0.1);
          z-index: 2001;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        .mobile-sidebar.open {
          transform: translateX(0);
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .sidebar-close {
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-primary);
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sidebar-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          overflow-y: auto;
        }
        .sidebar-footer {
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 16px;
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
          padding: 12px 20px;
          border-radius: 12px;
          min-height: 44px;
        }
        :global(.nav-link:hover) {
          color: var(--accent-primary);
          background: rgba(255,107,0,0.05);
        }

        @media (max-width: 1100px) {
          .desktop-links {
            display: none !important;
          }
          .mobile-controls {
            display: flex;
          }
        }
      `}</style>
    </nav>
  );
}
