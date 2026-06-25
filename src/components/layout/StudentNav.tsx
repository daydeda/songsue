"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
LogOut,
User,
ShieldCheck,
History,
Trophy,
Menu,
X,
Settings,
LayoutDashboard,
QrCode,
ShoppingBag,
Users,
CalendarDays,
Gamepad2
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { houseSlug } from "@/lib/houses";
import { canEnterAdmin } from "@/lib/admin-access";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useState, useRef, useEffect } from "react";

export function StudentNav() {
const { data: session } = useSession();
const { t, lang } = useLanguage();
const pathname = usePathname();
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

const mobileProfileRef = useRef<HTMLDivElement>(null);
const desktopProfileRef = useRef<HTMLDivElement>(null);

useEffect(() => {
function handleClickOutside(event: MouseEvent) {
const target = event.target as Node;
const clickedOutsideMobile = !mobileProfileRef.current || !mobileProfileRef.current.contains(target);
const clickedOutsideDesktop = !desktopProfileRef.current || !desktopProfileRef.current.contains(target);
if (clickedOutsideMobile && clickedOutsideDesktop) {
setIsProfileDropdownOpen(false);
}
}
document.addEventListener("mousedown", handleClickOutside);
return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);

const user = session?.user;

// Top-bar tabs — only the core destinations, kept lean.
const primaryLinks = user ? [
  { href: "/dashboard", label: t.upcomingEvents, icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: t.calendar || "Calendar", icon: CalendarDays },
  { href: "/dashboard/houses", label: t.leaderboard, icon: Trophy },
  { href: "/dashboard/history", label: t.eventHistory, icon: History },
  { href: "/dashboard/shop", label: t.shop || "Shop", icon: ShoppingBag },
  { href: "/battle", label: lang === "th" ? "เกม P2P" : "P2P Battle", icon: Gamepad2 },
] : [
  { href: "/dashboard", label: t.upcomingEvents, icon: LayoutDashboard },
  { href: "/dashboard/houses", label: t.leaderboard, icon: Trophy },
];

// Secondary destinations — live in the avatar ▾ account menu (and the mobile drawer).
const secondaryLinks = user ? [
{ href: "/dashboard/id", label: t.digitalId || "Digital ID", icon: QrCode },
// Members roster for the student's own house — only when they belong to one.
...(user.houseId ? [{ href: `/dashboard/houses/${houseSlug(user.houseId)}`, label: t.myHouse, icon: Users }] : []),
{ href: "/dashboard/profile", label: t.editProfile, icon: Settings },
] : [];

return (
<>
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

<div className="mobile-profile-wrapper" ref={mobileProfileRef}>
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
<div className="profile-dropdown mobile-dropdown-pos">
<div className="dropdown-header">
<p className="dropdown-name">{user ? user.name : (lang === "th" ? "ผู้เยี่ยมชม" : "Guest")}</p>
<p className="dropdown-sub">
{user ? (
  user.role === "super_admin" ? t.roleSuperAdmin :
  user.role === "admin" ? t.roleAdmin :
  user.role === "registration" ? t.roleRegistration :
  user.role === "organizer" ? t.roleOrganizer :
  user.role === "staff" ? t.roleStaff :
  (user.studentId || t.roleStudent)
) : (
  lang === "th" ? "ไม่ได้เข้าสู่ระบบ" : "Not logged in"
)}
</p>
</div>
<div className="dropdown-divider" />
{user ? (
  <>
    {secondaryLinks.map((link) => {
      const Icon = link.icon;
      return (
        <Link key={link.href} href={link.href} className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
          <Icon size={16} />
          {link.label}
        </Link>
      );
    })}
    <div className="dropdown-divider" />
    <button className="dropdown-item text-danger" onClick={() => signOut({ callbackUrl: "/" })}>
      <LogOut size={16} />
      {t.signOut}
    </button>
  </>
) : (
  <>
    <Link href="/dashboard/id" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
      <QrCode size={16} />
      {t.digitalId || "Digital ID"}
    </Link>
    <Link href="/login" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
      <User size={16} />
      {lang === "th" ? "ลงทะเบียนบัญชี" : "Register Account"}
    </Link>
  </>
)}
</div>
)}
</div>
</div>

{/* Brand/Logo (Desktop Left, Mobile Right) */}
<div className="nav-left">
<Link href="/dashboard" className="logo">
<img src="/smocamt-logo-icon.png" alt="SMOCAMT Logo" className="logo-icon" width={32} height={32} style={{ width: 32, height: 32 }} />
<div className="logo-text">
<span className="gradient-text">ActiveCAMT</span>
</div>
</Link>
</div>

{/* Center: Desktop Nav (Hidden on Mobile) */}
<div className="nav-center desktop-links">
{primaryLinks.map((link) => {
const Icon = link.icon;
const isActive = pathname === link.href;
return (
<Link
key={link.href}
href={link.href}
className={`nav-link ${isActive ? "active" : ""}`}
>
<Icon size={16} />
{link.label}
</Link>
);
})}
</div>

{/* Right: Desktop Actions & User */}
<div className="nav-right desktop-links">
<LanguageSwitcher />

<div className="user-section">
<div className="user-info">
<p className="user-name">{user ? user.name : (lang === "th" ? "ผู้เยี่ยมชม" : "Guest")}</p>
<p className="user-role">
{user ? (
  user.role === "super_admin" ? t.roleSuperAdmin :
  user.role === "admin" ? t.roleAdmin :
  user.role === "registration" ? t.roleRegistration :
  user.role === "organizer" ? t.roleOrganizer :
  user.role === "staff" ? t.roleStaff :
  (user.studentId || t.roleStudent)
) : (
  lang === "th" ? "ไม่ได้เข้าสู่ระบบ" : "Not logged in"
)}
</p>
</div>

<div className="desktop-profile-wrapper" ref={desktopProfileRef}>
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
<div className="profile-dropdown desktop-dropdown-pos">
<div className="dropdown-header">
<p className="dropdown-name">{user ? user.name : (lang === "th" ? "ผู้เยี่ยมชม" : "Guest")}</p>
<p className="dropdown-sub">
{user ? (
  user.role === "super_admin" ? t.roleSuperAdmin :
  user.role === "admin" ? t.roleAdmin :
  user.role === "registration" ? t.roleRegistration :
  user.role === "organizer" ? t.roleOrganizer :
  user.role === "staff" ? t.roleStaff :
  (user.studentId || t.roleStudent)
) : (
  lang === "th" ? "ไม่ได้เข้าสู่ระบบ" : "Not logged in"
)}
</p>
</div>
<div className="dropdown-divider" />
{user ? (
  <>
    {secondaryLinks.map((link) => {
      const Icon = link.icon;
      return (
        <Link key={link.href} href={link.href} className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
          <Icon size={16} />
          {link.label}
        </Link>
      );
    })}
    {(canEnterAdmin(user?.role)) && (
      <Link href="/admin" className="dropdown-item admin-item" onClick={() => setIsProfileDropdownOpen(false)}>
        <ShieldCheck size={16} />
        {t.adminPanel}
      </Link>
    )}
    <div className="dropdown-divider" />
    <button className="dropdown-item text-danger" onClick={() => signOut({ callbackUrl: "/" })}>
      <LogOut size={16} />
      {t.signOut}
    </button>
  </>
) : (
  <>
    <Link href="/dashboard/id" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
      <QrCode size={16} />
      {t.digitalId || "Digital ID"}
    </Link>
    <Link href="/login" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
      <User size={16} />
      {lang === "th" ? "ลงทะเบียนบัญชี" : "Register Account"}
    </Link>
  </>
)}
</div>
)}
</div>
</div>
</div>
</div>
</nav>

