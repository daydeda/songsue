"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type EmergencyContact = { name: string; relationship: string; phone: string };

const STEPS = ["Personal Info", "Medical Info", "Emergency Contacts", "Review & Submit"];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    studentId: "",
    prefix: "นาย",
    name: "",
    nickname: "",
    major: "SE",
    religion: "",
    phone: "",
    contactChannels: "",
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

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const set = (key: string, value: any) => setFormData((p) => ({ ...p, [key]: value }));
  const setEC = (idx: number, key: string, value: string) => {
    const contacts = [...formData.emergencyContacts] as EmergencyContact[];
    contacts[idx] = { ...contacts[idx], [key]: value };
    set("emergencyContacts", contacts);
  };

  const handleSubmit = async () => {
    if (!formData.pdpaConsent) {
      setError("คุณต้องยินยอมให้เก็บข้อมูลตาม PDPA ก่อน");
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
        router.push("/dashboard");
        router.refresh();
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
      className="min-h-screen flex flex-col items-center justify-center py-12 px-4"
      style={{ background: "var(--bg-base)" }}
    >
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
          Step {step + 1} of {STEPS.length}
        </div>
        <h1
          className="gradient-text"
          style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em" }}
        >
          {STEPS[step]}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>
          Complete your profile to join a house and access events.
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
            <div className="flex gap-4">
              <div className="field" style={{ width: 140 }}>
                <label className={labelCls}>Prefix</label>
                <select
                  className={inputCls}
                  value={formData.prefix}
                  onChange={(e) => set("prefix", e.target.value)}
                >
                  <option value="นาย">นาย</option>
                  <option value="นางสาว">นางสาว</option>
                  <option value="นาง">นาง</option>
                </select>
              </div>
              <div className="field flex-1">
                <label className={labelCls}>Full Name (Thai)</label>
                <input
                  className={inputCls}
                  required
                  placeholder="ชื่อ-สกุล"
                  value={formData.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>Student ID (9 digits)</label>
                <input
                  className={inputCls}
                  required
                  minLength={9}
                  maxLength={9}
                  placeholder="640510000"
                  value={formData.studentId}
                  onChange={(e) => set("studentId", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>Nickname</label>
                <input
                  className={inputCls}
                  required
                  placeholder="Nickname"
                  value={formData.nickname}
                  onChange={(e) => set("nickname", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>Major</label>
                <select
                  className={inputCls}
                  value={formData.major}
                  onChange={(e) => set("major", e.target.value)}
                >
                  <option value="ANI">ANI — Animation</option>
                  <option value="DG">DG — Digital Game</option>
                  <option value="DII">DII — Digital Innovation &amp; Industry</option>
                  <option value="MMIT">MMIT — Multimedia &amp; IT</option>
                  <option value="SE">SE — Software Engineering</option>
                </select>
              </div>
              <div className="field flex-1">
                <label className={labelCls}>Religion</label>
                <input
                  className={inputCls}
                  placeholder="พุทธ / คริสต์ / อิสลาม / ..."
                  value={formData.religion}
                  onChange={(e) => set("religion", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>Phone Number</label>
                <input
                  className={inputCls}
                  required
                  placeholder="0812345678"
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>Contact Channels (Line / FB)</label>
                <input
                  className={inputCls}
                  placeholder="Line ID or Facebook"
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
              <span>Medical information is encrypted and only accessible to admins with explicit access logged in the Audit Trail.</span>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>Chronic Diseases</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Asthma, Diabetes (or none)"
                  value={formData.chronicDiseases}
                  onChange={(e) => set("chronicDiseases", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>Medical History (Surgery / Accidents)</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Appendectomy 2022 (or none)"
                  value={formData.medicalHistory}
                  onChange={(e) => set("medicalHistory", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="field flex-1">
                <label className={labelCls}>Drug Allergies</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Penicillin (or none)"
                  value={formData.drugAllergies}
                  onChange={(e) => set("drugAllergies", e.target.value)}
                />
              </div>
              <div className="field flex-1">
                <label className={labelCls}>Food Allergies</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Shellfish (or none)"
                  value={formData.foodAllergies}
                  onChange={(e) => set("foodAllergies", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className={labelCls}>Dietary Restrictions</label>
              <select
                className={inputCls}
                value={formData.dietaryRestrictions}
                onChange={(e) => set("dietaryRestrictions", e.target.value)}
              >
                <option value="">None</option>
                <option value="Vegetarian">Vegetarian</option>
                <option value="Vegan">Vegan</option>
                <option value="Halal">Halal</option>
                <option value="Kosher">Kosher</option>
                <option value="Other">Other</option>
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
                I have a{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  history of fainting
                </span>
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
                  Contact #{i + 1}
                </p>
                <div className="flex flex-col gap-4">
                  <div className="field">
                    <label className={labelCls}>Full Name</label>
                    <input
                      className={inputCls}
                      required
                      placeholder="ชื่อ-สกุล"
                      value={formData.emergencyContacts[i].name}
                      onChange={(e) => setEC(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="field flex-1">
                      <label className={labelCls}>Relationship</label>
                      <input
                        className={inputCls}
                        required
                        placeholder="e.g. Mother / Father"
                        value={formData.emergencyContacts[i].relationship}
                        onChange={(e) => setEC(i, "relationship", e.target.value)}
                      />
                    </div>
                    <div className="field flex-1">
                      <label className={labelCls}>Phone Number</label>
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
                Profile Summary
              </p>
              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                {[
                  ["Name", `${formData.prefix}${formData.name}`],
                  ["Nickname", formData.nickname],
                  ["Student ID", formData.studentId],
                  ["Major", formData.major],
                  ["Phone", formData.phone],
                  ["Religion", formData.religion || "—"],
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
                  PDPA Data Consent
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  ฉันยินยอมให้ CAMT เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล รวมถึงข้อมูลสุขภาพและข้อมูลผู้ติดต่อฉุกเฉิน เพื่อวัตถุประสงค์ในการจัดกิจกรรมนักศึกษา ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
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
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Continue →
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
                "Complete Profile & Get Sorted 🏠"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}