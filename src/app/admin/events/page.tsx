"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Plus, Edit2, Trash2, Calendar, MapPin, Clock, 
  ArrowRight, User, Users, CheckCircle2, Search, 
  Sparkles, Filter, MoreVertical, X, ExternalLink,
  ChevronRight, AlertCircle, BarChart3, Image as ImageIcon, Zap,
  Activity, Phone, HeartPulse, Info
} from "lucide-react";
import { parseRichText } from "@/lib/rich-text";

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  startTime: "",
  endTime: "",
  quota: 0,
  pointsAwarded: 0,
  imageUrl: "",
  walkInsEnabled: false
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "live" | "upcoming" | "past">("all");
  
  // Attendance tracking
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const hasActualMedicalInfo = (user: any) => {
    if (!user) return false;
    const fields = [
      user.chronicDiseases,
      user.medicalHistory,
      user.drugAllergies,
      user.foodAllergies,
      user.dietaryRestrictions
    ];
    const isMeaningful = (val: any) => {
      if (typeof val !== 'string') return !!val;
      const t = val.trim();
      return t !== "" && t !== "-";
    };
    return fields.some(isMeaningful) || user.faintingHistory === true;
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string, val: any) => setFormData({ ...formData, [key]: val });

  const lastInjectedRange = useRef<{ start: number, end: number } | null>(null);

  const injectMarkup = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    const text = el.value;
    const selected = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    if (prefix.startsWith("{{color:") && lastInjectedRange.current) {
       const { start: lStart, end: lEnd } = lastInjectedRange.current;
       const lastText = text.substring(lStart, lEnd);
       if (lastText.startsWith("{{color:") && lastText.endsWith("}}")) {
          const parts = lastText.split("|");
          if (parts.length >= 2) {
             const contentOnly = parts.slice(1).join("|").slice(0, -2);
             const b = text.substring(0, lStart);
             const a = text.substring(lEnd);
             const newTag = prefix + contentOnly + suffix;
             set("description", b + newTag + a);
             lastInjectedRange.current = { start: lStart, end: lStart + newTag.length };
             setTimeout(() => {
                el.focus();
                el.setSelectionRange(lStart, lStart + newTag.length);
             }, 10);
             return;
          }
       }
    }

    if (prefix.startsWith("{{color:")) {
       const lastTagStart = before.lastIndexOf("{{color:");
       const lastTagEnd = before.lastIndexOf("}}");
       const nextTagEnd = after.indexOf("}}");
       const nextTagStart = after.indexOf("{{color:");

       let isInside = (lastTagStart > -1 && (lastTagEnd === -1 || lastTagEnd < lastTagStart));
       let actualTagStart = lastTagStart;
       let actualTagEnd = end + nextTagEnd + 2;

       if (isInside && nextTagEnd > -1 && (nextTagStart === -1 || nextTagStart > nextTagEnd)) {
             const tagFullText = text.substring(actualTagStart, actualTagEnd);
             const parts = tagFullText.split("|");
             if (parts.length >= 2) {
                const contentOnly = parts.slice(1).join("|").slice(0, -2);
                const b = text.substring(0, actualTagStart);
                const a = text.substring(actualTagEnd);
                const newTag = prefix + contentOnly + suffix;
                set("description", b + newTag + a);
                lastInjectedRange.current = { start: actualTagStart, end: actualTagStart + newTag.length };
                setTimeout(() => {
                  el.focus();
                  el.setSelectionRange(actualTagStart, actualTagStart + newTag.length);
                }, 10);
                return;
             }
       }
    }

    let processedSelected = selected;
    if (prefix.startsWith("{{color:")) {
       processedSelected = selected.replace(/\{\{color:.*?\|/g, "").replace(/\}\}/g, "");
    }

    if (prefix !== "" && prefix.startsWith("{{color:") === false && selected.startsWith(prefix) && selected.endsWith(suffix)) {
      const unwrapped = selected.substring(prefix.length, selected.length - suffix.length);
      set("description", before + unwrapped + after);
      lastInjectedRange.current = null;
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, start + unwrapped.length);
      }, 10);
      return;
    }

    if (prefix === "**" && before.endsWith("**") && after.startsWith("**")) {
      set("description", before.slice(0, -2) + selected + after.slice(2));
      lastInjectedRange.current = null;
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start - 2, end - 2);
      }, 10);
      return;
    }
    
    const content = processedSelected || (prefix === "**" ? "bold text" : "text");
    const newText = before + prefix + content + suffix + after;
    set("description", newText);
    
    const finalStart = start;
    const finalEnd = start + prefix.length + content.length + suffix.length;
    lastInjectedRange.current = { start: finalStart, end: finalEnd };

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(finalStart, finalEnd);
    }, 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events";
      const method = editingId ? "PUT" : "POST";
      const bodyData = editingId ? formData : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bodyData,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData(EMPTY_FORM);
        setEditingId(null);
        fetchEvents();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save event");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will also delete all attendance records for this event.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      if (res.ok) fetchEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (evt: any) => {
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    setFormData({
      title: evt.title,
      description: evt.description || "",
      location: evt.location || "",
      startTime: toLocal(evt.startTime),
      endTime: toLocal(evt.endTime),
      quota: evt.quota || 0,
      pointsAwarded: evt.pointsAwarded || 0,
      imageUrl: evt.imageUrl || "",
      walkInsEnabled: evt.walkInsEnabled || false
    });
    setEditingId(evt.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const viewAttendance = async (eventId: string) => {
    setActiveEventId(eventId);
    setShowAttendance(true);
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/attendance`);
      const data = await res.json();
      setAttendance(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const groupedAttendance = attendance.reduce((acc: any, curr: any) => {
    const houseName = curr.user?.house?.name || "Unassigned";
    if (!acc[houseName]) acc[houseName] = [];
    acc[houseName].push(curr);
    return acc;
  }, {});

  const filteredEvents = events.filter(evt => {
    const matchesSearch = evt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (evt.location && evt.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const now = new Date();
    const isLive = now >= new Date(evt.startTime) && now <= new Date(evt.endTime);
    const isPast = now > new Date(evt.endTime);
    const isUpcoming = now < new Date(evt.startTime);

    if (filterStatus === "live") return matchesSearch && isLive;
    if (filterStatus === "past") return matchesSearch && isPast;
    if (filterStatus === "upcoming") return matchesSearch && isUpcoming;
    return matchesSearch;
  });

  const getEventStatus = (evt: any) => {
    const now = new Date();
    if (now >= new Date(evt.startTime) && now <= new Date(evt.endTime)) return "live";
    if (now > new Date(evt.endTime)) return "past";
    return "upcoming";
  };

  return (
    <div className="animate-fade-in-up" style={{ paddingBottom: 100 }}>
      {/* Attendance Modal */}
      {showAttendance && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(24px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "95%",
            maxWidth: 1100,
            maxHeight: "90vh",
            borderRadius: 40,
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--border-medium)",
            boxShadow: "0 50px 120px rgba(0,0,0,0.4)",
            position: "relative"
          }}>
            {/* Modal Header */}
            <div style={{ 
              padding: "32px 40px", 
              borderBottom: "1px solid var(--border-subtle)", 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              background: "linear-gradient(to right, var(--bg-surface), var(--bg-elevated))"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                   <div style={{ 
                     width: 12, 
                     height: 12, 
                     borderRadius: "50%", 
                     background: "#10b981", 
                     boxShadow: "0 0 15px rgba(16,185,129,0.5)",
                     animation: "pulse-glow 2s infinite"
                   }} />
                   <p className="section-title" style={{ margin: 0, color: "#10b981", fontWeight: 800, fontSize: 12 }}>REAL-TIME ATTENDANCE</p>
                </div>
                <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em" }}>
                  {events.find(e => e.id === activeEventId)?.title || "Attendance List"}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Users size={16} className="text-muted" />
                      <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 15 }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 800 }}>{attendance.length}</span> Check-ins
                      </p>
                   </div>
                   <div style={{ width: 1, height: 16, background: "var(--border-medium)" }} />
                   <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                     Event ID: <span style={{ fontFamily: "monospace" }}>{activeEventId?.slice(0, 8)}</span>
                   </p>
                </div>
              </div>
              <button 
                className="btn btn-ghost" 
                style={{ borderRadius: "50%", width: 48, height: 48, padding: 0, fontSize: 20 }} 
                onClick={() => setShowAttendance(false)}
              >
                <X size={20} />
              </button>
            </div>

            {loadingAttendance ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                    <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
                    <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 16 }}>Synchronizing records...</p>
                 </div>
              </div>
            ) : (
              <div style={{ overflowY: "auto", flex: 1, padding: "40px" }} className="custom-scrollbar">
                {Object.keys(groupedAttendance).length === 0 ? (
                  <div style={{ padding: "80px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
                    <div style={{ 
                      width: 100, 
                      height: 100, 
                      borderRadius: "50%", 
                      background: "var(--bg-elevated)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-subtle)"
                    }}>
                       <Search size={40} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Waiting for first entry</h3>
                      <p style={{ color: "var(--text-muted)", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
                        Scanning hasn&apos;t started yet. Once students begin checking in via QR code, they will appear here live.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                    {Object.entries(groupedAttendance).map(([house, members]: [string, any]) => (
                      <div key={house}>
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between", 
                          marginBottom: 20, 
                          padding: "12px 20px", 
                          background: "var(--bg-elevated)", 
                          borderRadius: 16,
                          border: "1px solid var(--border-subtle)"
                        }}>
                          <h4 style={{ fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ 
                              width: 16, 
                              height: 16, 
                              borderRadius: 4, 
                              background: members[0]?.user?.house?.color || "var(--accent-primary)", 
                              boxShadow: `0 0 15px ${members[0]?.user?.house?.color}55` 
                            }} />
                            {house}
                          </h4>
                          <span className="badge" style={{ padding: "6px 16px", borderRadius: 99, background: "var(--bg-surface)", fontWeight: 800, color: "var(--text-secondary)" }}>
                            {members.length} Members
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                          {members.map((m: any) => (
                            <div key={m.id} className="attendance-card" style={{ 
                              padding: "20px", 
                              background: "var(--bg-surface)", 
                              borderRadius: 24, 
                              border: "1px solid var(--border-subtle)",
                              display: "flex",
                              alignItems: "center",
                              gap: 16,
                              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
                            }}>
                              <div style={{ 
                                width: 52, 
                                height: 52, 
                                borderRadius: 16, 
                                background: "var(--bg-elevated)", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                fontSize: 18,
                                fontWeight: 900,
                                color: "var(--accent-primary)",
                                border: "1px solid var(--border-subtle)"
                              }}>
                                {m.user?.name?.charAt(0)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{m.user?.name}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                                   <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{m.user?.studentId || "No ID"}</p>
                                   <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border-medium)" }} />
                                   <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <Clock size={12} className="text-muted" />
                                      <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                                        {new Date(m.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })}
                                      </p>
                                   </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {hasActualMedicalInfo(m.user) && (
                                  <div style={{ color: "#ef4444", animation: "pulse-glow 2s infinite" }} title="Medical Condition">
                                    <Activity size={20} />
                                  </div>
                                )}
                                <button 
                                  className="btn btn-ghost" 
                                  style={{ padding: 8, borderRadius: 10 }}
                                  onClick={() => setSelectedStudent(m.user)}
                                >
                                  <Info size={18} />
                                </button>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                                  <CheckCircle2 size={16} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Modal Footer */}
            <div style={{ padding: "20px 40px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", background: "var(--bg-elevated)" }}>
               <button className="btn btn-primary" onClick={() => setShowAttendance(false)}>Done Tracking</button>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {selectedStudent && (
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
        }} onClick={() => setSelectedStudent(null)}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "100%",
            maxWidth: 500,
            borderRadius: 32,
            overflow: "hidden",
            boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 32, borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <h3 style={{ fontSize: 20, fontWeight: 900 }}>Student Profile</h3>
               <button className="btn btn-ghost" onClick={() => setSelectedStudent(null)} style={{ borderRadius: "50%", width: 40, height: 40, padding: 0 }}><X size={18} /></button>
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
               {/* Header Info */}
               <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "var(--accent-primary)" }}>
                     {selectedStudent.name?.charAt(0)}
                  </div>
                  <div>
                     <p style={{ fontSize: 22, fontWeight: 900 }}>{selectedStudent.name}</p>
                     <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>{selectedStudent.studentId} • {selectedStudent.major}</p>
                  </div>
               </div>

               {/* Contact */}
               <div style={{ background: "var(--bg-elevated)", padding: 20, borderRadius: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.05em" }}>Contact Information</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                     <Phone size={16} color="var(--accent-primary)" />
                     <span style={{ fontWeight: 700 }}>{selectedStudent.phone || "No phone provided"}</span>
                  </div>
               </div>

               {/* Medical */}
               <div style={{ 
                 background: hasActualMedicalInfo(selectedStudent) 
                   ? "rgba(239, 68, 68, 0.05)" 
                   : "var(--bg-elevated)", 
                 padding: 20, 
                 borderRadius: 20,
                 border: hasActualMedicalInfo(selectedStudent)
                   ? "1px solid rgba(239, 68, 68, 0.1)"
                   : "1px solid transparent"
               }}>
                  <p style={{ 
                    fontSize: 12, 
                    fontWeight: 800, 
                    color: hasActualMedicalInfo(selectedStudent) ? "#ef4444" : "var(--text-muted)", 
                    textTransform: "uppercase", 
                    marginBottom: 12, 
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}>
                    <HeartPulse size={14} />
                    Medical & Health Info
                  </p>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedStudent.chronicDiseases && selectedStudent.chronicDiseases.trim() !== "-" && <p style={{ fontSize: 14 }}><b>Chronic:</b> {selectedStudent.chronicDiseases}</p>}
                    {selectedStudent.medicalHistory && selectedStudent.medicalHistory.trim() !== "-" && <p style={{ fontSize: 14 }}><b>History:</b> {selectedStudent.medicalHistory}</p>}
                    {selectedStudent.drugAllergies && selectedStudent.drugAllergies.trim() !== "-" && <p style={{ fontSize: 14 }}><b>Drug Allergies:</b> <span style={{ color: "#ef4444", fontWeight: 700 }}>{selectedStudent.drugAllergies}</span></p>}
                    {selectedStudent.foodAllergies && selectedStudent.foodAllergies.trim() !== "-" && <p style={{ fontSize: 14 }}><b>Food Allergies:</b> <span style={{ color: "#ef4444", fontWeight: 700 }}>{selectedStudent.foodAllergies}</span></p>}
                    {selectedStudent.dietaryRestrictions && selectedStudent.dietaryRestrictions.trim() !== "-" && <p style={{ fontSize: 14 }}><b>Dietary:</b> {selectedStudent.dietaryRestrictions}</p>}
                    {selectedStudent.faintingHistory && <p style={{ fontSize: 14, color: "#ef4444", fontWeight: 700 }}>⚠️ History of fainting</p>}
                    
                    {!hasActualMedicalInfo(selectedStudent) && (
                      <p style={{ fontSize: 14, color: "var(--text-muted)", fontStyle: "italic" }}>No medical conditions reported.</p>
                    )}
                  </div>
               </div>

               {/* Emergency Contact */}
               {selectedStudent.emergencyContacts && selectedStudent.emergencyContacts.length > 0 && (
                 <div style={{ background: "var(--bg-elevated)", padding: 20, borderRadius: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.05em" }}>Emergency Contact</p>
                    {selectedStudent.emergencyContacts.map((c: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{c.name} ({c.relationship})</p>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.phone}</p>
                        </div>
                        <a href={`tel:${c.phone}`} className="btn btn-ghost" style={{ borderRadius: "50%", width: 36, height: 36, padding: 0 }}><Phone size={14} /></a>
                      </div>
                    ))}
                 </div>
               )}
            </div>
            <div style={{ padding: "20px 32px", background: "var(--bg-elevated)", display: "flex", justifyContent: "flex-end" }}>
               <button className="btn btn-primary" onClick={() => setSelectedStudent(null)}>Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div style={{ marginBottom: 48 }}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-8 h-[2px] bg-[var(--accent-primary)] rounded-full" />
               <p className="section-title m-0 text-[var(--accent-primary)] font-extrabold uppercase tracking-widest text-[10px]">Event Command Center</p>
            </div>
            <h1 className="text-[clamp(32px,5vw,48px)] font-black tracking-tighter text-[var(--text-primary)] leading-tight">Manage Events</h1>
          </div>
          <button
            className={`btn ${showForm ? "btn-ghost" : "btn-primary"} h-16 px-8 rounded-2xl text-lg font-bold transition-all duration-300 ${!showForm && "shadow-[0_12px_32px_var(--accent-glow)]"}`}
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditingId(null);
                setFormData(EMPTY_FORM);
              } else {
                setEditingId(null);
                setFormData(EMPTY_FORM);
                setShowForm(true);
              }
            }}
          >
            {showForm ? <><X size={20} /> Close Editor</> : <><Plus size={20} /> Create New Event</>}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 bg-[var(--bg-surface)] p-3 rounded-[24px] border border-[var(--border-subtle)] shadow-sm">
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              className="input" 
              placeholder="Search by event name or location..." 
              style={{ paddingLeft: 48, borderRadius: 16, height: 48, background: "var(--bg-elevated)", border: "none" }} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-[var(--bg-elevated)] p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {(["all", "live", "upcoming", "past"] as const).map((s) => (
              <button 
                key={s} 
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold capitalize transition-all duration-200 whitespace-nowrap ${filterStatus === s ? "bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: 40,
            padding: 48,
            marginBottom: 48,
            boxShadow: "0 40px 80px rgba(0,0,0,0.1)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Form Background Decor */}
          <div style={{ position: "absolute", top: 0, right: 0, width: 300, height: 300, background: "radial-gradient(circle at top right, var(--accent-glow), transparent)", pointerEvents: "none" }} />

          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 40, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 12, height: 32, background: "var(--accent-primary)", borderRadius: 6 }} />
            {editingId ? "Edit Event Intelligence" : "Define New Event"}
          </h2>
          
          <form onSubmit={handleSubmit} className="relative">
            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-10">
              {/* Left Column: Basic Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="field">
                  <label className="label">Event Title <span style={{ color: "var(--accent-primary)" }}>*</span></label>
                  <input className="input" required value={formData.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. IT Freshy Night 2026" style={{ fontSize: 16, padding: "16px 20px", borderRadius: 16 }} />
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="field">
                    <label className="label">Location</label>
                    <div style={{ position: "relative" }}>
                      <MapPin size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input className="input" value={formData.location} onChange={(e) => set("location", e.target.value)} placeholder="CAMT Auditorium" style={{ paddingLeft: 44 }} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Points Awarded</label>
                    <div style={{ position: "relative" }}>
                      <Sparkles size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--accent-primary)" }} />
                      <input className="input" type="number" min={0} value={formData.pointsAwarded} onChange={(e) => set("pointsAwarded", Number(e.target.value))} style={{ paddingLeft: 44 }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="field">
                    <label className="label">Start Time <span style={{ color: "var(--accent-primary)" }}>*</span></label>
                    <input 
                      className="input" 
                      required 
                      type="datetime-local" 
                      lang="en-GB" 
                      value={formData.startTime} 
                      onChange={(e) => {
                        const val = e.target.value;
                        const newFormData = { ...formData, startTime: val };
                        // Automatically suggest an end time 2 hours later if not set
                        if (val && (!formData.endTime || formData.endTime < val)) {
                          const d = new Date(val);
                          d.setHours(d.getHours() + 2);
                          const offset = d.getTimezoneOffset() * 60000;
                          newFormData.endTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
                        }
                        setFormData(newFormData);
                      }} 
                    />
                  </div>
                  <div className="field">
                    <label className="label">End Time <span style={{ color: "var(--accent-primary)" }}>*</span></label>
                    <input className="input" required type="datetime-local" lang="en-GB" value={formData.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="field">
                    <label className="label">Participant Quota</label>
                    <div style={{ position: "relative" }}>
                      <Users size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input className="input" type="number" min={1} value={formData.quota} onChange={(e) => set("quota", Number(e.target.value))} placeholder="Unlimited if 0" style={{ paddingLeft: 44 }} />
                    </div>
                  </div>
                  
                  <div className="field" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div 
                      onClick={() => set("walkInsEnabled", !formData.walkInsEnabled)}
                      style={{ 
                        height: 48,
                        background: "var(--bg-elevated)",
                        borderRadius: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "0 16px",
                        cursor: "pointer",
                        border: formData.walkInsEnabled ? "1px solid var(--accent-primary)" : "1px solid transparent",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: 6, 
                        border: "2px solid var(--border-medium)",
                        background: formData.walkInsEnabled ? "var(--accent-primary)" : "transparent",
                        borderColor: formData.walkInsEnabled ? "var(--accent-primary)" : "var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s"
                      }}>
                        {formData.walkInsEnabled && <CheckCircle2 size={16} color="white" />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: formData.walkInsEnabled ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        Allow Walk-ins
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Poster & Description */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="field">
                  <label className="label">Event Poster</label>
                  <div style={{ 
                    position: "relative",
                    height: 180, 
                    background: "var(--bg-elevated)", 
                    borderRadius: 20,
                    border: "2px dashed var(--border-medium)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }} onClick={() => document.getElementById("poster-upload")?.click()}>
                    {formData.imageUrl ? (
                      <>
                        <img src={formData.imageUrl} alt="Poster" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s", color: "#fff" }} className="hover-overlay">
                           <Edit2 size={24} />
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", padding: 20 }}>
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-muted)" }}>
                           <ImageIcon size={28} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>Upload Poster</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>1:1 Aspect Ratio Recommended</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      id="poster-upload" 
                      accept="image/*" 
                      style={{ display: "none" }} 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const body = new FormData();
                        body.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body });
                        if (res.ok) {
                          const { url } = await res.json();
                          set("imageUrl", url);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label className="label" style={{ marginBottom: 0 }}>Description</label>
                    <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 2, borderRadius: 10 }}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, border: "none" }} onClick={() => injectMarkup("**", "**")}><Edit2 size={14} /></button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, border: "none" }} onClick={() => injectMarkup("[", "](https://...)")}><ExternalLink size={14} /></button>
                      <div style={{ position: "relative" }}>
                        <input type="color" style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer" }} onChange={(e) => injectMarkup(`{{color:${e.target.value}|`, "}}")} />
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, border: "none" }}><Sparkles size={14} /></button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, height: 220 }}>
                    <textarea 
                      ref={textareaRef}
                      className="input" 
                      style={{ resize: "none", borderRadius: 16, background: "var(--bg-elevated)", border: "none", height: "100%", fontSize: 14, padding: 16 }}
                      value={formData.description} 
                      onChange={(e) => set("description", e.target.value)} 
                      placeholder="Tell them about the event..."
                    />
                    <div 
                      className="custom-scrollbar"
                      style={{ 
                        background: "var(--bg-elevated)", 
                        borderRadius: 16, 
                        padding: 16, 
                        fontSize: 14, 
                        lineHeight: 1.6, 
                        overflowY: "auto",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-subtle)"
                      }}
                    >
                      <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>Live Preview</p>
                      <div dangerouslySetInnerHTML={{ __html: parseRichText(formData.description) || '<span style="color: var(--text-muted); font-style: italic;">No content yet...</span>' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {error && <div style={{ color: "#ef4444", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={16} /> {error}</div>}
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <button type="button" className="btn btn-ghost btn-lg" style={{ borderRadius: 16 }} onClick={() => setShowForm(false)}>Discard</button>
                <button type="submit" className="btn btn-primary btn-lg" style={{ borderRadius: 16, minWidth: 200 }} disabled={submitting}>
                  {submitting ? <><div className="spinner" /> Saving...</> : editingId ? "Update System" : "Activate Event"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Events Grid */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 0", gap: 20 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading Event Records...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div style={{ 
          background: "var(--bg-surface)", 
          borderRadius: 40, 
          padding: 80, 
          textAlign: "center", 
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24
        }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
             <Calendar size={48} />
          </div>
          <div>
            <h3 style={{ fontSize: 24, fontWeight: 800 }}>No events found</h3>
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>Try adjusting your filters or create a new event to get started.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Create First Event</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 32 }}>
          {filteredEvents.map((evt) => {
            const status = getEventStatus(evt);
            const isLive = status === "live";
            const isPast = status === "past";
            
            return (
              <div key={evt.id} className="event-card-premium" style={{ 
                background: "var(--bg-surface)", 
                borderRadius: 32, 
                border: "1px solid var(--border-subtle)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                boxShadow: "0 10px 40px rgba(0,0,0,0.04)"
              }}>
                {/* Card Header (Image/Status) */}
                <div style={{ height: 200, position: "relative", background: "var(--bg-elevated)", overflow: "hidden" }}>
                  {evt.imageUrl ? (
                    <img src={evt.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "rgba(0,0,0,0.8)" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(45deg, #ff6b0011, #ff6b0022)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                       <Calendar size={40} style={{ color: "var(--accent-primary)", opacity: 0.3 }} />
                    </div>
                  )}
                  
                  {/* Status Overlay */}
                  <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 8 }}>
                    {isLive && (
                      <div className="badge animate-pulse-glow" style={{ background: "#10b981", color: "#fff", border: "none", padding: "6px 12px" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", marginRight: 6 }} />
                        LIVE
                      </div>
                    )}
                    {!isLive && !isPast && (
                      <div className="badge" style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "6px 12px" }}>UPCOMING</div>
                    )}
                    {isPast && (
                      <div className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)", padding: "6px 12px" }}>PAST</div>
                    )}
                    {evt.walkInsEnabled && (
                      <div className="badge" style={{ background: "rgba(99, 102, 241, 0.2)", color: "#6366f1", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "6px 12px", backdropFilter: "blur(4px)" }}>
                        <Zap size={12} style={{ marginRight: 4 }} />
                        WALK-IN
                      </div>
                    )}
                  </div>

                  {/* Points Badge */}
                  <div style={{ position: "absolute", bottom: 20, left: 20 }}>
                     <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", color: "#fff", padding: "6px 12px", borderRadius: 12, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                        <Sparkles size={14} style={{ color: "#fbbf24" }} />
                        {evt.pointsAwarded} PTS
                     </div>
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: 28, flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{evt.title}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 14, fontWeight: 500 }}>
                        <MapPin size={16} style={{ color: "var(--accent-primary)" }} />
                        {evt.location || "Online / TBD"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
                        <Calendar size={16} style={{ color: "var(--accent-primary)" }} />
                        {(() => {
                          const start = new Date(evt.startTime);
                          const end = new Date(evt.endTime);
                          const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' };
                          const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' };
                          
                          return `${start.toLocaleDateString('en-GB', dateOpts)} ${start.toLocaleTimeString('en-GB', timeOpts)} — ${end.toLocaleDateString('en-GB', dateOpts)} ${end.toLocaleTimeString('en-GB', timeOpts)}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Quota Progress */}
                  <div style={{ marginBottom: 24 }}>
                     <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                        <span style={{ color: "var(--text-muted)", letterSpacing: "0.05em" }}>CAPACITY</span>
                        <span style={{ color: "var(--text-primary)" }}>
                          {evt.attendeeCount || 0} / {evt.quota || "∞"}
                        </span>
                     </div>
                     <div style={{ width: "100%", height: 8, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ 
                          width: `${evt.quota ? Math.min(100, ((evt.attendeeCount || 0) / evt.quota) * 100) : 0}%`, 
                          height: "100%", 
                          background: evt.quota && (evt.attendeeCount || 0) >= evt.quota ? "#ef4444" : "var(--accent-primary)", 
                          borderRadius: 4,
                          transition: "width 0.5s ease-out"
                        }} />
                     </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1, borderRadius: 16 }} 
                      onClick={() => viewAttendance(evt.id)}
                    >
                      <BarChart3 size={18} /> Attendance
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        className="btn btn-ghost" 
                        style={{ width: 48, height: 48, padding: 0, borderRadius: 16 }} 
                        onClick={() => handleEdit(evt)}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        id={`delete-event-${evt.id}-btn`}
                        className="btn btn-danger" 
                        style={{ width: 48, height: 48, padding: 0, borderRadius: 16 }} 
                        disabled={deletingId === evt.id}
                        onClick={() => handleDelete(evt.id)}
                      >
                        {deletingId === evt.id ? <div className="spinner" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global CSS for the premium experience */}
      <style jsx global>{`
        .event-card-premium:hover {
          transform: translateY(-8px);
          border-color: var(--accent-primary);
          box-shadow: 0 30px 60px rgba(255,107,0,0.1);
        }
        .event-card-premium:hover .hover-overlay {
          opacity: 1;
        }
        .attendance-card:hover {
          transform: scale(1.02);
          border-color: var(--accent-primary);
          background: var(--bg-elevated);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border-medium);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
      `}</style>
    </div>
  );
}