{/* Mobile Sidebar (Drawer sliding from Left) */}
<div 
  className={`mobile-sidebar-overlay ${isMobileMenuOpen ? "open" : ""}`} 
  onClick={() => setIsMobileMenuOpen(false)} 
  style={{
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    opacity: isMobileMenuOpen ? 1 : 0,
    visibility: isMobileMenuOpen ? "visible" : "hidden"
  }}
/>
<aside 
  className={`mobile-sidebar ${isMobileMenuOpen ? "open" : ""}`}
  style={{
    position: "fixed",
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    zIndex: 2001,
    transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
    visibility: isMobileMenuOpen ? "visible" : "hidden",
    display: "flex",
    flexDirection: "column"
  }}
>
<div className="sidebar-header">
<div className="logo">
<img src="/smocamt-logo-icon.png" alt="SMOCAMT Logo" className="logo-icon" width={32} height={32} style={{ width: 32, height: 32 }} />
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
{primaryLinks.map((link) => {
const Icon = link.icon;
const isActive = pathname === link.href;
return (
<Link 
key={link.href} 
href={link.href} 
className={`nav-link ${isActive ? "active" : ""}`}
onClick={() => setIsMobileMenuOpen(false)}
style={{
display: "flex",
alignItems: "center",
gap: "12px",
padding: "14px 20px",
color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
fontWeight: 600,
fontSize: "15px",
borderRadius: "12px",
textDecoration: "none",
marginBottom: "4px",
background: isActive ? "var(--accent-glow)" : "transparent",
border: isActive ? "1px solid rgba(255, 107, 0, 0.15)" : "1px solid transparent",
}}
>
<Icon size={16} style={{ flexShrink: 0 }} />
{link.label}
</Link>
);
})}
{(canEnterAdmin(user?.role)) && (
<Link 
href="/admin"
className={`nav-link admin-link ${pathname.startsWith("/admin") ? "active" : ""}`}
onClick={() => setIsMobileMenuOpen(false)}
style={{
display: "flex",
alignItems: "center",
gap: "12px",
padding: "14px 20px",
color: "var(--accent-primary)",
fontWeight: 600,
fontSize: "15px",
borderRadius: "12px",
textDecoration: "none",
marginBottom: "4px",
background: pathname.startsWith("/admin") ? "var(--accent-glow)" : "rgba(255,107,0,0.05)",
border: pathname.startsWith("/admin") ? "1px solid rgba(255, 107, 0, 0.15)" : "1px solid transparent",
}}
>
<ShieldCheck size={16} style={{ flexShrink: 0 }} /> {t.adminPanel}
</Link>
)}
</div>

