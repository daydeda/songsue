
"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Loader2, User, Maximize, Move } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

type EmergencyContact = { name: string; relationship: string; phone: string };

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const STEPS = [t.personalInfo, t.medicalInfo, t.emergencyContacts, t.reviewSubmit];

  const [formData, setFormData] = useState({
    studentId: "",
    prefix: "นาย",
    name: "",
    nickname: "",
    major: "SE",
    religion: "",
    phone: "",
    contactChannels: "",
    image: "",
    imageTransform: { scale: 1, x: 0, y: 0 },
    chronicDiseases: "",
    medicalHistory: "",
    drugAllergies: "",
    foodAllergies: "",
    dietaryRestrictions: "",
    faintingHistory: false,
    pdpaConsent: false,
    emergencyContacts: [
      { name: "", relationship: "", phone: "" },
      { name: "", relationship: "", phone: "" },
    ] as EmergencyContact[],
  });

  const set = (key: string, value: any) => setFormData((p) => ({ ...p, [key]: value }));
  const setEC = (idx: number, key: string, value: string) => {
    const contacts = [...formData.emergencyContacts] as EmergencyContact[];
    contacts[idx] = { ...contacts[idx], [key]: value };
    set("emergencyContacts", contacts);
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately (Blob URL is fastest)
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (data.url) {
        set("image", data.url);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err) {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.pdpaConsent) {
      setError(t.pdpaConsent);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        // Refresh session data and force a full page reload to ensure 100% real-time data sync
        await update(); 
        window.location.href = "/dashboard";
      } else {
        const d = await res.json();
        setError(Array.isArray(d.error) ? d.error[0]?.message : d.error);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "input";
  const labelCls = "label";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center py-12 px-4 overflow-y-auto"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full max-w-[640px] flex flex-col items-center">
        
      <div className="w-full flex justify-end mb-4 animate-fade-in-up">
        <LanguageSwitcher />
      </div>

      {/* Header */}
      <div className="mb-8 text-center animate-fade-in-up">
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            marginBottom: 8,
          }}
        >
          {t.step} {step + 1} of {STEPS.length}
        </div>
        <h1
          className="gradient-text"
          style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em" }}
        >
          {STEPS[step]}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>
          {t.signInSub}
        </p>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          height: 4,
          background: "var(--bg-elevated)",
          borderRadius: 99,
          marginBottom: 32,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: "var(--accent-primary)",
            borderRadius: 99,
            transition: "width 0.4s ease",
            boxShadow: "0 0 8px var(--accent-glow)",
          }}
        />
      </div>

      {/* Form card */}
      <div
        className="animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 600,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)",
          padding: 32,
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        }}
      >
        {/* Step 0: Personal Info */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            
            {/* Profile Picture Upload & Adjustment */}
            <div className="flex flex-col items-center gap-4 mb-4">
              <div 
                key={previewUrl ? "has-preview" : "no-preview"}
                style={{ 
                  width: 140, 
                  height: 140, 
                  borderRadius: "50%", 
                  backgroundColor: "var(--bg-elevated)",
                  border: previewUrl ? "2px solid var(--accent-primary)" : "2px dashed var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {uploading && (
                  <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                )}
                
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    style={{ 
                      position: "absolute", 
                      width: "100%", 
                      height: "100%", 
                      objectFit: "cover",
                      transform: `scale(${formData.imageTransform.scale}) translate(${formData.imageTransform.x}%, ${formData.imageTransform.y}%)`,
                      transition: "transform 0.1s ease-out",
                      zIndex: 10,
                      display: "block"
                    }}
                    onError={(e) => console.error("Preview failed:", previewUrl)}
                  />
                ) : (
                  !uploading && <User size={48} className="text-muted opacity-30" />
                )}
              </div>
              <label className="btn btn-ghost btn-sm" style={{ gap: 8, cursor: "pointer", borderRadius: 99 }}>
                <Camera size={16} />
                {previewUrl ? t.changePhoto : t.uploadPhoto}
                <input type="file" hidden accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              </label>

              {previewUrl && (
                <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12, padding: "12px 20px", background: "var(--bg-elevated)", borderRadius: 20, border: "1px solid var(--border-subtle)", marginTop: 8 }}>
                   <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                          <Maximize size={10} /> Zoom
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-primary)" }}>{Math.round(formData.imageTransform.scale * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="1" max="3" step="0.05" 
                        value={formData.imageTransform.scale} 
                        onChange={(e) => set("imageTransform", { ...formData.imageTransform, scale: parseFloat(e.target.value) })}
                        style={{ accentColor: "var(--accent-primary)", height: 4 }}
                      />
                   </div>
                   <div style={{ display: "flex", gap: 12 }}>
                      <div className="flex-1 flex flex-col gap-6">
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                              <Move size={10} /> X
                            </span>
                            <input 
                              type="range" 
                              min={-(formData.imageTransform.scale - 1) * 50} 
                              max={(formData.imageTransform.scale - 1) * 50} 
                              step="1" 
                              value={formData.imageTransform.x} 
                              onChange={(e) => set("imageTransform", { ...formData.imageTransform, x: parseInt(e.target.value) })}
                              style={{ accentColor: "var(--accent-primary)", height: 4 }}
                            />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-6">
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                              <Move size={10} style={{ transform: "rotate(90deg)" }} /> Y
                            </span>
                            <input 
                              type="range" 
                              min={-(formData.imageTransform.scale - 1) * 50} 
                              max={(formData.imageTransform.scale - 1) * 50} 
                              step="1" 
                              value={formData.imageTransform.y} 
                              onChange={(e) => set("imageTransform", { ...formData.imageTransform, y: parseInt(e.target.value) })}
                              style={{ accentColor: "var(--accent-primary)", height: 4 }}
                            />
                        </div>
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="field" style={{ width: 140 }}>
                <label className={labelCls}>{t.prefix}</label>
                <select
                  className={inputCls}
                  value={formData.prefix}
                  onChange={(e) => set("prefix", e.target.value)}
                >
                  <option value="นาย">นาย (Mr.)</option>
                  <option value="นางสาว">นางสาว (Ms.)</option>
                  <option value="นาง">นาง (Mrs.)</option>
                </select>
              </div>
              <div className="field flex-1">
                <label className={labelCls}>{t.fullName}</label>
                <input
                  className={inputCls}
                  required
                  placeholder="ชื่อ-สกุล / Full Name"
                  value={formData.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>{t.studentId}</label>
                <input
                  className={inputCls}
                  required={session?.user && (session.user as any).role !== "admin"}
                  minLength={(session?.user && (session.user as any).role === "admin") ? 0 : 9}
                  maxLength={9}
                  placeholder="640510000"
                  value={formData.studentId}
                  onChange={(e) => set("studentId", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>{t.nickname}</label>
                <input
                  className={inputCls}
                  required
                  placeholder={t.nickname}
                  value={formData.nickname}
                  onChange={(e) => set("nickname", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>{t.major}</label>
                <select
                  className={inputCls}
                  value={formData.major}
                  onChange={(e) => set("major", e.target.value)}
                >
                  <option value="ANI">ANI — Animation</option>
                  <option value="DG">DG — Digital Game</option>
                  <option value="DII">DII — Digital Innovation</option>
                  <option value="MMIT">MMIT — Multimedia &amp; IT</option>
                  <option value="SE">SE — Software Engineering</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>{t.religion}</label>
                <input
                  className={inputCls}
                  placeholder={t.religionPlaceholder}
                  value={formData.religion}
                  onChange={(e) => set("religion", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>{t.phone}</label>
                <input
                  className={inputCls}
                  required
                  placeholder="0812345678"
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>{t.contactChannels}</label>
                <input
                  className={inputCls}
                  placeholder="Line ID / Facebook"
                  value={formData.contactChannels}
                  onChange={(e) => set("contactChannels", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Medical Info */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div
              className="alert alert-info"
              style={{ fontSize: 13 }}
            >
              <span>🔒</span>
              <span>{t.medicalInfoDetail}</span>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>{t.chronicDiseases}</label>
                <input
                  className={inputCls}
                  placeholder={t.none}
                  value={formData.chronicDiseases}
                  onChange={(e) => set("chronicDiseases", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>{t.medicalHistory}</label>
                <input
                  className={inputCls}
                  placeholder={t.none}
                  value={formData.medicalHistory}
                  onChange={(e) => set("medicalHistory", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>{t.drugAllergies}</label>
                <input
                  className={inputCls}
                  placeholder={t.none}
                  value={formData.drugAllergies}
                  onChange={(e) => set("drugAllergies", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>{t.foodAllergies}</label>
                <input
                  className={inputCls}
                  placeholder={t.none}
                  value={formData.foodAllergies}
                  onChange={(e) => set("foodAllergies", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className={labelCls}>{t.dietaryRestrictions}</label>
              <select
                className={inputCls}
                value={formData.dietaryRestrictions}
                onChange={(e) => set("dietaryRestrictions", e.target.value)}
              >
                <option value="">{t.none}</option>
                <option value="Vegetarian">{t.veg}</option>
                <option value="Vegan">{t.vegan}</option>
                <option value="Halal">{t.halal}</option>
                <option value="Kosher">{t.kosher}</option>
                <option value="Other">{t.other}</option>
              </select>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                style={{ width: 18, height: 18, accentColor: "var(--accent-primary)" }}
                checked={formData.faintingHistory}
                onChange={(e) => set("faintingHistory", e.target.checked)}
              />
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {t.faintingHistory}
              </span>
            </label>
          </div>
        )}

        {/* Step 2: Emergency Contacts */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: 20,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--accent-primary)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 16,
                  }}
                >
                  {t.emergencyContacts} #{i + 1}
                </p>
                <div className="flex flex-col gap-4">
                  <div className="field">
                    <label className={labelCls}>{t.fullName}</label>
                    <input
                      className={inputCls}
                      required
                      placeholder={t.fullName}
                      value={formData.emergencyContacts[i].name}
                      onChange={(e) => setEC(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="field flex-1">
                      <label className={labelCls}>{t.relationship}</label>
                      <input
                        className={inputCls}
                        required
                        placeholder={t.relationship}
                        value={formData.emergencyContacts[i].relationship}
                        onChange={(e) => setEC(i, "relationship", e.target.value)}
                      />
                    </div>
                    <div className="field flex-1">
                      <label className={labelCls}>{t.phone}</label>
                      <input
                        className={inputCls}
                        required
                        placeholder="0812345678"
                        value={formData.emergencyContacts[i].phone}
                        onChange={(e) => setEC(i, "phone", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: PDPA + Review */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: 20,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                {t.profileSummary}
              </p>
              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                {[
                  [t.fullName, `${formData.prefix}${formData.name}`],
                  [t.nickname, formData.nickname],
                  [t.studentId, formData.studentId],
                  [t.major, formData.major],
                  [t.phone, formData.phone],
                  [t.religion, formData.religion || "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{k}</dt>
                    <dd style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 2 }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* PDPA Consent */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "16px 18px",
                background: formData.pdpaConsent
                  ? "rgba(108,110,255,0.06)"
                  : "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${formData.pdpaConsent ? "rgba(108,110,255,0.3)" : "var(--border-subtle)"}`,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <input
                type="checkbox"
                style={{ width: 18, height: 18, accentColor: "var(--accent-primary)", flexShrink: 0, marginTop: 2 }}
                checked={formData.pdpaConsent}
                onChange={(e) => set("pdpaConsent", e.target.checked)}
              />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  {t.pdpaConsent}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {t.pdpaDetail}
                </p>
              </div>
            </label>

            {error && (
              <div className="alert alert-error">
                <span>⚠️</span> {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div
          className="flex gap-3"
          style={{ marginTop: 32, justifyContent: step === 0 ? "flex-end" : "space-between" }}
        >
          {step > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={submitting}
            >
              ← {t.back}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              {t.continue} →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || !formData.pdpaConsent}
            >
              {submitting ? (
                <>
                  <div className="spinner" />
                  Submitting...
                </>
              ) : (
                t.complete
              )}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}