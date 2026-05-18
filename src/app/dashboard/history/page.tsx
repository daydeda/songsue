"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Calendar, History, Trophy, ArrowRight, X, Star, CheckCircle2 } from "lucide-react";
import { StudentNav } from "@/components/layout/StudentNav";
import Link from "next/link";

export default function HistoryPage() {
  const { t } = useLanguage();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for student submission
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [activeForm, setActiveForm] = useState<any | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  
  // Custom premium validation/alert states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    fetch("/api/profile/history")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHistory(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const openStudentForm = async (eventId: string, eventTitle: string) => {
    setShowStudentForm(true);
    setFormLoading(true);
    setAnswers({});
    setFormErrors({});
    setGeneralError(null);
    setGeneralSuccess(null);
    
    try {
      const res = await fetch(`/api/events/${eventId}/form`);
      const data = await res.json();
      
      if (data.form) {
        setActiveForm({ ...data.form, eventId });
        const initialAnswers: Record<string, any> = {};
        data.form.questions.forEach((q: any) => {
          initialAnswers[q.id] = q.type === "rating" ? 5 : "";
        });
        setAnswers(initialAnswers);
      } else {
        setGeneralError(t.evaluationNotFound);
      }
    } catch (e) {
      console.error(e);
      setGeneralError(t.failedToLoadEvaluation);
    } finally {
      setFormLoading(false);
    }
  };

  const submitAnswers = async () => {
    if (!activeForm) return;
    
    setFormErrors({});
    setGeneralError(null);

    const newErrors: Record<string, string> = {};
    for (const q of activeForm.questions) {
      if (q.required && (!answers[q.id] || answers[q.id].toString().trim() === "")) {
        newErrors[q.id] = t.fieldRequired;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      setGeneralError(t.completeRequiredFields);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${activeForm.eventId}/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      
      if (res.ok) {
        setGeneralSuccess("Submitted");
        fetchHistory();
      } else {
        setGeneralError(t.failedToSubmitFeedback + ": " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      setGeneralError(t.failedToSubmitFeedback);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <StudentNav />

      <main className="page-container" style={{ marginTop: 48, paddingBottom: 100 }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 12 }}>
            {t.eventHistory}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 18, fontWeight: 500 }}>
            {history.length} events completed in your journey.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {history.map((h) => (
              <div key={h.id} className="glass animate-fade-in-up" style={{ 
                padding: "28px", 
                display: "flex", 
                flexDirection: "column", 
                gap: 20, 
                borderRadius: 32,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-surface)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.03)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 70, height: 70, borderRadius: 18, overflow: "hidden", background: "var(--bg-elevated)", flexShrink: 0 }}>
                    {h.eventImageUrl ? (
                      <img src={h.eventImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Calendar size={28} color="var(--text-muted)" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: 17, color: "var(--text-primary)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>{h.eventTitle}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Completed on {new Date(h.checkInTime).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 6, 
                    padding: "6px 14px", 
                    background: "rgba(255,107,0,0.08)", 
                    borderRadius: 14, 
                    color: "var(--accent-primary)", 
                    fontSize: 12, 
                    fontWeight: 800 
                  }}>
                    <History size={13} />
                    {h.eventQuota 
                      ? t.joinedAsRank.replace("{rank}", h.rank.toString()).replace("{total}", h.eventQuota.toString())
                      : t.joinedAsRankNoLimit.replace("{rank}", h.rank.toString())}
                  </div>
                </div>

                {/* Evaluation Form Actions */}
                {h.formStatus !== "none" && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16, marginTop: 4 }}>
                    {h.formStatus === "available" && (
                      <button
                        className="btn"
                        style={{
                          width: "100%",
                          height: 42,
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 900,
                          background: "linear-gradient(135deg, var(--accent-primary) 0%, #ff3d00 100%)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          boxShadow: "0 4px 12px rgba(255,107,0,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6
                        }}
                        onClick={() => openStudentForm(h.eventId, h.eventTitle)}
                      >
                        <Trophy size={14} fill="currentColor" /> Feed House (+{h.formPoints} PTS)
                      </button>
                    )}
                    {h.formStatus === "submitted" && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                        height: 42,
                        borderRadius: 12,
                        background: "rgba(16,185,129,0.08)",
                        color: "#10b981",
                        fontSize: 13,
                        fontWeight: 800
                      }}>
                        <CheckCircle2 size={14} /> Completed & points feeding
                      </div>
                    )}
                    {h.formStatus === "closed" && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                        height: 42,
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.03)",
                        color: "var(--text-muted)",
                        fontSize: 13,
                        fontWeight: 700
                      }}>
                        🔒 Feedback Period Ended
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "100px 40px", textAlign: "center", background: "var(--bg-surface)", borderRadius: 40, border: "2px dashed var(--border-subtle)" }}>
             <History size={48} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 20px auto", opacity: 0.3 }} />
             <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>No history yet</h3>
             <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Join your first event to start your activity journey!</p>
             <Link href="/dashboard" className="btn btn-primary">Browse Events</Link>
          </div>
        )}

        {/* Student Form Modal */}
        {showStudentForm && (
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
          }} onClick={() => setShowStudentForm(false)}>
            <div className="animate-fade-in-up custom-scrollbar" style={{
              background: "var(--bg-surface)",
              width: "100%",
              maxWidth: 600,
              maxHeight: "85vh",
              borderRadius: 32,
              overflowY: "auto",
              boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
              border: "1px solid var(--border-medium)"
            }} onClick={e => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div style={{ padding: "28px 40px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.housePointFeeding}</span>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{activeForm?.title || t.evaluation}</h3>
                </div>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setShowStudentForm(false)} 
                  style={{ borderRadius: "50%", width: 40, height: 40, padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              {formLoading ? (
                <div style={{ padding: "80px 0", textAlign: "center" }}>
                  <div className="spinner w-8 h-8 border-4 border-t-transparent" style={{ margin: "0 auto 16px" }} />
                  <p style={{ color: "var(--text-muted)", fontWeight: 700 }}>{t.loadingFormsEngine}</p>
                </div>
              ) : generalSuccess ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  {/* Success State */}
                  <div className="animate-scale-in" style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: "rgba(16,185,129,0.1)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "20px auto 24px",
                    boxShadow: "0 10px 30px rgba(16,185,129,0.15)"
                  }}>
                    <CheckCircle2 size={36} />
                  </div>
                  <h4 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", marginBottom: 12 }}>{t.feedbackSubmitted}</h4>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 420, margin: "0 auto 32px", lineHeight: 1.6 }}>
                    {t.feedbackSuccessDetail}
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{
                      height: 46,
                      borderRadius: 12,
                      padding: "0 32px",
                      background: "linear-gradient(135deg, var(--accent-primary) 0%, #ff3d00 100%)",
                      color: "#fff",
                      border: "none",
                      boxShadow: "0 4px 14px rgba(255,107,0,0.3)"
                    }}
                    onClick={() => {
                      setShowStudentForm(false);
                      setGeneralSuccess(null);
                    }}
                  >
                    {t.closeWindow}
                  </button>
                </div>
              ) : (
                <div style={{ padding: 40 }}>
                  {generalError && (
                    <div className="animate-fade-in" style={{
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: 16,
                      padding: "16px 20px",
                      marginBottom: 28,
                      color: "#ef4444",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}>
                      <span style={{ fontSize: 16 }}>⚠️</span> {generalError}
                    </div>
                  )}

                  {activeForm?.description && (
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 28, background: "var(--bg-elevated)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                      {activeForm.description}
                    </p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {activeForm?.questions.map((q: any) => (
                      <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                          {q.label === "Overall Satisfaction" ? t.overallSatisfaction : q.label} {q.required && <span style={{ color: "#ef4444" }}>*</span>}
                        </label>
                        
                        {q.type === "rating" ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
                            {Array.from({ length: 5 }).map((_, starIdx) => {
                              const ratingValue = starIdx + 1;
                              const isSelected = ratingValue <= (answers[q.id] || 0);
                              return (
                                <button
                                  key={starIdx}
                                  type="button"
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    padding: 0,
                                    color: isSelected ? "#ffb000" : "var(--border-medium)",
                                    transition: "all 0.1s"
                                  }}
                                  onClick={() => {
                                    setAnswers({ ...answers, [q.id]: ratingValue });
                                    if (formErrors[q.id]) {
                                      const updated = { ...formErrors };
                                      delete updated[q.id];
                                      setFormErrors(updated);
                                    }
                                  }}
                                >
                                  <Star size={32} fill={isSelected ? "#ffb000" : "none"} />
                                </button>
                              );
                            })}
                            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", marginLeft: 12 }}>
                              {answers[q.id] || 0} / 5
                            </span>
                          </div>
                        ) : (
                          <textarea
                            className="input custom-scrollbar"
                            style={{ 
                              width: "100%", 
                              minHeight: 100, 
                              borderRadius: 14, 
                              padding: "12px 16px", 
                              resize: "vertical",
                              borderColor: formErrors[q.id] ? "#ef4444" : "var(--border-medium)"
                            }}
                            value={answers[q.id] || ""}
                            onChange={e => {
                              setAnswers({ ...answers, [q.id]: e.target.value });
                              if (formErrors[q.id]) {
                                const updated = { ...formErrors };
                                delete updated[q.id];
                                setFormErrors(updated);
                              }
                            }}
                            placeholder={t.yourAnswerHere}
                          />
                        )}

                        {formErrors[q.id] && (
                          <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                            ⚠️ {formErrors[q.id]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, borderTop: "1px solid var(--border-subtle)", paddingTop: 28, marginTop: 32 }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      style={{ height: 46, borderRadius: 12, padding: "0 24px" }}
                      onClick={() => setShowStudentForm(false)}
                    >
                      {t.cancel}
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      style={{
                        height: 46,
                        borderRadius: 12,
                        padding: "0 24px",
                        background: "linear-gradient(135deg, var(--accent-primary) 0%, #ff3d00 100%)",
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 4px 14px rgba(255,107,0,0.3)"
                      }}
                      disabled={submitting}
                      onClick={submitAnswers}
                    >
                      {submitting ? <div className="spinner w-4 h-4 border-2" /> : t.submitFeedback}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global CSS for page animations */}
        <style jsx global>{`
          .glass:hover {
            transform: translateY(-4px);
            border-color: var(--accent-primary) !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.06) !important;
          }
        `}</style>
      </main>
    </div>
  );
}