<div className="sidebar-footer">
<LanguageSwitcher position="top" align="left" />
{user ? (
  <button className="btn btn-danger btn-sm rounded-full w-full" onClick={() => signOut({ callbackUrl: "/" })} style={{ gap: 8, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <LogOut size={14} /> {t.signOut}
  </button>
) : (
  <Link href="/login" className="btn btn-primary btn-sm rounded-full w-full" style={{ gap: 8, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
    <User size={14} /> {lang === "th" ? "ลงทะเบียนบัญชี" : "Register Account"}
  </Link>
)}
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
flex-shrink: 0;
}
.user-name {
font-size: 13px;
font-weight: 700;
color: var(--text-primary);
line-height: 1.4;
margin: 0;
white-space: nowrap;
}
.user-role {
font-size: 11px;
color: var(--text-muted);
margin-top: 3px;
text-transform: capitalize;
white-space: nowrap;
}
.desktop-links {
display: flex;
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
.mobile-profile-wrapper,
.desktop-profile-wrapper {
position: relative;
}
.profile-dropdown {
position: absolute;
min-width: 220px;
width: max-content;
background: rgba(255, 255, 255, 0.96);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-radius: 16px;
border: 1px solid var(--border-subtle);
box-shadow: 0 10px 40px rgba(0,0,0,0.08);
z-index: 999;
padding: 8px 0;
margin-top: 8px;
display: flex;
flex-direction: column;
animation: fade-in-up 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.profile-dropdown::before {
content: '';
position: absolute;
top: -6px;
width: 10px;
height: 10px;
background: rgba(255, 255, 255, 0.96);
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
padding: 12px 16px;
text-align: left;
display: flex;
flex-direction: column;
gap: 2px;
}
.dropdown-name {
font-size: 14px;
font-weight: 800;
color: var(--text-primary);
margin: 0;
line-height: 1.4;
}
.dropdown-sub {
font-size: 11px;
color: var(--text-muted);
margin: 0;
font-weight: 600;
letter-spacing: 0.02em;
}
.dropdown-divider {
height: 1px;
background: var(--border-subtle);
margin: 6px 0;
}
:global(.dropdown-item) {
display: flex;
align-items: center;
gap: 12px;
padding: 10px 16px;
font-size: 14px;
font-weight: 600;
color: var(--text-secondary);
text-decoration: none;
border: none;
background: none;
width: 100%;
white-space: nowrap;
text-align: left;
cursor: pointer;
transition: background 0.2s ease, color 0.2s ease;
}
:global(.dropdown-item:hover) {
background: var(--accent-glow);
color: var(--accent-primary);
}
/* Icon nudges on hover — uniform motion that works for every label length,
   since the icon always has the 12px gap to slide into (long labels never clip). */
:global(.dropdown-item svg) {
transition: transform 0.2s ease;
}
:global(.dropdown-item:hover svg) {
transform: translateX(3px);
}
:global(.dropdown-item.admin-item) {
color: var(--accent-primary);
background: rgba(255, 107, 0, 0.03);
}
:global(.dropdown-item.admin-item:hover) {
background: var(--accent-glow);
}
:global(.dropdown-item.text-danger) {
color: #ef4444;
}
:global(.dropdown-item.text-danger:hover) {
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
  width: 300px;
  background: white;
  box-shadow: 20px 0 40px rgba(0, 0, 0, 0.1);
  z-index: 2001;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  padding: 24px;
  visibility: hidden;
}
.mobile-sidebar.open {
  transform: translateX(0);
  visibility: visible;
}
@media (min-width: 1024px) {
  .mobile-sidebar,
  .mobile-sidebar-overlay {
    display: none !important;
  }
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
.desktop-links :global(.nav-link) {
white-space: nowrap;
}
:global(.nav-link:hover) {
color: var(--accent-primary);
background: rgba(255,107,0,0.05);
}
:global(.nav-link.active) {
background: var(--accent-glow) !important;
color: var(--accent-primary) !important;
border: 1px solid rgba(255, 107, 0, 0.15) !important;
}

@media (max-width: 1400px) {
.nav-right {
gap: 12px;
}
.user-section {
gap: 8px;
}
.nav-center {
gap: 4px;
}
:global(.nav-link) {
padding: 6px 12px !important;
min-height: 36px !important;
}
}

/* Tablet band (e.g. iPad landscape): tabs stay visible but the textual
   user name/role is dropped to leave room for the 4 tabs — avatar remains. */
@media (max-width: 1280px) and (min-width: 1024px) {
.user-info {
display: none;
}
.nav-right {
gap: 10px;
}
}
@media (max-width: 1023px) {
.desktop-links {
display: none !important;
}
.mobile-controls {
display: flex;
}
}
@keyframes fade-in-up {
from { opacity: 0; transform: translateY(10px); }
to { opacity: 1; transform: translateY(0); }
}
`}</style>
</>
);
}
