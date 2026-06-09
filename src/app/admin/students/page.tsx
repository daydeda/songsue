"use client";

import { useEffect, useState, useRef } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useSession } from "next-auth/react";
import {
  Search, Users, ShieldAlert, Heart, Phone,
  X, ShieldCheck, User as UserIcon,
  Activity, GraduationCap, ChevronDown,
  Edit2, Trash2, Check, Home, Shield,
  BookOpen, Briefcase, Award
} from "lucide-react";

type Student = {
  id: string;
  studentId?: string;
  prefix?: string;
  name: string;
  nickname?: string;
  major?: string;
  phone?: string;
  houseId?: string;
  house?: { id: string; name: string; color?: string } | null;
  profileCompleted?: boolean;
  role?: string;
  chronicDiseases?: string | null;
  medicalHistory?: string | null;
  drugAllergies?: string | null;
  foodAllergies?: string | null;
  dietaryRestrictions?: string | null;
  faintingHistory?: boolean | null;
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }> | null;
};

type DropdownOption = {
  value: string;
  label: string;
  color?: string;
  icon?: React.ReactNode;
};

interface CustomDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

function CustomDropdown({ value, options, onChange, icon, placeholder = "Select...", className = "" }: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const currentOption = options.find(o => o.value === value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Check if a specific filter (not "all" or empty) is selected
  const hasActiveFilter = value !== "all" && value !== "";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full h-14 bg-[var(--bg-elevated)] border rounded-2xl px-4 text-base font-bold text-[var(--text-primary)] shadow-sm transition-all duration-300 cursor-pointer ${
          open
            ? "border-[var(--accent-primary)] shadow-[0_0_0_3px_var(--accent-glow)] bg-[var(--bg-surface)]"
            : "border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-surface)] hover:shadow-md"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Left badge for category icon */}
          {icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ml-2 mr-0.5 ${
              hasActiveFilter
                ? "bg-[var(--accent-glow)] text-[var(--accent-primary)] shadow-[0_0_10px_rgba(255,107,0,0.15)]"
                : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
            }`}>
              {currentOption?.icon ? currentOption.icon : icon}
            </div>
          )}

          {/* Option details block */}
          <div className="flex items-center gap-2">
            {currentOption?.color && (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: currentOption.color,
                boxShadow: `0 0 8px ${currentOption.color}88`,
                flexShrink: 0
              }} />
            )}
            {currentOption?.icon && !icon && (
              <span className="flex-shrink-0 text-[var(--accent-primary)]">
                {currentOption.icon}
              </span>
            )}
            <span className="text-sm font-extrabold text-[var(--text-primary)] leading-normal truncate max-w-[140px]">
              {currentOption ? currentOption.label : placeholder}
            </span>
          </div>
        </div>

        <ChevronDown
          size={16}
          className={`text-muted transition-transform duration-300 ${open ? "text-[var(--accent-primary)]" : ""}`}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-2 bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-medium)] rounded-none animate-fade-in-up overflow-hidden"
          style={{
            zIndex: 9999,
            boxShadow: "0 16px 48px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex flex-col gap-0 max-h-[280px] overflow-y-auto custom-scrollbar">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              
              // Dynamic text color for selected state
              const dynamicText = opt.color
                ? opt.color
                : "var(--accent-primary)";

              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`group flex items-center justify-between w-full px-5 py-3.5 text-left text-sm font-semibold transition-all duration-200 cursor-pointer rounded-none hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]`}
                  style={{
                    color: isSelected ? dynamicText : "var(--text-secondary)",
                  }}
                >
                  <div className="flex items-center gap-3 transition-transform duration-300">
                    {/* Explicit 20px spacer to ensure absolute vertical alignment */}
                    <div style={{ width: '20px', height: '20px' }} className="flex items-center justify-center flex-shrink-0">
                      {opt.color ? (
                        <div
                          className="transition-all duration-300 group-hover:scale-125"
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: opt.color,
                            boxShadow: `0 0 8px ${opt.color}66`,
                          }}
                        />
                      ) : opt.icon ? (
                        <span className={`flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                          isSelected ? "" : "text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]"
                        }`}>
                          {opt.icon}
                        </span>
                      ) : null}
                    </div>
                    <span className={`truncate transition-colors duration-200 ${
                      isSelected ? "font-bold text-[var(--text-primary)]" : "group-hover:text-[var(--text-primary)]"
                    }`}
                      style={{
                        color: isSelected ? dynamicText : undefined
                      }}
                    >
                      {opt.label}
                    </span>
                  </div>
                  {isSelected && <Check size={16} className="flex-shrink-0 ml-2 animate-fade-in" style={{ color: dynamicText }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminStudentsDirectory() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "student";

  const canViewMedicalLog = userRole === "super_admin";
  const canEditOrDelete = userRole === "super_admin" || userRole === "admin";

  const { t } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [sensitiveData, setSensitiveData] = useState<Student | null>(null);
  const [loadingSensitive, setLoadingSensitive] = useState(false);

  const [houses, setHouses] = useState<{ id: string; name: string }[]>([]);
  const [houseFilter, setHouseFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [updating, setUpdating] = useState(false);

  const refreshData = () => {
    setLoading(true);
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setStudents(d); })
      .finally(() => setLoading(false));

    fetch("/api/admin/houses")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHouses(d); });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const hasActualMedicalInfo = (user: Student) => {
    if (!user) return false;
    const fields = [
      user.chronicDiseases,
      user.medicalHistory,
      user.drugAllergies,
      user.foodAllergies,
      user.dietaryRestrictions
    ];
    const isMeaningful = (val: string | null | undefined) => {
      if (typeof val !== 'string') return !!val;
      const t = val.trim();
      return t !== "" && t !== "-";
    };
    return fields.some(isMeaningful) || user.faintingHistory === true;
  };

  const getHouseName = (id: string, defaultName: string) => {
    if (id === "red") return t.houseMom || "Mom";
    if (id === "green") return t.houseTo || "To";
    if (id === "yellow") return t.houseLuang || "Luang";
    if (id === "blue") return t.houseMakara || "Makara";
    return defaultName;
  };

  const houseOptions = [
    { value: "all", label: t.allHouses },
    ...houses.map(h => ({
      value: h.id,
      label: getHouseName(h.id, h.name),
      color: h.id === "red" ? "#ef4444" : h.id === "blue" ? "#3b82f6" : h.id === "green" ? "#10b981" : h.id === "yellow" ? "#f59e0b" : "var(--accent-primary)"
    }))
  ];

  const roleOptions = [
    { value: "all", label: t.allRoles },
    { value: "student", label: t.roleStudentPlural, icon: <GraduationCap size={16} className="text-muted" /> },
    { value: "staff", label: t.roleStaffPlural, icon: <Briefcase size={16} className="text-[#14b8a6]" /> },
    { value: "admin", label: t.roleAdminPlural, icon: <ShieldCheck size={16} className="text-[var(--accent-primary)]" /> },
    { value: "super_admin", label: t.roleSuperAdminPlural, icon: <Shield size={16} className="text-[#ef4444]" /> },
    { value: "registration", label: t.roleRegistrationPlural, icon: <UserIcon size={16} className="text-[#3b82f6]" /> },
    { value: "organizer", label: t.roleOrganizerPlural, icon: <Award size={16} className="text-[#10b981]" /> }
  ];

  const editRoleOptions = [
    { value: "student", label: t.roleStudent, icon: <GraduationCap size={16} className="text-muted" /> },
    { value: "staff", label: t.roleStaff, icon: <Briefcase size={16} className="text-[#14b8a6]" /> },
    { value: "admin", label: t.roleAdmin, icon: <ShieldCheck size={16} className="text-[var(--accent-primary)]" /> },
    { value: "super_admin", label: t.roleSuperAdmin, icon: <Shield size={16} className="text-[#ef4444]" /> },
    { value: "registration", label: t.roleRegistration, icon: <UserIcon size={16} className="text-[#3b82f6]" /> },
    { value: "organizer", label: t.roleOrganizer, icon: <Award size={16} className="text-[#10b981]" /> }
  ];

  const allowedEditRoleOptions = editRoleOptions.filter(opt => {
    if (opt.value === "super_admin" && userRole !== "super_admin") {
      return false;
    }
    return true;
  });

  const editHouseOptions = [
    { value: "", label: t.unassignedLabel, icon: <X size={16} className="text-muted" /> },
    ...houses.map(h => ({
      value: h.id,
      label: getHouseName(h.id, h.name),
      color: h.id === "red" ? "#ef4444" : h.id === "blue" ? "#3b82f6" : h.id === "green" ? "#10b981" : h.id === "yellow" ? "#f59e0b" : "var(--accent-primary)"
    }))
  ];

  const filtered = students.filter(
    (s) => {
      const displayName = s.name && s.prefix && s.name.startsWith(s.prefix) ? s.name : `${s.prefix || ""}${s.name || ""}`;
      const fullName = displayName.toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase()) ||
        s.studentId?.includes(search) ||
        s.nickname?.toLowerCase().includes(search.toLowerCase());

      const matchesHouse = houseFilter === "all" || s.houseId === houseFilter;
      const matchesRole = roleFilter === "all" ||
        (roleFilter === "staff" && ["staff", "professor", "officer"].includes(s.role || "")) ||
        (s.role || "student") === roleFilter;

      return matchesSearch && matchesHouse && matchesRole;
    }
  );

  const viewSensitive = async (id: string) => {
    if (!confirm("⚠ CRITICAL ACCESS: Viewing medical/emergency data will be permanently logged. Continue?")) return;
    setViewingId(id);
    setLoadingSensitive(true);
    setSensitiveData(null);
    try {
      const res = await fetch(`/api/admin/students/${id}`);
      if (res.ok) setSensitiveData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSensitive(false);
    }
  };

  return (
    <>
      <div className="animate-fade-in-up pb-24">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6" style={{ marginBottom: 40 }}>
          <h1 className="text-[clamp(32px,5vw,48px)] font-black tracking-tighter text-[var(--text-primary)] leading-tight">{t.adminStudentsDirectory}</h1>
          <div className="flex items-center gap-5 bg-[var(--bg-surface)] px-7 py-4 rounded-[40px] border border-[var(--border-subtle)] shadow-xl shadow-black/5 flex-shrink-0">
            <div className="flex-shrink-0 w-14 h-14 rounded-[20px] bg-[var(--accent-glow)] flex items-center justify-center text-[var(--accent-primary)]">
              <Users size={26} />
            </div>
            <div className="flex flex-col min-w-[120px]">
              <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{filtered.length}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 5, whiteSpace: "nowrap" }}>Active Members</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div
          className="flex flex-col lg:flex-row gap-5 bg-[var(--bg-surface)] p-4 rounded-[32px] border border-[var(--border-subtle)] shadow-2xl shadow-black/5 overflow-visible"
          style={{ marginBottom: 48 }}
        >
          <div className="relative flex-1 group">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input
              id="student-search-input"
              className="input w-full h-14 bg-[var(--bg-elevated)] border-none rounded-2xl text-base font-medium transition-all focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              style={{ paddingLeft: 60 }}
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 flex-shrink-0">
            <CustomDropdown
              className="min-w-[220px]"
              value={houseFilter}
              options={houseOptions}
              onChange={setHouseFilter}
              icon={<Home size={18} />}
            />
            <CustomDropdown
              className="min-w-[220px]"
              value={roleFilter}
              options={roleOptions}
              onChange={setRoleFilter}
              icon={<Shield size={18} />}
            />
          </div>
        </div>

        {/* Data Table Container */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 40,
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.02)"
          }}
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 100, gap: 20 }}>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Retrieving Student Records...</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ borderCollapse: "separate", borderSpacing: "0 0" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "24px 32px" }}>Identification</th>
                    <th>Full Name & Identity</th>
                    <th>Academic Info</th>
                    <th>House Affiliation</th>
                    <th>System Status</th>
                    <th style={{ textAlign: "right", paddingRight: 32 }}>Security Access</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const isTargetSuperAdmin = s.role === "super_admin";
                    const canModifyThisRow = canEditOrDelete && (!isTargetSuperAdmin || userRole === "super_admin");
                    return (
                      <tr key={s.id} style={{ transition: "all 0.2s" }} className="student-row">
                      <td style={{ padding: "24px 32px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-subtle)" }}>
                            <GraduationCap size={16} className="text-muted" />
                          </div>
                          <code style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                            {s.studentId ?? "—"}
                          </code>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 16 }}>
                            {s.name && s.prefix && s.name.startsWith(s.prefix) ? s.name : `${s.prefix || ""}${s.name || ""}`}
                          </span>
                          {s.role === "super_admin" && (
                            <span className="badge" style={{ padding: "2px 8px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="Super Administrator">
                              <Shield size={10} /> {t.roleSuperAdmin}
                            </span>
                          )}
                          {s.role === "admin" && (
                            <span className="badge" style={{ padding: "2px 8px", background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="System Administrator">
                              <ShieldCheck size={10} /> {t.roleAdmin}
                            </span>
                          )}
                          {s.role === "registration" && (
                            <span className="badge" style={{ padding: "2px 8px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="Registration Staff">
                              <UserIcon size={10} /> {t.roleRegistration}
                            </span>
                          )}
                          {s.role === "organizer" && (
                            <span className="badge" style={{ padding: "2px 8px", background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="Event Organizer">
                              <Award size={10} /> {t.roleOrganizer}
                            </span>
                          )}
                          {(s.role === "staff" || s.role === "professor" || s.role === "officer") && (
                            <span className="badge" style={{ padding: "2px 8px", background: "rgba(20,184,166,0.1)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="Staff">
                              <Briefcase size={10} /> {t.roleStaff}
                            </span>
                          )}
                          {s.nickname && (
                            <span className="badge" style={{ padding: "2px 8px", background: "var(--bg-elevated)", color: "var(--text-muted)", fontSize: 10, flexShrink: 0 }}>&ldquo;{s.nickname}&rdquo;</span>
                          )}
                          {hasActualMedicalInfo(s) && (
                            <div style={{ color: "#ef4444", animation: "pulse-glow 2s infinite", display: "inline-flex", flexShrink: 0 }} title="Medical Condition">
                              <Activity size={20} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)" }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{s.major ?? "N/A"}</span>
                        </div>
                      </td>
                      <td>
                        {s.house ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: s.house.color || "var(--accent-primary)",
                              boxShadow: `0 0 10px ${s.house.color}44`
                            }} />
                            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{getHouseName(s.house.id, s.house.name)}</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        {s.profileCompleted ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10b981" }}>
                            <ShieldCheck size={16} />
                            <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>Verified</span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-secondary)" }}>
                            <Activity size={16} />
                            <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>Pending</span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", paddingRight: 32 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          {canModifyThisRow ? (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: 8, borderRadius: 10, color: "var(--text-secondary)" }}
                              onClick={() => setEditingStudent(s)}
                              title="Edit User"
                            >
                              <Edit2 size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: 8, borderRadius: 10, color: "var(--text-muted)", opacity: 0.4, cursor: "not-allowed" }}
                              disabled
                              title="Edit User (Restricted)"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {canModifyThisRow ? (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: 8, borderRadius: 10, color: "#ef4444" }}
                              onClick={async () => {
                                if (confirm(`⚠ PERMANENT ACTION: Are you sure you want to delete ${s.name}? This cannot be undone.`)) {
                                  const res = await fetch(`/api/admin/users/${s.id}`, { method: "DELETE" });
                                  if (res.ok) refreshData();
                                  else alert("Failed to delete user. Check permissions.");
                                }
                              }}
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: 8, borderRadius: 10, color: "var(--text-muted)", opacity: 0.4, cursor: "not-allowed" }}
                              disabled
                              title="Delete User (Restricted)"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <div style={{ width: 1, height: 24, background: "var(--border-subtle)", margin: "0 4px" }} />
                          <button
                            id={`view-sensitive-${s.id}-btn`}
                            className="btn btn-sm"
                            style={{
                              borderRadius: 10,
                              background: "rgba(239,68,68,0.08)",
                              border: "1px solid rgba(239,68,68,0.15)",
                              fontWeight: 700,
                              color: "#ef4444",
                              fontSize: 12,
                              gap: 6
                            }}
                            onClick={() => viewSensitive(s.id)}
                          >
                            <ShieldAlert size={13} /> Medical Log
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 80 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                            <Search size={32} />
                          </div>
                          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>{search ? "No matches found for your criteria." : "Directory is currently empty."}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sensitive Data Modal */}
      {viewingId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24
          }}
          onClick={() => { setViewingId(null); setSensitiveData(null); }}
        >
          <div
            className="animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: 40,
              padding: 0,
              maxWidth: 600,
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 50px 100px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "32px 40px", borderBottom: "1px solid var(--border-subtle)", background: "linear-gradient(to bottom, var(--bg-surface), var(--bg-elevated))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="badge animate-pulse-glow" style={{ background: "#ef4444", color: "#fff", border: "none", marginBottom: 12 }}>
                    <ShieldAlert size={12} /> SECURE ACCESS
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>Member Health Profile</h2>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ borderRadius: "50%", width: 44, height: 44, padding: 0, background: "var(--bg-elevated)" }}
                  onClick={() => { setViewingId(null); setSensitiveData(null); }}
                >
                  <X size={20} />
                </button>
              </div>

              {loadingSensitive ? (
                <div style={{ height: 20 }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>
                      {sensitiveData?.name && sensitiveData?.prefix && sensitiveData.name.startsWith(sensitiveData.prefix) ? sensitiveData.name : `${sensitiveData?.prefix || ""}${sensitiveData?.name || ""}`}
                    </p>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>Member ID: {sensitiveData?.studentId}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "40px" }} className="custom-scrollbar">
              {loadingSensitive ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 0" }}>
                  <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
                  <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Decrypting health records...</p>
                </div>
              ) : sensitiveData && (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  {/* Medical Section */}
                  <div>
                    <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <Heart size={14} style={{ color: "#ef4444" }} /> CLINICAL OBSERVATIONS
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                      {[
                        ["Chronic Diseases", sensitiveData.chronicDiseases],
                        ["Medical History", sensitiveData.medicalHistory],
                        ["Drug Allergies", sensitiveData.drugAllergies],
                        ["Food Allergies", sensitiveData.foodAllergies],
                        ["Dietary Restrictions", sensitiveData.dietaryRestrictions],
                        ["History of Fainting", sensitiveData.faintingHistory ? "YES, Report of Fainting History" : "No known history"],
                      ].map(([label, value]) => (
                        <div key={label as string} style={{ padding: "16px 20px", background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                          <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>
                          <p style={{ fontSize: 15, fontWeight: 600, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
                            {value || "No records provided"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Emergency Contacts */}
                  <div>
                    <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <Phone size={14} style={{ color: "var(--accent-primary)" }} /> EMERGENCY CONTACT PROTOCOL
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {Array.isArray(sensitiveData.emergencyContacts) && sensitiveData.emergencyContacts.length > 0 ? (
                        sensitiveData.emergencyContacts.map((c, i) => (
                          <div key={i} style={{ padding: "20px", background: "var(--bg-elevated)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)" }} />
                              <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{c.name}</p>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                              {c.relationship.startsWith("Other:") ? c.relationship.substring(6) : c.relationship}
                            </p>
                            <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--accent-primary)", fontWeight: 800, textDecoration: "none", fontSize: 16 }}>
                              <Phone size={16} />
                              {c.phone}
                            </a>
                          </div>
                        ))
                      ) : (
                        <div style={{ gridColumn: "span 2", padding: 32, textAlign: "center", background: "var(--bg-elevated)", borderRadius: 20, border: "1px dashed var(--border-medium)" }}>
                          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>No emergency contacts listed.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security Disclaimer */}
                  <div style={{ padding: 20, borderRadius: 20, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)", display: "flex", gap: 16, alignItems: "center" }}>
                    <ShieldAlert size={24} style={{ color: "#ef4444" }} />
                    <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, lineHeight: 1.5 }}>
                      SECURITY PROTOCOL: This session has been audited. Unauthorized disclosure of this information is strictly prohibited and subject to institutional discipline.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "24px 40px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" style={{ borderRadius: 12, padding: "12px 32px" }} onClick={() => { setViewingId(null); setSensitiveData(null); }}>Close Records</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingStudent && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }} onClick={() => setEditingStudent(null)}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "100%",
            maxWidth: 500,
            borderRadius: 32,
            overflow: "visible",
            boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 32, borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center", borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900 }}>{t.manageUser}</h3>
              <button className="btn btn-ghost" onClick={() => setEditingStudent(null)} style={{ borderRadius: "50%", width: 40, height: 40, padding: 0 }}><X size={20} /></button>
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>{t.fullName}</label>
                <input
                  className="input"
                  value={editingStudent.name}
                  onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>{t.studentId}</label>
                  <input
                    className="input"
                    value={editingStudent.studentId || ""}
                    onChange={e => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>{t.nickname}</label>
                  <input
                    className="input"
                    value={editingStudent.nickname || ""}
                    onChange={e => setEditingStudent({ ...editingStudent, nickname: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block", marginLeft: 8 }}>{t.systemRole}</label>
                  <CustomDropdown
                    value={editingStudent.role || "student"}
                    options={allowedEditRoleOptions}
                    onChange={val => setEditingStudent({ ...editingStudent, role: val })}
                    icon={<Shield size={18} />}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>{t.house}</label>
                  <CustomDropdown
                    value={editingStudent.houseId || ""}
                    options={editHouseOptions}
                    onChange={val => setEditingStudent({ ...editingStudent, houseId: val })}
                    icon={<Home size={18} />}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>{t.major}</label>
                <input
                  className="input"
                  value={editingStudent.major || ""}
                  onChange={e => setEditingStudent({ ...editingStudent, major: e.target.value })}
                  placeholder="e.g. SE, ANI, MMIT"
                />
              </div>
            </div>
            <div style={{ padding: "20px 32px", background: "var(--bg-elevated)", display: "flex", justifyContent: "flex-end", gap: 12, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
              <button className="btn btn-ghost" onClick={() => setEditingStudent(null)}>{t.cancel}</button>
              <button
                className="btn btn-primary"
                disabled={updating}
                onClick={async () => {
                  setUpdating(true);
                  try {
                    const res = await fetch(`/api/admin/users/${editingStudent.id}`, {
                      method: "PATCH",
                      body: JSON.stringify(editingStudent)
                    });
                    if (res.ok) {
                      setEditingStudent(null);
                      refreshData();
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setUpdating(false);
                  }
                }}
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .student-row:hover {
          background: var(--bg-glass);
          cursor: default;
        }
        .student-row:hover .btn-ghost {
          background: var(--bg-surface);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-medium); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
      `}</style>
    </>
  );
}