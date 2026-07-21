"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { facultyFromStudentId } from "@/lib/faculties";

type EmergencyContact = { name: string; relationship: string; phone: string };

/**
 * The compact, single-screen alternative to the full onboarding wizard —
 * shown inline (never a page nav) the first time an account with
 * profileCompleted=false tries to do something that actually needs it (see
 * DashboardClient.tsx's promptRegister). Most accounts reaching this already
 * have name/studentId/faculty/major/phone from an ActiveCAMT sync
 * (ActiveCamtSyncService.upsertSyncedUser) — proxy.ts no longer force-routes
 * those through /onboarding, so re-asking for data Songsue already has would
 * be pure friction. What's collected here is only what's genuinely never
 * synced from anywhere: nickname, contact channel, one emergency contact, and
 * Songsue's own PDPA consent (a separate legal basis from whatever consent
 * the source app collected). Medical fields are intentionally NOT asked here
 * — they're optional everywhere else in the app too — a student can add them
 * later from /dashboard/profile.
 *
 * Submits through the SAME POST /api/profile the full wizard uses, so it sets
 * profileCompleted=true identically; the only difference is which fields this
 * particular screen collects.
 */
export function QuickProfileModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t, lang } = useLanguage();
  const isTh = lang === "th";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationTriggered, setValidationTriggered] = useState(false);

  const [known, setKnown] = useState({ name: "", studentId: "", prefix: "นาย", major: "" });
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [contactChannels, setContactChannels] = useState("");
  const [ec1, setEc1] = useState<EmergencyContact>({ name: "", relationship: "", phone: "" });
  const [pdpaConsent, setPdpaConsent] = useState(false);

  // studentId only needs to be asked if the account genuinely has none yet —
  // proxy.ts already forces the full wizard for those, so in practice this
  // stays read-only/pre-filled, but stays editable as a safety net rather
  // than silently failing the submit if that assumption ever changes.
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setError(null);
      setValidationTriggered(false);
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const u = await res.json();
          setKnown({
            name: u.name || "",
            studentId: u.studentId || "",
            prefix: u.prefix || "นาย",
            major: u.major || "",
          });
          setStudentId(u.studentId || "");
          setNickname(u.nickname || "");
          setPhone(u.phone || "");
          setContactChannels(u.contactChannels || "");
        }
      } catch {
        // Blank fallback fields are still usable — nothing to surface.
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const derivedFaculty = facultyFromStudentId(studentId);
  const needsStudentId = !known.studentId;

  const handleSubmit = async () => {
    setError(null);
    if (
      !nickname.trim() ||
      !contactChannels.trim() ||
      !phone.trim() ||
      (needsStudentId && !studentId.trim()) ||
      !ec1.name.trim() ||
      !ec1.relationship.trim() ||
      ec1.relationship.trim() === "Other:" ||
      !ec1.phone.trim()
    ) {
      setError(isTh ? "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" : "Please fill out all required fields.");
      setValidationTriggered(true);
      return;
    }
    if (needsStudentId && !/^[0-9]{9}$/.test(studentId.trim())) {
      setError(isTh ? "รหัสนักศึกษาต้องเป็นตัวเลข 9 หลักเท่านั้น" : "Student ID must be exactly 9 digits.");
      setValidationTriggered(true);
      return;
    }
    if (needsStudentId && !derivedFaculty) {
      setError(isTh
        ? "รหัสนักศึกษานี้ไม่ตรงกับคณะที่เข้าร่วมกิจกรรม กรุณาติดต่อเจ้าหน้าที่"
        : "This student ID's faculty isn't one of the participating faculties. Please contact staff.");
      setValidationTriggered(true);
      return;
    }
    if (!/^[0-9]{10}$/.test(phone.trim())) {
      setError(isTh ? "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Phone number must be exactly 10 digits.");
      setValidationTriggered(true);
      return;
    }
    if (!/^[0-9]{10}$/.test(ec1.phone.trim())) {
      setError(isTh ? "เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉินต้องเป็นตัวเลข 10 หลัก" : "Emergency contact phone must be exactly 10 digits.");
      setValidationTriggered(true);
      return;
    }
    if (!pdpaConsent) {
      setError(t.pdpaConsent);
      setValidationTriggered(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: known.name,
          prefix: known.prefix,
          major: known.major || null,
          studentId: needsStudentId ? studentId.trim() : known.studentId,
          nickname: nickname.trim(),
          phone: phone.trim(),
          contactChannels: contactChannels.trim(),
          emergencyContacts: [ec1, { name: "", relationship: "", phone: "" }],
          pdpaConsent: true,
        }),
      });
      if (res.ok) {
        onComplete();
      } else {
        const d = await res.json().catch(() => ({}));
        const errVal = Array.isArray(d.error) ? d.error[0]?.message : d.error;
        // A stale session can say profileCompleted=false when the DB row is
        // already true (e.g. completed in another tab) — that's not actually
        // a failure from the user's point of view, just this screen being
        // unnecessary now.
        if (errVal === "Profile already completed") {
          onComplete();
          return;
        }
        setError((t as Record<string, string>)[errVal] || errVal || (isTh ? "เกิดข้อผิดพลาด กรุณาลองใหม่" : "Something went wrong. Please try again."));
      }
    } catch {
      setError(isTh ? "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง" : "A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const lbl = "text-sm font-bold";
  const inp = "input";
  const errStyle = (bad: boolean) => (validationTriggered && bad ? { borderColor: "#ef4444" } : undefined);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
        zIndex: 2050, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        overflowY: "auto",
      }}
    >
      <div
        className="animate-fade-in-up"
        style={{
          background: "var(--bg-surface)", width: "100%", maxWidth: 480, borderRadius: 28,
          padding: 28, boxShadow: "0 30px 60px rgba(0,0,0,0.3)", border: "1px solid var(--border-medium)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h4 style={{ fontSize: 19, fontWeight: 900, color: "var(--text-primary)" }}>
            {isTh ? "กรอกข้อมูลเพิ่มเติมก่อนลงทะเบียน" : "A few more details before you register"}
          </h4>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6, minHeight: 0 }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
          {isTh
            ? "ข้อมูลส่วนตัวของคุณถูกดึงมาจาก ActiveCAMT แล้ว เหลือแค่นี้ที่ Songsue ยังไม่มี"
            : "Your info is already in from ActiveCAMT — this is just what Songsue doesn't have yet."}
        </p>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {isTh ? "กำลังโหลด..." : "Loading..."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {needsStudentId && (
              <div className="field">
                <label className={lbl}>{t.studentId} <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  className={inp} maxLength={9} placeholder="640510000" inputMode="numeric"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
                  style={errStyle(studentId.trim().length !== 9)}
                />
              </div>
            )}

            <div className="field">
              <label className={lbl}>{t.nickname} <span style={{ color: "#ef4444" }}>*</span></label>
              <input className={inp} placeholder={t.nickname} value={nickname} onChange={(e) => setNickname(e.target.value)} style={errStyle(!nickname.trim())} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="field flex-1">
                <label className={lbl}>{t.phone} <span style={{ color: "#ef4444" }}>*</span></label>
                <input className={inp} maxLength={10} inputMode="numeric" placeholder="0812345678" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} style={errStyle(!/^[0-9]{10}$/.test(phone.trim()))} />
              </div>
              <div className="field flex-1">
                <label className={lbl}>{t.contactChannels} <span style={{ color: "#ef4444" }}>*</span></label>
                <input className={inp} placeholder="IG: smocamt / LINE: smocamt" value={contactChannels} onChange={(e) => setContactChannels(e.target.value)} style={errStyle(!contactChannels.trim())} />
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
                {isTh ? "ผู้ติดต่อฉุกเฉิน" : "Emergency Contact"}
              </p>
              <div className="flex flex-col gap-3">
                <input className={inp} placeholder={isTh ? "ชื่อ-นามสกุล" : "Full name"} value={ec1.name} onChange={(e) => setEc1((p) => ({ ...p, name: e.target.value }))} style={errStyle(!ec1.name.trim())} />
                <div className="flex gap-3">
                  <select
                    className={inp}
                    style={{ flex: 1, minHeight: 48, ...errStyle(!ec1.relationship.trim() || ec1.relationship === "Other:") }}
                    value={["", "Father", "Mother", "Guardian", "Sibling", "Relative", "Friend"].includes(ec1.relationship) ? ec1.relationship : (ec1.relationship ? "Other" : "")}
                    onChange={(e) => setEc1((p) => ({ ...p, relationship: e.target.value === "Other" ? "Other:" : e.target.value }))}
                  >
                    <option value="" disabled>{t.relationship}</option>
                    <option value="Father">{t.father}</option>
                    <option value="Mother">{t.mother}</option>
                    <option value="Guardian">{t.guardian}</option>
                    <option value="Sibling">{t.sibling}</option>
                    <option value="Relative">{t.relative}</option>
                    <option value="Friend">{t.friend}</option>
                    <option value="Other">{isTh ? "อื่น ๆ" : "Other"}</option>
                  </select>
                  <input className={inp} style={{ flex: 1, ...errStyle(!/^[0-9]{10}$/.test(ec1.phone.trim())) }} maxLength={10} inputMode="numeric" placeholder={isTh ? "เบอร์โทร" : "Phone"} value={ec1.phone} onChange={(e) => setEc1((p) => ({ ...p, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) }))} />
                </div>
                {ec1.relationship.startsWith("Other:") && (
                  <input
                    className={inp}
                    placeholder={isTh ? "กรุณาระบุความสัมพันธ์..." : "Please specify relationship..."}
                    value={ec1.relationship.substring(6)}
                    onChange={(e) => setEc1((p) => ({ ...p, relationship: "Other:" + e.target.value }))}
                  />
                )}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 14px", background: pdpaConsent ? "rgba(0,0,0,0.05)" : "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: `1.5px solid ${pdpaConsent ? "rgba(0,0,0,0.35)" : "var(--border-medium)"}`, cursor: "pointer", marginTop: 4 }}>
              <input type="checkbox" style={{ width: 18, height: 18, accentColor: "var(--accent-primary)", flexShrink: 0, marginTop: 2 }} checked={pdpaConsent} onChange={(e) => setPdpaConsent(e.target.checked)} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{t.pdpaConsent}</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{t.pdpaDetail}</p>
              </div>
            </label>

            {error && (
              <div className="alert alert-error">
                <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            <button
              className="btn"
              disabled={submitting}
              onClick={handleSubmit}
              style={{ width: "100%", height: 48, borderRadius: 12, fontSize: 14, fontWeight: 800, marginTop: 4 }}
            >
              {submitting ? (isTh ? "กำลังบันทึก..." : "Saving...") : (isTh ? "บันทึกและลงทะเบียน" : "Save & Register")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
