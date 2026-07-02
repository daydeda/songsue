"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  Building2, Plus, Pencil, Archive, ArchiveRestore, X, Users, Eye,
  Trash2, AlertCircle, Check,
} from "lucide-react";

type Club = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  memberCount: number;
  presidentCount: number;
};

type ClubMember = {
  id: string;
  userId: string;
  role: string; // 'president' | 'member'
  userName: string | null;
  studentId: string | null;
};

export default function ClubsPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const userRole = session?.user?.role || "student";
  const canManage = userRole === "super_admin" || userRole === "admin";

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  // Create/rename modal. `editingId === "new"` means the create flow;
  // otherwise it holds the id of the club being renamed.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Club | null>(null);

  // Members modal — super_admin/admin only (gated at the API too, see
  // /api/admin/clubs/[id]/members). Each club's roster is only ever fetched
  // for the ONE club being viewed, on demand — never bulk-loaded for all clubs
  // at once, so opening this page never pulls every club's membership PII.
  const [viewingMembers, setViewingMembers] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const openMembers = (club: Club) => {
    setViewingMembers(club);
    setMembers([]);
    setMembersError(null);
    setLoadingMembers(true);
    fetch(`/api/admin/clubs/${club.id}/members`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error((data && data.error) || "Failed to load members");
        }
        return r.json();
      })
      .then((d) => { if (Array.isArray(d)) setMembers(d); })
      .catch((err) => setMembersError(err instanceof Error ? err.message : "Failed to load members"))
      .finally(() => setLoadingMembers(false));
  };

  const refresh = () => {
    setLoading(true);
    setListError(null);
    fetch(`/api/admin/clubs?includeArchived=${includeArchived}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error((data && data.error) || "Failed to load clubs");
        }
        return r.json();
      })
      .then((d) => { if (Array.isArray(d)) setClubs(d); })
      .catch((err) => setListError(err instanceof Error ? err.message : "Failed to load clubs"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Deferred via setTimeout so the fetch kicks off after this render commits,
    // matching the pattern used elsewhere (e.g. admin/students) — calling
    // setState synchronously inside the effect body itself is flagged by the
    // react-hooks/set-state-in-effect lint rule.
    const timer = setTimeout(() => {
      refresh();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const openCreate = () => {
    setEditingId("new");
    setNameDraft("");
    setFormError(null);
  };

  const openRename = (club: Club) => {
    setEditingId(club.id);
    setNameDraft(club.name);
    setFormError(null);
  };

  const closeModal = () => {
    if (saving) return;
    setEditingId(null);
    setNameDraft("");
    setFormError(null);
  };

  const submitModal = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setFormError("Name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const isCreate = editingId === "new";
      const res = await fetch(isCreate ? "/api/admin/clubs" : `/api/admin/clubs/${editingId}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Failed to save club");
      }
      setEditingId(null);
      setNameDraft("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save club");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchived = async (club: Club) => {
    setArchivingId(club.id);
    try {
      const res = await fetch(`/api/admin/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !club.isArchived }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "Failed to update club");
      }
      refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to update club");
    } finally {
      setArchivingId(null);
    }
  };

  // Permanent delete — super_admin/admin only, gated the same way server-side
  // (see DELETE /api/admin/clubs/[id]). The server also detaches this club's id
  // from any event's ownerClubIds before deleting it, so no event is left
  // pointing at a club that no longer exists.
  const confirmAndDelete = async () => {
    if (!confirmDelete) return;
    const club = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(club.id);
    try {
      const res = await fetch(`/api/admin/clubs/${club.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "Failed to delete club");
      }
      refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to delete club");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="animate-fade-in-up pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6" style={{ marginBottom: 40 }}>
          <h1 className="text-[clamp(32px,5vw,48px)] font-black tracking-tighter text-[var(--text-primary)] leading-tight">
            {t.manageClubs || "Clubs"}
          </h1>
          {canManage && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={18} />
              New Club
            </button>
          )}
        </div>

        {/* Controls */}
        <div
          className="bg-[var(--bg-surface)] p-4 rounded-[32px] border border-[var(--border-subtle)] shadow-2xl shadow-black/5"
          style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}
        >
          <div
            role="checkbox"
            aria-checked={includeArchived}
            tabIndex={0}
            onClick={() => setIncludeArchived((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIncludeArchived((v) => !v);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 12,
              cursor: "pointer",
              userSelect: "none",
              transition: "all 0.2s",
              background: includeArchived ? "var(--bg-elevated)" : "transparent",
              border: `1px solid ${includeArchived ? "var(--accent-primary)" : "var(--border-subtle)"}`,
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: includeArchived ? "var(--accent-primary)" : "transparent",
              border: `2px solid ${includeArchived ? "var(--accent-primary)" : "var(--border-medium)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s",
            }}>
              {includeArchived && <Check size={13} color="white" strokeWidth={3} />}
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: includeArchived ? "var(--text-primary)" : "var(--text-secondary)" }}>
              Include archived clubs
            </span>
          </div>
        </div>

        {listError && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444",
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            {listError}
          </div>
        )}

        {/* Table */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 40,
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.02)",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 100, gap: 20 }}>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading clubs…</p>
            </div>
          ) : clubs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 100, gap: 16 }}>
              <Building2 size={40} style={{ color: "var(--text-muted)" }} />
              <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>No clubs yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ borderCollapse: "separate", borderSpacing: "0 0" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "24px 32px" }}>Name</th>
                    <th>Members</th>
                    <th>Status</th>
                    <th>Created</th>
                    {canManage && <th style={{ textAlign: "right", paddingRight: 32 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((club) => (
                    <tr key={club.id}>
                      <td style={{ padding: "16px 32px", fontWeight: 700, color: "var(--text-primary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Building2 size={16} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                          {club.name}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontWeight: 600 }}>
                          <Users size={14} style={{ color: "var(--text-muted)" }} />
                          {club.memberCount} member{club.memberCount === 1 ? "" : "s"}
                          {club.presidentCount > 0 && (
                            <span className="badge badge-blue" style={{ marginLeft: 6 }}>
                              {club.presidentCount} president{club.presidentCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {club.isArchived ? (
                          <span className="badge badge-yellow">Archived</span>
                        ) : (
                          <span className="badge badge-green">Active</span>
                        )}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                        {new Date(club.createdAt).toLocaleDateString()}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right", paddingRight: 32 }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openMembers(club)}>
                              <Eye size={14} />
                              Members
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => openRename(club)}>
                              <Pencil size={14} />
                              Rename
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={archivingId === club.id}
                              onClick={() => toggleArchived(club)}
                            >
                              {club.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                              {club.isArchived ? "Unarchive" : "Archive"}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: "#ef4444" }}
                              disabled={deletingId === club.id}
                              onClick={() => setConfirmDelete(club)}
                            >
                              {deletingId === club.id ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Trash2 size={14} />}
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create / Rename Modal */}
      {editingId && (
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
            zIndex: 1100,
            padding: "clamp(12px, 4vw, 24px)",
          }}
          onClick={closeModal}
        >
          <div
            className="animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              width: "100%",
              maxWidth: 440,
              borderRadius: "clamp(20px, 5vw, 32px)",
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
              border: "1px solid var(--border-medium)",
            }}
          >
            <div style={{ padding: "28px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                {editingId === "new" ? "New Club" : "Rename Club"}
              </h2>
              <button className="btn btn-ghost" style={{ borderRadius: "50%", width: 36, height: 36, padding: 0 }} onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label className="label">Club Name</label>
                <input
                  className="input"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitModal(); }}
                  placeholder="e.g. Coding Club"
                />
              </div>
              {formError && (
                <p style={{ color: "#ef4444", fontWeight: 600, fontSize: 13 }}>{formError}</p>
              )}
            </div>

            <div style={{ padding: "20px 32px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitModal} disabled={saving}>
                {saving ? "Saving…" : editingId === "new" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal — one club's roster at a time, super_admin/admin only.
          A different club's president can never reach this (proxy blocks
          club_president from /admin/clubs entirely, and the API is gated
          super_admin/admin — see /api/admin/clubs/[id]/members). */}
      {viewingMembers && (
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
            zIndex: 1100,
            padding: "clamp(12px, 4vw, 24px)",
          }}
          onClick={() => setViewingMembers(null)}
        >
          <div
            className="animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              width: "100%",
              maxWidth: 480,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "clamp(20px, 5vw, 32px)",
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
              border: "1px solid var(--border-medium)",
            }}
          >
            <div style={{ padding: "28px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                  {viewingMembers.name}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
                  {members.length} member{members.length === 1 ? "" : "s"}
                </p>
              </div>
              <button className="btn btn-ghost" style={{ borderRadius: "50%", width: 36, height: 36, padding: 0 }} onClick={() => setViewingMembers(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "12px 20px", overflowY: "auto", flex: 1 }}>
              {loadingMembers ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                </div>
              ) : membersError ? (
                <p style={{ color: "#ef4444", fontWeight: 600, fontSize: 13, padding: "12px 12px" }}>{membersError}</p>
              ) : members.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 13, padding: "12px 12px" }}>
                  No members yet — assign a club_president to this club from the Students page.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {members.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "var(--bg-elevated)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                          {m.userName || "Unnamed"}
                        </div>
                        {m.studentId && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                            {m.studentId}
                          </div>
                        )}
                      </div>
                      {m.role === "president" && (
                        <span className="badge badge-blue">President</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — danger style, matches admin/events. Permanent:
          the club and all its club_members rows are gone; any event still
          citing it as an owner is detached server-side (see DELETE route). */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
            zIndex: 2400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              width: "90%",
              maxWidth: 440,
              borderRadius: 28,
              padding: 32,
              textAlign: "center",
              boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
              border: "1px solid var(--border-medium)",
            }}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <AlertCircle size={28} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", marginBottom: 12 }}>
              Delete &ldquo;{confirmDelete.name}&rdquo;?
            </h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
              This permanently removes the club{confirmDelete.memberCount > 0 ? ` and its ${confirmDelete.memberCount} member${confirmDelete.memberCount === 1 ? "" : "s"}` : ""}.
              Any event that had this club assigned as an owner will need a new club assigned. This cannot be undone — consider Archive instead if you just want to hide it.
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, height: 46, borderRadius: 12, fontSize: 14, fontWeight: 700 }}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)",
                }}
                onClick={confirmAndDelete}
              >
                Delete Club
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
