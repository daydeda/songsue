
"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Loader2, User, Maximize, Move } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

type EmergencyContact = { name: string; relationship: string; phone: string };

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationTriggered, setValidationTriggered] = useState(false);

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
    emergencyMedication: "",
    pdpaConsent: false,
    emergencyContacts: [
      { name: "", relationship: "", phone: "" },
      { name: "", relationship: "", phone: "" },
    ] as EmergencyContact[],
  });

  const set = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => setFormData((p) => ({ ...p, [key]: value }));
  const setEC = (idx: number, key: string, value: string) => {
    const contacts = [...formData.emergencyContacts] as EmergencyContact[];
    contacts[idx] = { ...contacts[idx], [key]: value };
    set("emergencyContacts", contacts);
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(t.fileTooLarge);
      return;
    }

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

  const handleContinue = () => {
    setError(null);
    const isTh = t.back === "กลับ";
    if (step === 0) {
      const isStudent = session?.user && session.user.role !== "admin";
      if (!formData.name.trim() || !formData.nickname.trim() || !formData.phone.trim() || !formData.contactChannels.trim() || (isStudent && !formData.studentId.trim())) {
        setError(isTh ? "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" : "Please fill out all required fields.");
        setValidationTriggered(true);
        return;
      }
      if (isStudent && !/^[0-9]{9}$/.test(formData.studentId.trim())) {
        setError(isTh ? "รหัสนักศึกษาต้องเป็นตัวเลข 9 หลักเท่านั้น" : "Student ID must be exactly 9 digits and contain only numbers.");
        setValidationTriggered(true);
        return;
      }
      if (!/^[0-9]{10}$/.test(formData.phone.trim())) {
        setError(isTh ? "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Phone number must be exactly 10 digits and contain only numbers.");
        setValidationTriggered(true);
        return;
      }
    }
    if (step === 2) {
      const ec1 = formData.emergencyContacts[0];
      if (!ec1.name.trim() || !ec1.relationship.trim() || !ec1.phone.trim()) {
        setError(isTh ? "กรุณากรอกข้อมูลผู้ติดต่อฉุกเฉินคนที่ 1 ให้ครบถ้วน" : "Please fill out all fields for Emergency Contact #1.");
        setValidationTriggered(true);
        return;
      }
      if (!/^[0-9]{10}$/.test(ec1.phone.trim())) {
        setError(isTh ? "เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉินคนที่ 1 ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Emergency Contact #1 phone number must be exactly 10 digits and contain only numbers.");
        setValidationTriggered(true);
        return;
      }
      const ec2 = formData.emergencyContacts[1];
      if (ec2.name.trim() || ec2.relationship.trim() || ec2.phone.trim()) {
        if (!ec2.name.trim() || !ec2.relationship.trim() || !ec2.phone.trim()) {
          setError(isTh ? "กรุณากรอกข้อมูลผู้ติดต่อฉุกเฉินคนที่ 2 ให้ครบถ้วน หรือปล่อยว่างไว้ทั้งหมด" : "Please complete all fields for Emergency Contact #2 or leave it empty.");
          setValidationTriggered(true);
          return;
        }
        if (!/^[0-9]{10}$/.test(ec2.phone.trim())) {
          setError(isTh ? "เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉินคนที่ 2 ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Emergency Contact #2 phone number must be exactly 10 digits and contain only numbers.");
          setValidationTriggered(true);
          return;
        }
      }
    }
    setValidationTriggered(false);
    setStep((s) => s + 1);
  };

  const inputCls = "input";
  const labelCls = "label";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center py-6 sm:py-12 px-4 overflow-y-auto relative"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Top Header / Language Switcher Row */}
      <div className="w-full max-w-[1000px] flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 sm:mb-12 animate-fade-in-up" style={{ zIndex: 999 }}>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs font-bold text-muted hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
          style={{ background: "none", border: "none", outline: "none", padding: 0 }}
        >
          ← {lang === "th" ? "กลับไปหน้าเข้าสู่ระบบ" : "Back to Login"}
        </button>
        <LanguageSwitcher variant="segmented" />
      </div>

      <div className="w-full max-w-[640px] flex flex-col items-center">

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

              <div className="flex flex-col sm:flex-row gap-4">
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
                  <label className={labelCls}>{t.fullName} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className={inputCls}
                    required
                    placeholder="ชื่อ-สกุล / Full Name"
                    value={formData.name}
                    onChange={(e) => set("name", e.target.value)}
                    style={{
                      borderColor: validationTriggered && !formData.name.trim() ? "#ef4444" : undefined,
                      boxShadow: validationTriggered && !formData.name.trim() ? "0 0 0 1px #ef4444" : undefined
                    }}
                  />
                  {validationTriggered && !formData.name.trim() && (
                    <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                      {t.back === "กลับ" ? "⚠️ กรุณากรอกชื่อ-นามสกุล" : "⚠️ This field is required"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="field flex-1">
                  <label className={labelCls}>{t.studentId} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className={inputCls}
                    required={session?.user && session.user.role !== "admin"}
                    minLength={(session?.user && session.user.role === "admin") ? 0 : 9}
                    maxLength={9}
                    placeholder="640510000"
                    value={formData.studentId}
                    onChange={(e) => set("studentId", e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
                    style={{
                      borderColor: validationTriggered && (session?.user && session.user.role !== "admin" && formData.studentId.trim().length !== 9) ? "#ef4444" : undefined,
                      boxShadow: validationTriggered && (session?.user && session.user.role !== "admin" && formData.studentId.trim().length !== 9) ? "0 0 0 1px #ef4444" : undefined
                    }}
                  />
                  {validationTriggered && (session?.user && session.user.role !== "admin" && formData.studentId.trim().length !== 9) && (
                    <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                      {t.back === "กลับ" ? "⚠️ รหัสนักศึกษาต้องมี 9 หลัก" : "⚠️ Student ID must be exactly 9 digits"}
                    </span>
                  )}
                </div>
                <div className="field flex-1">
                  <label className={labelCls}>{t.nickname} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className={inputCls}
                    required
                    placeholder={t.nickname}
                    value={formData.nickname}
                    onChange={(e) => set("nickname", e.target.value)}
                    style={{
                      borderColor: validationTriggered && !formData.nickname.trim() ? "#ef4444" : undefined,
                      boxShadow: validationTriggered && !formData.nickname.trim() ? "0 0 0 1px #ef4444" : undefined
                    }}
                  />
                  {validationTriggered && !formData.nickname.trim() && (
                    <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                      {t.back === "กลับ" ? "⚠️ กรุณากรอกชื่อเล่น" : "⚠️ This field is required"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="field flex-1">
                  <label className={labelCls}>{t.major}</label>
                  <select
                    className={inputCls}
                    value={formData.major}
                    onChange={(e) => set("major", e.target.value)}
                  >
                    <option value="ANI">ANI - Animation and Visual Effect</option>
                    <option value="DG">DG - Digital Game</option>
                    <option value="DII">DII - Digital Industry Integration</option>
                    <option value="MMIT">MMIT - Modern Management and Information Technology</option>
                    <option value="SE">SE - Software Engineering</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="field flex-1">
                  <label className={labelCls}>{t.religion}</label>
                  <select
                    className={inputCls}
                    value={
                      ["", "Buddhism", "Christianity", "Islam", "Hinduism", "Sikhism", "None"].includes(formData.religion)
                        ? formData.religion
                        : "Other"
                    }
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        set("religion", "Other:");
                      } else {
                        set("religion", e.target.value);
                      }
                    }}
                  >
                    <option value="">{t.selectReligion}</option>
                    <option value="Buddhism">{t.buddhism}</option>
                    <option value="Christianity">{t.christianity}</option>
                    <option value="Islam">{t.islam}</option>
                    <option value="Hinduism">{t.hinduism}</option>
                    <option value="Sikhism">{t.sikhism}</option>
                    <option value="None">{t.noReligion}</option>
                    <option value="Other">{t.other}</option>
                  </select>
                  {(!["", "Buddhism", "Christianity", "Islam", "Hinduism", "Sikhism", "None"].includes(formData.religion) || formData.religion.startsWith("Other:")) && (
                    <input
                      type="text"
                      className={inputCls}
                      style={{ marginTop: 8 }}
                      placeholder={t.back === "กลับ" ? "กรุณาระบุศาสนา..." : "Please specify religion..."}
                      value={
                        formData.religion.startsWith("Other:")
                          ? formData.religion.substring(6)
                          : formData.religion
                      }
                      onChange={(e) => set("religion", "Other:" + e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="field flex-1">
                  <label className={labelCls}>{t.phone} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className={inputCls}
                    required
                    placeholder="0812345678"
                    value={formData.phone}
                    onChange={(e) => set("phone", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    style={{
                      borderColor: validationTriggered && (!formData.phone.trim() || !/^[0-9]{10}$/.test(formData.phone.trim())) ? "#ef4444" : undefined,
                      boxShadow: validationTriggered && (!formData.phone.trim() || !/^[0-9]{10}$/.test(formData.phone.trim())) ? "0 0 0 1px #ef4444" : undefined
                    }}
                  />
                  {validationTriggered && (!formData.phone.trim() || !/^[0-9]{10}$/.test(formData.phone.trim())) && (
                    <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                      {!formData.phone.trim() 
                        ? (t.back === "กลับ" ? "⚠️ กรุณากรอกเบอร์โทรศัพท์" : "⚠️ This field is required")
                        : (t.back === "กลับ" ? "⚠️ เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก" : "⚠️ Phone number must be exactly 10 digits and numbers only")}
                    </span>
                  )}
                </div>
                <div className="field flex-1">
                  <label className={labelCls}>{t.contactChannels} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className={inputCls}
                    required
                    placeholder="IG: smocamt.official / LINE: smocamt.official"
                    value={formData.contactChannels}
                    onChange={(e) => set("contactChannels", e.target.value)}
                    style={{
                      borderColor: validationTriggered && !formData.contactChannels.trim() ? "#ef4444" : undefined,
                      boxShadow: validationTriggered && !formData.contactChannels.trim() ? "0 0 0 1px #ef4444" : undefined
                    }}
                  />
                  {validationTriggered && !formData.contactChannels.trim() && (
                    <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                      {t.back === "กลับ" ? "⚠️ กรุณากรอกช่องทางติดต่อ" : "⚠️ This field is required"}
                    </span>
                  )}
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

              <div className="flex flex-col sm:flex-row gap-4">
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

              <div className="flex flex-col sm:flex-row gap-4">
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

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="field flex-1">
                  <label className={labelCls}>{t.dietaryRestrictions}</label>
                  <select
                    className={inputCls}
                    value={
                      ["", "Vegetarian", "Vegan", "Halal", "Kosher"].includes(formData.dietaryRestrictions)
                        ? formData.dietaryRestrictions
                        : "Other"
                    }
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        set("dietaryRestrictions", "Other:");
                      } else {
                        set("dietaryRestrictions", e.target.value);
                      }
                    }}
                  >
                    <option value="">{t.none}</option>
                    <option value="Vegetarian">{t.veg}</option>
                    <option value="Vegan">{t.vegan}</option>
                    <option value="Halal">{t.halal}</option>
                    <option value="Kosher">{t.kosher}</option>
                    <option value="Other">{t.other}</option>
                  </select>
                  {(!["", "Vegetarian", "Vegan", "Halal", "Kosher"].includes(formData.dietaryRestrictions) || formData.dietaryRestrictions.startsWith("Other:")) && (
                    <input
                      type="text"
                      className={inputCls}
                      style={{ marginTop: 8 }}
                      placeholder={t.back === "กลับ" ? "กรุณาระบุข้อจำกัดอาหาร..." : "Please specify dietary restrictions..."}
                      value={
                        formData.dietaryRestrictions.startsWith("Other:")
                          ? formData.dietaryRestrictions.substring(6)
                          : formData.dietaryRestrictions
                      }
                      onChange={(e) => set("dietaryRestrictions", "Other:" + e.target.value)}
                    />
                  )}
                </div>
                <div className="field flex-1">
                  <label className={labelCls}>{t.emergencyMed}</label>
                  <input
                    className={inputCls}
                    placeholder={t.none}
                    value={formData.emergencyMedication}
                    onChange={(e) => set("emergencyMedication", e.target.value)}
                  />
                </div>
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
              {[0, 1].map((i) => {
                const contact = formData.emergencyContacts[i];
                const isFirst = i === 0;
                const isSecondPartiallyFilled = i === 1 && !!(contact.name.trim() || contact.relationship.trim() || contact.phone.trim());
                const isFieldRequired = isFirst || isSecondPartiallyFilled;

                return (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-medium)",
                      borderRadius: "var(--radius-xl)",
                      padding: 28,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                      backdropFilter: "blur(10px)",
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
                        <label className={labelCls}>
                          {t.fullName} {isFieldRequired && <span style={{ color: "#ef4444" }}>*</span>}
                        </label>
                        <input
                          className={inputCls}
                          required={isFieldRequired}
                          placeholder={t.fullName}
                          value={contact.name}
                          onChange={(e) => setEC(i, "name", e.target.value)}
                          style={{
                            borderColor: validationTriggered && isFieldRequired && !contact.name.trim() ? "#ef4444" : undefined,
                            boxShadow: validationTriggered && isFieldRequired && !contact.name.trim() ? "0 0 0 1px #ef4444" : undefined
                          }}
                        />
                        {validationTriggered && isFieldRequired && !contact.name.trim() && (
                          <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                            {t.back === "กลับ" ? "⚠️ กรุณากรอกชื่อ-นามสกุล" : "⚠️ This field is required"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="field flex-1">
                          <label className={labelCls}>
                            {t.relationship} {isFieldRequired && <span style={{ color: "#ef4444" }}>*</span>}
                          </label>
                          <input
                            className={inputCls}
                            required={isFieldRequired}
                            placeholder={t.relationship}
                            value={contact.relationship}
                            onChange={(e) => setEC(i, "relationship", e.target.value)}
                            style={{
                              borderColor: validationTriggered && isFieldRequired && !contact.relationship.trim() ? "#ef4444" : undefined,
                              boxShadow: validationTriggered && isFieldRequired && !contact.relationship.trim() ? "0 0 0 1px #ef4444" : undefined
                            }}
                          />
                          {validationTriggered && isFieldRequired && !contact.relationship.trim() && (
                            <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                              {t.back === "กลับ" ? "⚠️ กรุณากรอกความสัมพันธ์" : "⚠️ This field is required"}
                            </span>
                          )}
                        </div>
                        <div className="field flex-1">
                          <label className={labelCls}>
                            {t.phone} {isFieldRequired && <span style={{ color: "#ef4444" }}>*</span>}
                          </label>
                          <input
                            className={inputCls}
                            required={isFieldRequired}
                            placeholder="0812345678"
                            value={contact.phone}
                            onChange={(e) => setEC(i, "phone", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                            style={{
                              borderColor: validationTriggered && isFieldRequired && (!contact.phone.trim() || !/^[0-9]{10}$/.test(contact.phone.trim())) ? "#ef4444" : undefined,
                              boxShadow: validationTriggered && isFieldRequired && (!contact.phone.trim() || !/^[0-9]{10}$/.test(contact.phone.trim())) ? "0 0 0 1px #ef4444" : undefined
                            }}
                          />
                          {validationTriggered && isFieldRequired && (!contact.phone.trim() || !/^[0-9]{10}$/.test(contact.phone.trim())) && (
                            <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 500, marginTop: 4, display: "block" }}>
                              {!contact.phone.trim()
                                ? (t.back === "กลับ" ? "⚠️ กรุณากรอกเบอร์โทรศัพท์" : "⚠️ This field is required")
                                : (t.back === "กลับ" ? "⚠️ เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก" : "⚠️ Phone number must be exactly 10 digits and numbers only")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-x-4">
                  {[
                    [t.fullName, `${formData.prefix}${formData.name}`],
                    [t.nickname, formData.nickname],
                    [t.studentId, formData.studentId],
                    [t.major, formData.major],
                    [t.phone, formData.phone],
                    [t.religion, (() => {
                      if (!formData.religion) return "—";
                      if (formData.religion === "Buddhism") return t.buddhism;
                      if (formData.religion === "Christianity") return t.christianity;
                      if (formData.religion === "Islam") return t.islam;
                      if (formData.religion === "Hinduism") return t.hinduism;
                      if (formData.religion === "Sikhism") return t.sikhism;
                      if (formData.religion === "None") return t.noReligion;
                      if (formData.religion.startsWith("Other:")) return formData.religion.substring(6);
                      return formData.religion;
                    })()],
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
                  <div className="alert alert-warning" style={{ fontSize: 12, padding: "10px 14px", borderRadius: 10, marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, marginTop: -2 }}>⚠️</span>
                    <span style={{ lineHeight: 1.5, color: "var(--text-primary)" }}>{t.pdpaWarning}</span>
                  </div>
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
            className="flex flex-col sm:flex-row gap-3"
            style={{ marginTop: 32, justifyContent: step === 0 ? "flex-end" : "space-between" }}
          >
            {step > 0 && (
              <button
                className="btn btn-ghost"
                onClick={() => { setStep((s) => s - 1); setValidationTriggered(false); }}
                disabled={submitting}
              >
                ← {t.back}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={handleContinue}>
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