
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Save, User, Smartphone, BookOpen,
  HeartPulse, ShieldAlert, Phone, Camera, Loader2,
  Maximize, Move
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

type EmergencyContact = { name: string; relationship: string; phone: string };

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { t } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationTriggered, setValidationTriggered] = useState(false);

  const [formData, setFormData] = useState({
    studentId: "",
    prefix: "นาย",
    name: "",
    nickname: "",
    phone: "",
    major: "",
    religion: "",
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
    emergencyContacts: [
      { name: "", relationship: "", phone: "" },
      { name: "", relationship: "", phone: "" },
    ] as EmergencyContact[],
  });

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(user => {
        if (user) {
          setFormData({
            studentId: user.studentId || "",
            prefix: user.prefix || "นาย",
            name: user.name || "",
            nickname: user.nickname || "",
            phone: user.phone || "",
            major: user.major || "",
            religion: user.religion || "",
            contactChannels: user.contactChannels || "",
            image: user.image || "",
            imageTransform: user.imageTransform || { scale: 1, x: 0, y: 0 },
            chronicDiseases: user.chronicDiseases || "",
            medicalHistory: user.medicalHistory || "",
            drugAllergies: user.drugAllergies || "",
            foodAllergies: user.foodAllergies || "",
            dietaryRestrictions: user.dietaryRestrictions || "",
            faintingHistory: !!user.faintingHistory,
            emergencyMedication: user.emergencyMedication || "",
            emergencyContacts: user.emergencyContacts || [
              { name: "", relationship: "", phone: "" },
              { name: "", relationship: "", phone: "" },
            ],
          });
          if (user.image) setPreviewUrl(user.image);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const set = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => setFormData((p) => ({ ...p, [key]: value }));

  const setEC = (idx: number, key: string, value: string) => {
    const contacts = [...formData.emergencyContacts] as EmergencyContact[];
    contacts[idx] = { ...contacts[idx], [key]: value };
    set("emergencyContacts", contacts);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(t.fileTooLarge);
      return;
    }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const isTh = t.back === "กลับ";
    if (!formData.name.trim() || !formData.nickname.trim() || !formData.phone.trim() || !formData.contactChannels.trim()) {
      setError(isTh ? "กรุณากรอกข้อมูลส่วนตัวที่จำเป็นให้ครบถ้วน" : "Please fill out all required personal information fields.");
      setSaving(false);
      setValidationTriggered(true);
      return;
    }

    if (!/^[0-9]{10}$/.test(formData.phone.trim())) {
      setError(isTh ? "เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Phone number must be exactly 10 digits and contain only numbers.");
      setSaving(false);
      setValidationTriggered(true);
      return;
    }

    const ec1 = formData.emergencyContacts[0];
    if (!ec1 || !ec1.name.trim() || !ec1.relationship.trim() || !ec1.phone.trim()) {
      setError(isTh ? "กรุณากรอกข้อมูลผู้ติดต่อฉุกเฉินคนที่ 1 ให้ครบถ้วน" : "Please fill out all fields for Emergency Contact #1.");
      setSaving(false);
      setValidationTriggered(true);
      return;
    }
    if (!/^[0-9]{10}$/.test(ec1.phone.trim())) {
      setError(isTh ? "เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉินคนที่ 1 ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Emergency Contact #1 phone number must be exactly 10 digits and contain only numbers.");
      setSaving(false);
      setValidationTriggered(true);
      return;
    }

    const ec2 = formData.emergencyContacts[1];
    if (ec2 && (ec2.name.trim() || ec2.relationship.trim() || ec2.phone.trim())) {
      if (!ec2.name.trim() || !ec2.relationship.trim() || !ec2.phone.trim()) {
        setError(isTh ? "กรุณากรอกข้อมูลผู้ติดต่อฉุกเฉินคนที่ 2 ให้ครบถ้วน หรือปล่อยว่างไว้ทั้งหมด" : "Please complete all fields for Emergency Contact #2 or leave it empty.");
        setSaving(false);
        setValidationTriggered(true);
        return;
      }
      if (!/^[0-9]{10}$/.test(ec2.phone.trim())) {
        setError(isTh ? "เบอร์โทรศัพท์ผู้ติดต่อฉุกเฉินคนที่ 2 ต้องเป็นตัวเลข 10 หลักเท่านั้น" : "Emergency Contact #2 phone number must be exactly 10 digits and contain only numbers.");
        setSaving(false);
        setValidationTriggered(true);
        return;
      }
    }
    setValidationTriggered(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setSuccess(true);
        await update(); // Refresh session
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update profile");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  const labelCls = "label";

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/dashboard" className="btn btn-ghost" style={{ width: 48, height: 48, padding: 0, borderRadius: "50%" }}>
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 900, letterSpacing: "-0.04em" }}>{t.profileSummary}</h1>
              <p style={{ color: "var(--text-muted)", fontWeight: 500 }}>Update your profile information and safety settings.</p>
            </div>
          </div>
          <LanguageSwitcher variant="segmented" />
        </div>

        <form onSubmit={handleSubmit} className="animate-fade-in-up">
          <div style={{ display: "grid", gap: 32 }}>

            {/* Section: Profile Photo & Adjustments */}
            <div style={{ background: "var(--bg-surface)", padding: 32, borderRadius: 32, border: "1px solid var(--border-medium)", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: "50%",
                    backgroundColor: "var(--bg-elevated)",
                    border: "4px solid white",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
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
                      alt="Profile"
                      style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: `scale(${formData.imageTransform.scale}) translate(${formData.imageTransform.x}%, ${formData.imageTransform.y}%)`,
                        transition: "transform 0.1s ease-out"
                      }}
                    />
                  ) : (
                    <User size={70} className="text-muted opacity-30" />
                  )}
                </div>
                <label
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    width: 44,
                    height: 44,
                    background: "var(--accent-primary)",
                    color: "#fff",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px var(--accent-glow)",
                    border: "3px solid white"
                  }}
                >
                  <Camera size={20} />
                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>

              {previewUrl && (
                <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 16, padding: "16px 24px", background: "var(--bg-elevated)", borderRadius: 24, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <Maximize size={12} /> Zoom
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-primary)" }}>{Math.round(formData.imageTransform.scale * 100)}%</span>
                    </div>
                    <input
                      type="range" min="1" max="3" step="0.05"
                      value={formData.imageTransform.scale}
                      onChange={(e) => set("imageTransform", { ...formData.imageTransform, scale: parseFloat(e.target.value) })}
                      style={{ accentColor: "var(--accent-primary)" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <Move size={12} /> Horizontal
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-(formData.imageTransform.scale - 1) * 50}
                      max={(formData.imageTransform.scale - 1) * 50}
                      step="1"
                      value={formData.imageTransform.x}
                      onChange={(e) => set("imageTransform", { ...formData.imageTransform, x: parseInt(e.target.value) })}
                      style={{ accentColor: "var(--accent-primary)" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                        <Move size={12} style={{ transform: "rotate(90deg)" }} /> Vertical
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-(formData.imageTransform.scale - 1) * 50}
                      max={(formData.imageTransform.scale - 1) * 50}
                      step="1"
                      value={formData.imageTransform.y}
                      onChange={(e) => set("imageTransform", { ...formData.imageTransform, y: parseInt(e.target.value) })}
                      style={{ accentColor: "var(--accent-primary)" }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, marginTop: 4 }}
                    onClick={() => set("imageTransform", { scale: 1, x: 0, y: 0 })}
                  >
                    Reset Framing
                  </button>
                </div>
              )}
            </div>

            {/* Section: Basic Info */}
            <div style={{ background: "var(--bg-surface)", padding: 32, borderRadius: 32, border: "1px solid var(--border-medium)", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <User size={20} style={{ color: "var(--accent-primary)" }} />
                {t.personalInfo}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div className={labelCls} style={{ gridColumn: "span 2" }}>
                  <label className="label">{t.studentId} (Locked)</label>
                  <input className="input" disabled value={formData.studentId} style={{ background: "var(--bg-elevated)", cursor: "not-allowed", opacity: 0.7 }} />
                </div>
                <div className="field">
                  <label className="label">{t.prefix}</label>
                  <select className="input" value={formData.prefix} onChange={(e) => set("prefix", e.target.value)}>
                    <option value="นาย">นาย (Mr.)</option>
                    <option value="นางสาว">นางสาว (Ms.)</option>
                    <option value="นาง">นาง (Mrs.)</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t.fullName} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className="input"
                    name="name"
                    required
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
                <div className="field">
                  <label className="label">{t.nickname} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className="input"
                    name="nickname"
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
                <div className="field">
                  <label className="label">{t.major}</label>
                  <select className="input" value={formData.major} onChange={(e) => set("major", e.target.value)}>
                    <option value="ANI">ANI - Animation and Visual Effect</option>
                    <option value="DG">DG - Digital Game</option>
                    <option value="DII">DII - Digital Industry Integration</option>
                    <option value="MMIT">MMIT - Modern Management and Information Technology</option>
                    <option value="SE">SE - Software Engineering</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t.phone} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className="input"
                    name="phone"
                    required
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
                <div className="field">
                  <label className="label">{t.contactChannels} <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    className="input"
                    name="contactChannels"
                    required
                    value={formData.contactChannels}
                    onChange={(e) => set("contactChannels", e.target.value)}
                    placeholder="IG: smocamt.official / LINE: smocamt.official"
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
                <div className="field" style={{ gridColumn: "span 2" }}>
                  <label className="label">{t.religion}</label>
                  <select
                    className="input"
                    name="religion"
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
                      className="input"
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
            </div>

            {/* Section: Parent / Emergency Info */}
            <div style={{ background: "var(--bg-surface)", padding: 32, borderRadius: 32, border: "1px solid var(--border-medium)", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldAlert size={20} style={{ color: "var(--accent-secondary)" }} />
                {t.emergencyContacts}
              </h2>
              <div style={{ display: "grid", gap: 24 }}>
                {formData.emergencyContacts.map((contact, i) => {
                  const isFirst = i === 0;
                  const isSecondPartiallyFilled = i === 1 && !!(contact.name.trim() || contact.relationship.trim() || contact.phone.trim());
                  const isFieldRequired = isFirst || isSecondPartiallyFilled;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: 24,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: 24,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                        backdropFilter: "blur(10px)"
                      }}
                      className="mb-4"
                    >
                      <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>Contact #{i + 1}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div className="field">
                          <label className="label">{t.fullName} {isFieldRequired && <span style={{ color: "#ef4444" }}>*</span>}</label>
                          <input
                            className="input"
                            required={isFieldRequired}
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
                        <div className="field">
                          <label className="label">{t.relationship} {isFieldRequired && <span style={{ color: "#ef4444" }}>*</span>}</label>
                          <input
                            className="input"
                            required={isFieldRequired}
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
                        <div className="field" style={{ gridColumn: "span 2" }}>
                          <label className="label">{t.phone} {isFieldRequired && <span style={{ color: "#ef4444" }}>*</span>}</label>
                          <input
                            className="input"
                            required={isFieldRequired}
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
                  );
                })}
              </div>
            </div>

            {/* Section: Health & Safety */}
            <div style={{ background: "var(--bg-surface)", padding: 32, borderRadius: 32, border: "1px solid var(--border-medium)", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                <HeartPulse size={20} style={{ color: "#ef4444" }} />
                {t.medicalInfo}
              </h2>
              <div style={{ display: "grid", gap: 20 }}>
                <div className="field">
                  <label className="label">{t.medicalHistory} / {t.chronicDiseases}</label>
                  <textarea className="input" rows={2} value={formData.medicalHistory} onChange={(e) => set("medicalHistory", e.target.value)} style={{ resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="field">
                    <label className="label">{t.drugAllergies}</label>
                    <input className="input" value={formData.drugAllergies} onChange={(e) => set("drugAllergies", e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="label">{t.foodAllergies}</label>
                    <input className="input" value={formData.foodAllergies} onChange={(e) => set("foodAllergies", e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="field">
                    <label className="label">{t.dietaryRestrictions}</label>
                    <select
                      className="input"
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
                        className="input"
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
                  <div className="field">
                    <label className="label">{t.emergencyMed}</label>
                    <input
                      className="input"
                      value={formData.emergencyMedication}
                      onChange={(e) => set("emergencyMedication", e.target.value)}
                    />
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={formData.faintingHistory} onChange={(e) => set("faintingHistory", e.target.checked)} />
                  <span style={{ fontSize: 14 }}>{t.faintingHistory}</span>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingBottom: 60 }}>
              {error && <p style={{ color: "var(--accent-primary)", fontWeight: 600 }}>⚠️ {error}</p>}
              {success && <p style={{ color: "#10b981", fontWeight: 600 }}>✓ {t.complete}</p>}
              {!error && !success && <div />}

              <button type="submit" disabled={saving || uploading} className="btn btn-primary btn-lg" style={{ minWidth: 200, borderRadius: 99, boxShadow: "0 10px 20px var(--accent-glow)" }}>
                {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {t.continue}</>}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
