"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus, Edit2, Trash2, Calendar, MapPin, Clock,
  ArrowRight, User, Users, CheckCircle2, Search,
  Sparkles, Filter, MoreVertical, X, ExternalLink,
  ChevronRight, AlertCircle, BarChart3, Image as ImageIcon, Zap,
  Activity, Phone, HeartPulse, Info, Trophy, ClipboardList
} from "lucide-react";
import { parseRichText } from "@/lib/rich-text";
import { useLanguage } from "@/lib/LanguageContext";

interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  quota: number | null;
  pointsAwarded: number;
  imageUrl: string | null;
  walkInsEnabled: boolean;
  targetThai: boolean;
  targetInternational: boolean;
  quotaThai: number | null;
  quotaInternational: number | null;
  attendeeCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface AdminStudent {
  id: string;
  name: string;
  nickname: string | null;
  studentId: string | null;
  email: string;
  phone: string | null;
  major: string | null;
  religion: string | null;
  contactChannels: string | null;
  chronicDiseases: string | null;
  medicalHistory: string | null;
  drugAllergies: string | null;
  foodAllergies: string | null;
  dietaryRestrictions: string | null;
  faintingHistory: boolean | null;
  emergencyMedication: string | null;
  emergencyContacts: EmergencyContact[];
  houseId: string | null;
  house: { id: string; name: string; color: string } | null;
}

interface AdminAttendance {
  id: string;
  eventId: string;
  studentId: string;
  checkInTime: string | null;
  method: string | null;
  status: string;
  scannedBy: string | null;
  medsCheckOption: string | null;
  user?: AdminStudent;
}

interface FormBuilderQuestion {
  id: string;
  type: "text" | "rating" | "multiple" | "choice";
  label: string;
  required?: boolean;
  options?: string[];
}

interface FormBuilderSubmission {
  id: string;
  studentName: string;
  studentId: string;
  houseId: string;
  answers: Record<string, string | number | string[]>;
  submittedAt: string;
}

interface FormBuilderStats {
  totalSubmissions: number;
  questions: Array<{
    id: string;
    label: string;
    type: string;
    average?: number;
    distribution?: Record<string, number>;
    textAnswers?: string[];
  }>;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  startTime: "",
  endTime: "",
  quota: 0,
  pointsAwarded: 0,
  imageUrl: "",
  walkInsEnabled: false,
  targetThai: true,
  targetInternational: true,
  quotaThai: null as number | null,
  quotaInternational: null as number | null
};

export default function AdminEventsPage() {
  const { t, lang } = useLanguage();
  const [events, setEvents] = useState<AdminEvent[]>([]);
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
  const [attendance, setAttendance] = useState<AdminAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [filterMedical, setFilterMedical] = useState(false);
  const [filterNotCheckedIn, setFilterNotCheckedIn] = useState(false);
  const [filterThai, setFilterThai] = useState(true);
  const [filterInternational, setFilterInternational] = useState(true);

  // Custom Form Builder states
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [formEventId, setFormEventId] = useState<string | null>(null);
  const [formEventTitle, setFormEventTitle] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPoints, setFormPoints] = useState(50);
  const [formQuestions, setFormQuestions] = useState<FormBuilderQuestion[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsAwarded, setFormIsAwarded] = useState(false);
  const [formStats, setFormStats] = useState<Record<string, number> | null>(null);
  const [formSubmissions, setFormSubmissions] = useState<FormBuilderSubmission[]>([]);
  const [formAwarding, setFormAwarding] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formTab, setFormTab] = useState<"edit" | "stats">("edit");
  
  // Custom admin form builder premium notification states
  const [formBuilderError, setFormBuilderError] = useState<string | null>(null);
  const [formBuilderSuccess, setFormBuilderSuccess] = useState<string | null>(null);
  const [showAwardConfirm, setShowAwardConfirm] = useState(false);

  // Custom premium modals for confirmation and errors
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmText: "",
    cancelText: "",
    isDanger: false
  });

  const [errorModal, setErrorModal] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({
    show: false,
    title: "",
    message: ""
  });

  const openFormBuilder = async (eventId: string, eventTitle: string) => {
    setFormEventId(eventId);
    setFormEventTitle(eventTitle);
    setShowFormBuilder(true);
    setFormLoading(true);
    setFormTab("edit");
    setFormBuilderError(null);
    setFormBuilderSuccess(null);
    setShowAwardConfirm(false);
    
    try {
      const res = await fetch(`/api/admin/events/${eventId}/form`);
      const data = await res.json();
      
      if (data.form) {
        setFormTitle(data.form.title);
        setFormDescription(data.form.description || "");
        setFormPoints(data.form.pointsAwarded || 0);
        setFormQuestions(data.form.questions || []);
        setFormIsActive(data.form.isActive);
        setFormIsAwarded(data.form.isAwarded || false);
        setFormStats(data.stats);
        setFormSubmissions(data.submissions || []);
        if (data.submissions && data.submissions.length > 0) {
          setFormTab("stats");
        }
      } else {
        setFormTitle(`${eventTitle} Evaluation`);
        setFormDescription("Thank you for attending! Please give us your feedback.");
        setFormPoints(50);
        setFormQuestions([
          { id: "q1", type: "rating", label: "Overall Satisfaction", required: true },
          { id: "q2", type: "text", label: "What did you learn or enjoy the most?", required: true },
          { id: "q3", type: "text", label: "Any suggestions for improvement?", required: false }
        ]);
        setFormIsActive(true);
        setFormIsAwarded(false);
        setFormStats(null);
        setFormSubmissions([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFormLoading(false);
    }
  };

  const saveForm = async () => {
    if (!formEventId) return;
    setFormSaving(true);
    setFormBuilderError(null);
    setFormBuilderSuccess(null);
    try {
      const res = await fetch(`/api/admin/events/${formEventId}/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          pointsAwarded: formPoints,
          questions: formQuestions,
          isActive: formIsActive
        })
      });
      if (res.ok) {
        setFormBuilderSuccess("Evaluation form saved successfully!");
        
        // Refresh states in background
        const freshRes = await fetch(`/api/admin/events/${formEventId}/form`);
        const freshData = await freshRes.json();
        if (freshData.form) {
          setFormTitle(freshData.form.title);
          setFormDescription(freshData.form.description || "");
          setFormPoints(freshData.form.pointsAwarded || 0);
          setFormQuestions(freshData.form.questions || []);
          setFormIsActive(freshData.form.isActive);
          setFormIsAwarded(freshData.form.isAwarded || false);
          setFormStats(freshData.stats);
          setFormSubmissions(freshData.submissions || []);
        }
      } else {
        const d = await res.json();
        setFormBuilderError("Failed to save: " + (d.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      setFormBuilderError("Failed to save evaluation form.");
    } finally {
      setFormSaving(false);
    }
  };

  const toggleFormActiveStatus = async () => {
    if (!formEventId) return;
    setFormSaving(true);
    setFormBuilderError(null);
    setFormBuilderSuccess(null);
    const newActiveState = !formIsActive;
    try {
      const res = await fetch(`/api/admin/events/${formEventId}/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          pointsAwarded: formPoints,
          questions: formQuestions,
          isActive: newActiveState
        })
      });
      if (res.ok) {
        setFormIsActive(newActiveState);
        setFormBuilderSuccess(newActiveState ? "Evaluation form is now open for students!" : "Evaluation form has been closed.");
      } else {
        const d = await res.json();
        setFormBuilderError("Failed to update status: " + (d.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      setFormBuilderError("Failed to toggle form status.");
    } finally {
      setFormSaving(false);
    }
  };

  const awardFormPoints = () => {
    setShowAwardConfirm(true);
  };

  const awardFormPointsReal = async () => {
    if (!formEventId) return;
    
    setFormAwarding(true);
    setFormBuilderError(null);
    setFormBuilderSuccess(null);
    try {
      const res = await fetch(`/api/admin/events/${formEventId}/form/award`, {
        method: "POST"
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.winners && data.winners.length > 0) {
          setFormBuilderSuccess(`🏆 Contest Ended! Winner: ${data.winners.map((w: string) => w.toUpperCase()).join(" & ")} House won with ${data.submissionsCount} submissions! +${formPoints} PTS awarded!`);
        } else {
          setFormBuilderSuccess(data.message || "Form ended, no points awarded.");
        }
        
        // Refresh state
        const freshRes = await fetch(`/api/admin/events/${formEventId}/form`);
        const freshData = await freshRes.json();
        if (freshData.form) {
          setFormIsActive(freshData.form.isActive);
          setFormIsAwarded(freshData.form.isAwarded || false);
          setFormStats(freshData.stats);
          setFormSubmissions(freshData.submissions || []);
        }
      } else {
        setFormBuilderError("Failed: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      setFormBuilderError("Failed to end contest and award points.");
    } finally {
      setFormAwarding(false);
    }
  };

  const addQuestion = () => {
    const newQ: FormBuilderQuestion = {
      id: "q_" + Date.now(),
      type: "text",
      label: "New Question",
      required: false
    };
    setFormQuestions([...formQuestions, newQ]);
  };

  const removeQuestion = (qId: string) => {
    setFormQuestions(formQuestions.filter(q => q.id !== qId));
  };

  const updateQuestion = (qId: string, key: string, val: string | boolean | string[]) => {
    setFormQuestions(formQuestions.map(q => {
      if (q.id === qId) {
        const updated = { ...q, [key]: val };
        // If type changed to choice or multiple and options don't exist, initialize default options
        if (key === "type" && (val === "choice" || val === "multiple") && !updated.options) {
          updated.options = ["Option 1", "Option 2"];
        }
        return updated;
      }
      return q;
    }));
  };

  const addOption = (qId: string) => {
    setFormQuestions(formQuestions.map(q => {
      if (q.id === qId) {
        const opts = q.options ? [...q.options] : [];
        opts.push(`Option ${opts.length + 1}`);
        return { ...q, options: opts };
      }
      return q;
    }));
  };

  const removeOption = (qId: string, optIdx: number) => {
    setFormQuestions(formQuestions.map(q => {
      if (q.id === qId) {
        const opts = q.options ? q.options.filter((_, idx: number) => idx !== optIdx) : [];
        return { ...q, options: opts };
      }
      return q;
    }));
  };

  const updateOption = (qId: string, optIdx: number, val: string) => {
    setFormQuestions(formQuestions.map(q => {
      if (q.id === qId) {
        const opts = q.options ? [...q.options] : [];
        opts[optIdx] = val;
        return { ...q, options: opts };
      }
      return q;
    }));
  };

  const hasActualMedicalInfo = (user: AdminStudent | null | undefined) => {
    if (!user) return false;
    const fields = [
      user.chronicDiseases,
      user.medicalHistory,
      user.drugAllergies,
      user.foodAllergies,
      user.dietaryRestrictions,
      user.emergencyMedication
    ];
    const isMeaningful = (val: string | boolean | null | undefined) => {
      if (typeof val !== 'string') return !!val;
      const t = val.trim();
      return t !== "" && t !== "-";
    };
    return fields.some(isMeaningful) || user.faintingHistory === true;
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        setEvents([]);
        if (data && data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    timer = setTimeout(() => {
      fetchEvents();
    }, 0);

    // Establish Server-Sent Events (SSE) Real-time subscription
    const eventSource = new EventSource("/api/realtime");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          payload.type === "event_created" ||
          payload.type === "event_updated" ||
          payload.type === "event_deleted"
        ) {
          fetchEvents(); // Live update the events listing!
        }
      } catch (err) {
        console.error("SSE parse error in events admin page:", err);
      }
    };

    return () => {
      if (timer) clearTimeout(timer);
      eventSource.close();
    };
  }, []);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, val: typeof EMPTY_FORM[K]) => setFormData({ ...formData, [key]: val });

  const lastInjectedRange = useRef<{ start: number, end: number } | null>(null);

  const injectMarkup = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
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

      const isInside = (lastTagStart > -1 && (lastTagEnd === -1 || lastTagEnd < lastTagStart));
      const actualTagStart = lastTagStart;
      const actualTagEnd = end + nextTagEnd + 2;

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
        setErrorModal({
          show: true,
          title: lang === "th" ? "การบันทึกข้อมูลล้มเหลว" : "Save Failed",
          message: err.error || (lang === "th" ? "ไม่สามารถบันทึกข้อมูลกิจกรรมได้" : "Failed to save event details.")
        });
      }
    } catch (err) {
      setError("Something went wrong");
      setErrorModal({
        show: true,
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "System Error",
        message: lang === "th" ? "เกิดข้อผิดพลาดบางอย่างกรุณาลองใหม่อีกครั้ง" : "Something went wrong. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      show: true,
      title: lang === "th" ? "คุณแน่ใจหรือไม่?" : "Are you sure?",
      message: lang === "th" 
        ? "การดำเนินการนี้จะลบกิจกรรมและบันทึกการเช็คอินทั้งหมดของกิจกรรมนี้อย่างถาวร!" 
        : "This will permanently delete this event and all associated attendance records!",
      confirmText: lang === "th" ? "ลบกิจกรรม" : "Delete Event",
      cancelText: lang === "th" ? "ยกเลิก" : "Cancel",
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setDeletingId(id);
        try {
          const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
          if (res.ok) {
            fetchEvents();
          } else {
            const err = await res.json();
            setErrorModal({
              show: true,
              title: lang === "th" ? "การลบล้มเหลว" : "Delete Failed",
              message: err.error || (lang === "th" ? "ไม่สามารถลบกิจกรรมได้" : "Failed to delete event")
            });
          }
        } catch (err) {
          setErrorModal({
            show: true,
            title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error Occurred",
            message: lang === "th" ? "เกิดข้อผิดพลาดบางอย่าง" : "Something went wrong"
          });
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleEdit = (evt: AdminEvent) => {
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
      walkInsEnabled: evt.walkInsEnabled || false,
      targetThai: evt.targetThai !== false,
      targetInternational: evt.targetInternational !== false,
      quotaThai: evt.quotaThai || null,
      quotaInternational: evt.quotaInternational || null
    });
    setEditingId(evt.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const viewAttendance = async (eventId: string) => {
    setActiveEventId(eventId);
    setShowAttendance(true);
    setLoadingAttendance(true);
    setFilterMedical(false);
    setFilterThai(true);
    setFilterInternational(true);
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

  const filteredAttendance = attendance.filter((m) => {
    if (filterMedical && !hasActualMedicalInfo(m.user)) {
      return false;
    }
    if (filterNotCheckedIn && m.status !== "registered") {
      return false;
    }
    
    const studentId = m.user?.studentId || "";
    const cleanId = studentId.trim();
    
    let isThai = true;
    let isIntl = false;
    
    if (cleanId.length >= 3) {
      const lastThreeDigitFirst = cleanId.slice(-3)[0];
      if (lastThreeDigitFirst === "5") {
        isThai = false;
        isIntl = true;
      } else if (["0", "1", "2", "3", "4"].includes(lastThreeDigitFirst)) {
        isThai = true;
        isIntl = false;
      }
    }
    
    if (!filterThai && isThai) {
      return false;
    }
    if (!filterInternational && isIntl) {
      return false;
    }
    
    return true;
  });

  const checkInCount = attendance.filter(m => m.status === "attended").length;
  const registeredCount = attendance.length;

  const groupedAttendance = filteredAttendance.reduce((acc: Record<string, AdminAttendance[]>, curr: AdminAttendance) => {
    const houseId = curr.user?.house?.id || "Unassigned";
    if (!acc[houseId]) acc[houseId] = [];
    acc[houseId].push(curr);
    return acc;
  }, {});

  const filteredEvents = Array.isArray(events) ? events.filter(evt => {
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
  }) : [];

  const getEventStatus = (evt: AdminEvent) => {
    const now = new Date();
    if (now >= new Date(evt.startTime) && now <= new Date(evt.endTime)) return "live";
    if (now > new Date(evt.endTime)) return "past";
    return "upcoming";
  };

  return (
    <>
      <div className="animate-fade-in-up" style={{ paddingBottom: 100 }}>
        {/* Main Header */}
        <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ marginBottom: 20 }}>
          <h1 className="text-[clamp(32px,5vw,48px)] font-black tracking-tighter text-[var(--text-primary)] leading-tight">{t.eventsTitle}</h1>
          <button
            className={`btn ${showForm ? "btn-ghost" : "btn-primary"} flex-shrink-0 transition-all duration-300 ${!showForm && "shadow-[0_12px_32px_var(--accent-glow)]"}`}
            style={{ gap: 10, minHeight: 52, paddingInline: 28, borderRadius: 99, fontSize: 15, fontWeight: 700 }}
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
            {showForm ? <><X size={18} /> {lang === "th" ? "ปิดตัวแก้ไข" : lang === "cn" ? "关闭编辑器" : lang === "mm" ? "အယ်ဒီတာ ပိတ်ရန်" : "Close Editor"}</> : <><Plus size={18} /> {t.addEventBtn}</>}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3" style={{ marginBottom: 48 }}>
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              className="input w-full h-12"
              style={{ paddingLeft: 48, borderRadius: 16, border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}
              placeholder={t.searchEventsPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "live", "upcoming", "past"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: "8px 20px",
                  minHeight: 44,
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border: filterStatus === s ? "1px solid var(--accent-primary)" : "1px solid transparent",
                  background: filterStatus === s ? "var(--accent-glow)" : "var(--bg-elevated)",
                  color: filterStatus === s ? "var(--accent-primary)" : "var(--text-secondary)"
                }}
              >
                {s === "all" ? t.filterAll : s === "live" ? t.filterLive : s === "upcoming" ? t.filterUpcoming : t.filterPast}
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
            borderRadius: "clamp(20px, 4vw, 32px)",
            padding: "clamp(20px, 5vw, 40px)",
            marginBottom: 48,
            boxShadow: "0 40px 80px rgba(0,0,0,0.1)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Form Background Decor */}
          <div style={{ position: "absolute", top: 0, right: 0, width: 300, height: 300, background: "radial-gradient(circle at top right, var(--accent-glow), transparent)", pointerEvents: "none" }} />

          <h2 style={{ fontSize: "clamp(22px, 5vw, 28px)", fontWeight: 900, marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 28, background: "var(--accent-primary)", borderRadius: 5 }} />
            {editingId ? t.editEventTitle : t.newEventTitle}
          </h2>

          <form onSubmit={handleSubmit} className="relative">
            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-10">
              {/* Left Column: Basic Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="field">
                  <label className="label">{t.eventTitleLabel} <span style={{ color: "var(--accent-primary)" }}>*</span></label>
                  <input className="input" required value={formData.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. IT Freshy Night 2026" style={{ fontSize: 16, padding: "16px 20px", borderRadius: 16 }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="field">
                    <label className="label">{t.eventLocationLabel}</label>
                    <div style={{ position: "relative" }}>
                      <MapPin size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input className="input" value={formData.location} onChange={(e) => set("location", e.target.value)} placeholder="CAMT Auditorium" style={{ paddingLeft: 44 }} />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">{t.eventPointsLabel}</label>
                    <div style={{ position: "relative" }}>
                      <Sparkles size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--accent-primary)" }} />
                      <input className="input" type="number" min={0} value={formData.pointsAwarded} onChange={(e) => set("pointsAwarded", Number(e.target.value))} style={{ paddingLeft: 44 }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="field">
                    <label className="label">{t.eventStartTimeLabel} <span style={{ color: "var(--accent-primary)" }}>*</span></label>
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
                    <label className="label">{t.eventEndTimeLabel} <span style={{ color: "var(--accent-primary)" }}>*</span></label>
                    <input className="input" required type="datetime-local" lang="en-GB" value={formData.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="field">
                    <label className="label">{t.eventQuotaLabel}</label>
                    <div style={{ position: "relative" }}>
                      <Users size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input className="input" type="number" min={1} value={formData.quota} onChange={(e) => set("quota", Number(e.target.value))} placeholder={t.unlimitedIfZero} style={{ paddingLeft: 44 }} />
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
                        {t.allowWalkins}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="field" style={{ marginTop: 20 }}>
                  <label className="label">{t.targetAudience}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => {
                        const nextVal = !formData.targetThai;
                        setFormData({
                          ...formData,
                          targetThai: nextVal,
                          ...(!nextVal && { quotaThai: null })
                        });
                      }}
                      style={{
                        height: 48,
                        background: "var(--bg-elevated)",
                        borderRadius: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "0 16px",
                        cursor: "pointer",
                        border: formData.targetThai ? "1px solid var(--accent-primary)" : "1px solid transparent",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: "2px solid var(--border-medium)",
                        background: formData.targetThai ? "var(--accent-primary)" : "transparent",
                        borderColor: formData.targetThai ? "var(--accent-primary)" : "var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s"
                      }}>
                        {formData.targetThai && <CheckCircle2 size={16} color="white" />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: formData.targetThai ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {t.thaiStudents}
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        const nextVal = !formData.targetInternational;
                        setFormData({
                          ...formData,
                          targetInternational: nextVal,
                          ...(!nextVal && { quotaInternational: null })
                        });
                      }}
                      style={{
                        height: 48,
                        background: "var(--bg-elevated)",
                        borderRadius: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "0 16px",
                        cursor: "pointer",
                        border: formData.targetInternational ? "1px solid var(--accent-primary)" : "1px solid transparent",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: "2px solid var(--border-medium)",
                        background: formData.targetInternational ? "var(--accent-primary)" : "transparent",
                        borderColor: formData.targetInternational ? "var(--accent-primary)" : "var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s"
                      }}>
                        {formData.targetInternational && <CheckCircle2 size={16} color="white" />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: formData.targetInternational ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {t.internationalStudents}
                      </span>
                    </div>
                  </div>

                  {/* Cohort Quota Limits */}
                  {(formData.targetThai || formData.targetInternational) && (
                    <div className="grid gap-5 mt-5" style={{ 
                      gridTemplateColumns: formData.targetThai && formData.targetInternational ? "repeat(auto-fit, minmax(200px, 1fr))" : "1fr"
                    }}>
                      {formData.targetThai && (
                        <div className="field">
                          <label className="label">{t.thaiStudentQuota}</label>
                          <div style={{ position: "relative" }}>
                            <Users size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                            <input 
                              className="input" 
                              type="number" 
                              min={1} 
                              value={formData.quotaThai || ""} 
                              onChange={(e) => set("quotaThai", e.target.value ? Number(e.target.value) : null)} 
                              placeholder={t.unlimitedIfEmpty} 
                              style={{ paddingLeft: 44 }} 
                            />
                          </div>
                        </div>
                      )}

                      {formData.targetInternational && (
                        <div className="field">
                          <label className="label">{t.intlStudentQuota}</label>
                          <div style={{ position: "relative" }}>
                            <Users size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                            <input 
                              className="input" 
                              type="number" 
                              min={1} 
                              value={formData.quotaInternational || ""} 
                              onChange={(e) => set("quotaInternational", e.target.value ? Number(e.target.value) : null)} 
                              placeholder={t.unlimitedIfEmpty} 
                              style={{ paddingLeft: 44 }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quota Conflicts Warning */}
                  {(() => {
                    const warnings: string[] = [];
                    const globalLimit = Number(formData.quota) || 0;
                    const thaiLimit = formData.targetThai ? (Number(formData.quotaThai) || 0) : 0;
                    const intlLimit = formData.targetInternational ? (Number(formData.quotaInternational) || 0) : 0;

                    if (globalLimit > 0) {
                      if (formData.targetThai && thaiLimit > globalLimit) {
                        warnings.push(
                          lang === "th"
                            ? `โควตาสำหรับนักศึกษาไทย (${thaiLimit}) มีจำนวนมากกว่าโควตาทั้งหมดของกิจกรรม (${globalLimit})`
                            : `Thai student limit (${thaiLimit}) exceeds the overall Participant Quota (${globalLimit}).`
                        );
                      }
                      if (formData.targetInternational && intlLimit > globalLimit) {
                        warnings.push(
                          lang === "th"
                            ? `โควตาสำหรับนักศึกษาต่างชาติ (${intlLimit}) มีจำนวนมากกว่าโควตาทั้งหมดของกิจกรรม (${globalLimit})`
                            : `International student limit (${intlLimit}) exceeds the overall Participant Quota (${globalLimit}).`
                        );
                      }
                      if (formData.targetThai && formData.targetInternational && thaiLimit > 0 && intlLimit > 0 && (thaiLimit + intlLimit) > globalLimit) {
                        warnings.push(
                          lang === "th"
                            ? `ผลรวมโควตาของนักศึกษาไทยและต่างชาติ (${thaiLimit + intlLimit}) มีจำนวนมากกว่าโควตาทั้งหมดของกิจกรรม (${globalLimit}) ทั้งนี้ ระบบจะปิดรับการลงทะเบียนเมื่อผู้สมัครเต็มตามจำนวนโควตาทั้งหมด (${globalLimit} คน)`
                            : `The sum of Thai and International student limits (${thaiLimit + intlLimit}) exceeds the overall Participant Quota (${globalLimit}). The event will stop accepting registrations once the overall limit of ${globalLimit} is reached.`
                        );
                      }
                    }
                    if (warnings.length === 0) return null;

                    return (
                      <div style={{
                        marginTop: 20,
                        padding: "16px 20px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        borderRadius: 16,
                        color: "#f59e0b",
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.05)"
                      }}>
                        {warnings.map((w, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: "#f59e0b" }} />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right Column: Poster & Description */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="field">
                  <label className="label">{t.eventPosterLabel}</label>
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
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>{lang === "th" ? "อัปโหลดโปสเตอร์" : "Upload Poster"}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{lang === "th" ? "แนะนำขนาดอัตราส่วน 1:1" : "1:1 Aspect Ratio Recommended"}</p>
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
                    <label className="label" style={{ marginBottom: 0 }}>{t.eventDescriptionLabel}</label>
                    <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 2, borderRadius: 10 }}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, border: "none" }} onClick={() => injectMarkup("**", "**")}><Edit2 size={14} /></button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, border: "none" }} onClick={() => injectMarkup("[", "](https://...)")}><ExternalLink size={14} /></button>
                      <div style={{ position: "relative" }}>
                        <input type="color" style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer" }} onChange={(e) => injectMarkup(`{{color:${e.target.value}|`, "}}")} />
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 6, border: "none" }}><Sparkles size={14} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-auto md:h-[240px]">
                    <textarea
                      ref={textareaRef}
                      className="input h-[180px] md:h-full"
                      style={{ resize: "none", borderRadius: 16, background: "var(--bg-elevated)", border: "none", fontSize: 14, padding: 16 }}
                      value={formData.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder={lang === "th" ? "อธิบายรายละเอียดเกี่ยวกับกิจกรรม..." : "Tell them about the event..."}
                    />
                    <div
                      className="custom-scrollbar h-[180px] md:h-full"
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
                      <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>{lang === "th" ? "ตัวอย่างการแสดงผล" : "Live Preview"}</p>
                      <div dangerouslySetInnerHTML={{ __html: parseRichText(formData.description) || `<span style="color: var(--text-muted); font-style: italic;">${lang === "th" ? "ยังไม่มีเนื้อหา..." : "No content yet..."}</span>` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6" style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {error && <div style={{ color: "#ef4444", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><AlertCircle size={16} /> {error}</div>}
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                <button type="button" className="btn btn-ghost btn-lg w-full sm:w-auto" style={{ borderRadius: 16 }} onClick={() => setShowForm(false)}>{t.discardBtn}</button>
                <button type="submit" className="btn btn-primary btn-lg w-full sm:w-auto" style={{ borderRadius: 16, minWidth: 200 }} disabled={submitting}>
                  {submitting ? <>{lang === "th" ? "กำลังบันทึก..." : "Saving..."}</> : editingId ? t.updateSystemBtn : t.activateEventBtn}
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
            <h3 style={{ fontSize: 24, fontWeight: 800 }}>{t.noEventsFoundLabel}</h3>
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>{lang === "th" ? "ลองปรับตัวกรองหรือสร้างกิจกรรมใหม่เพื่อเริ่มต้น" : lang === "cn" ? "尝试调整您的筛选条件或创建一个新活动以开始。" : lang === "mm" ? "စတင်ရန် စစ်ထုတ်မှုများကို ချိန်ညှိပါ သို့မဟုတ် ပွဲအသစ်တစ်ခု ဖန်တီးပါ။" : "Try adjusting your filters or create a new event to get started."}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t.addEventBtn}</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 380px), 1fr))", gap: 32 }}>
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
                <div style={{ height: 220, position: "relative", background: "var(--bg-elevated)", padding: 16 }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden", position: "relative" }}>
                    {evt.imageUrl ? (
                      <img src={evt.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--border-subtle) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Calendar size={48} style={{ color: "var(--accent-primary)", opacity: 0.2 }} />
                      </div>
                    )}
                  </div>

                  {/* Status Overlay */}
                  <div style={{ position: "absolute", top: 28, right: 28, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {evt.walkInsEnabled && (
                      <div className="badge" style={{ background: "rgba(99, 102, 241, 0.2)", color: "#6366f1", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "6px 12px", backdropFilter: "blur(4px)" }}>
                        <Zap size={12} style={{ marginRight: 4 }} />
                        Walk-in
                      </div>
                    )}
                    {(evt.targetThai !== false && evt.targetInternational !== false) || (evt.targetThai === false && evt.targetInternational === false) ? (
                      <div className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "6px 12px", backdropFilter: "blur(4px)" }}>
                        All Students
                      </div>
                    ) : evt.targetThai !== false ? (
                      <div className="badge" style={{ background: "rgba(59, 130, 246, 0.2)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)", padding: "6px 12px", backdropFilter: "blur(4px)" }}>
                        Thai Only
                      </div>
                    ) : evt.targetInternational !== false ? (
                      <div className="badge" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "6px 12px", backdropFilter: "blur(4px)" }}>
                        {"Int'l Only"}
                      </div>
                    ) : null}
                    {isLive && (
                      <div className="badge animate-pulse-glow" style={{ background: "#10b981", color: "#fff", border: "none", padding: "6px 12px" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", marginRight: 6 }} />
                        {t.statusLive.toUpperCase()}
                      </div>
                    )}
                    {!isLive && !isPast && (
                      <div className="badge" style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "6px 12px" }}>{t.statusUpcoming.toUpperCase()}</div>
                    )}
                    {isPast && (
                      <div className="badge" style={{ background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", padding: "6px 12px", backdropFilter: "blur(4px)" }}>{t.statusPast.toUpperCase()}</div>
                    )}
                  </div>

                  {/* Points Badge */}
                  {evt.pointsAwarded !== undefined && (
                    <div style={{ position: "absolute", bottom: 28, left: 28 }}>
                      <div style={{ 
                        background: "rgba(0, 0, 0, 0.7)", 
                        backdropFilter: "blur(8px)", 
                        color: "#fff", 
                        padding: "6px 12px", 
                        borderRadius: 14, 
                        fontSize: 11, 
                        fontWeight: 900, 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: 6, 
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.1)"
                      }}>
                        <Trophy size={12} style={{ color: "#fbbf24" }} />
                        <span>{evt.pointsAwarded} PTS</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div style={{ padding: "28px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.35 }}>{evt.title}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
                        <MapPin size={14} style={{ color: "var(--accent-primary)" }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.location || "Online / TBD"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>
                        <Calendar size={14} style={{ color: "var(--accent-primary)" }} />
                        {(() => {
                          const start = new Date(evt.startTime);
                          const end = new Date(evt.endTime);
                          const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' };
                          const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' };
                          
                          const startDateStr = start.toLocaleDateString('en-GB', dateOpts);
                          const endDateStr = end.toLocaleDateString('en-GB', dateOpts);
                          const startTimeStr = start.toLocaleTimeString('en-GB', timeOpts);
                          const endTimeStr = end.toLocaleTimeString('en-GB', timeOpts);

                          if (startDateStr === endDateStr) {
                            return `${startDateStr} ${startTimeStr} - ${endTimeStr}`;
                          } else {
                            return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`;
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Quota Progress */}
                  <div style={{ marginTop: "auto", marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 900, marginBottom: 6 }}>
                      <span style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.thQuota.toUpperCase()}</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {evt.attendeeCount || 0} / {evt.quota || "∞"}
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                      <div style={{
                        width: `${evt.quota ? Math.min(100, ((evt.attendeeCount || 0) / evt.quota) * 100) : 0}%`,
                        height: "100%",
                        background: evt.quota && (evt.attendeeCount || 0) >= evt.quota ? "var(--red-house)" : "var(--accent-primary)",
                        borderRadius: 99,
                        transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)"
                      }} />
                    </div>
                    {((evt.quotaThai !== null && evt.quotaThai > 0) || (evt.quotaInternational !== null && evt.quotaInternational > 0)) && (
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                        {evt.quotaThai !== null && evt.quotaThai > 0 && (
                          <span>Thai Limit: <strong style={{ color: "var(--text-secondary)" }}>{evt.quotaThai}</strong></span>
                        )}
                        {evt.quotaInternational !== null && evt.quotaInternational > 0 && (
                          <span>{"Int'l Limit:"} <strong style={{ color: "var(--text-secondary)" }}>{evt.quotaInternational}</strong></span>
                        )}
                      </div>
                    )}
                  </div>

                   {/* Actions */}
                   <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
                     <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                       <button
                         className="btn btn-primary"
                         style={{ flex: 1, height: 44, borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                         onClick={() => viewAttendance(evt.id)}
                       >
                         <BarChart3 size={15} /> {lang === "th" ? "การเช็คอิน" : lang === "cn" ? "签到情况" : lang === "mm" ? "ချက်အင်ဝင်ရောက်မှု" : "Attendance"}
                       </button>
                       <button
                          className="btn"
                          style={{ 
                            flex: 1, 
                            height: 44, 
                            borderRadius: 12, 
                            fontSize: 13, 
                            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", 
                            color: "#fff",
                            border: "none",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            gap: 6,
                            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)",
                            cursor: "pointer"
                          }}
                          onClick={() => openFormBuilder(evt.id, evt.title)}
                        >
                          <ClipboardList size={14} /> {lang === "th" ? "แบบประเมิน" : lang === "cn" ? "评估表单" : lang === "mm" ? "အကဲဖြတ်ပုံစံ" : "Feedback Form"}
                        </button>
                     </div>
                     <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                       <button
                         className="btn btn-ghost"
                         style={{ flex: 1, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(0,0,0,0.03)", fontSize: 13 }}
                         onClick={() => handleEdit(evt)}
                       >
                         <Edit2 size={13} /> {t.eventEditBtnLabel || "Edit"}
                       </button>
                       <button
                         id={`delete-event-${evt.id}-btn`}
                         className="btn btn-danger"
                         style={{ flex: 1, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}
                         disabled={deletingId === evt.id}
                         onClick={() => handleDelete(evt.id)}
                       >
                         {deletingId === evt.id ? <div className="spinner w-4 h-4 border-2" /> : <Trash2 size={13} />} {t.eventDeleteBtnLabel || "Delete"}
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

        /* Attendance Modal Responsive Styles */
        .attendance-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(16px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(12px, 3vw, 24px);
        }
        .attendance-modal-container {
          background: var(--bg-surface);
          width: 100%;
          max-width: 1100px;
          height: 100%;
          max-height: 90vh;
          border-radius: clamp(20px, 4vw, 40px);
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border-medium);
          box-shadow: 0 50px 120px rgba(0,0,0,0.4);
          position: relative;
        }
        .attendance-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(to right, var(--bg-surface), var(--bg-elevated));
          flex-shrink: 0;
        }
        .attendance-modal-header h2 {
          font-size: clamp(18px, 4vw, 28px);
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 0;
        }
        .attendance-modal-filter-bar {
          padding: 12px 20px;
          background: var(--bg-elevated);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .attendance-modal-list {
          overflow-y: auto;
          flex: 1;
          padding: 20px;
        }

        @media (min-width: 1024px) {
          .attendance-modal-header {
            padding: 24px 40px;
          }
          .attendance-modal-header h2 {
            font-size: 32px;
          }
          .attendance-modal-filter-bar {
            padding: 16px 40px;
            gap: 16px;
          }
          .attendance-modal-list {
            padding: 40px;
          }
        }
      `}</style>
      </div>

      {/* Evaluation Form Builder Modal */}
      {showFormBuilder && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          zIndex: 2200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(12px, 3vw, 24px)"
        }} onClick={() => setShowFormBuilder(false)}>
          <div className="animate-fade-in-up custom-scrollbar" style={{
            background: "var(--bg-surface)",
            width: "100%",
            maxWidth: 800,
            maxHeight: "92vh",
            borderRadius: "clamp(20px, 4vw, 32px)",
            overflowY: "auto",
            boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ padding: "20px clamp(16px, 5vw, 40px)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 900, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{lang === "th" ? "แบบประเมินผู้เข้าร่วม" : lang === "cn" ? "互动反馈" : lang === "mm" ? "အပြန်အလှန် အကြံပြုချက်" : "Interactive Feedback"}</span>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{formEventTitle || "Event"} Form</h3>
              </div>
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowFormBuilder(false)} 
                style={{ borderRadius: "50%", width: 40, height: 40, padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
              <button
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  fontSize: 14,
                  fontWeight: 800,
                  border: "none",
                  borderBottom: formTab === "edit" ? "3px solid var(--accent-primary)" : "3px solid transparent",
                  background: "transparent",
                  color: formTab === "edit" ? "var(--accent-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onClick={() => setFormTab("edit")}
              >
                📝 {lang === "th" ? "ออกแบบฟอร์มและกฎ" : lang === "cn" ? "设计表单与规则" : lang === "mm" ? "ပုံစံနှင့် စည်းကမ်းများ ဒီဇိုင်းဆွဲရန်" : "Design Form & Rules"}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  fontSize: 14,
                  fontWeight: 800,
                  border: "none",
                  borderBottom: formTab === "stats" ? "3px solid var(--accent-primary)" : "3px solid transparent",
                  background: "transparent",
                  color: formTab === "stats" ? "var(--accent-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onClick={() => setFormTab("stats")}
              >
                🏆 {lang === "th" ? "กระดานผู้นำบ้านและการส่งข้อมูล" : lang === "cn" ? "学院排行榜与提交" : lang === "mm" ? "အိမ်တော် ဦးဆောင်သူစာရင်းနှင့် တင်သွင်းမှုများ" : "House Leaderboard & Submissions"} ({formSubmissions.length})
              </button>
            </div>

            {/* Modal Body */}
            {formLoading ? (
              <div style={{ padding: "80px 0", textAlign: "center" }}>
                <div className="spinner w-8 h-8 border-4 border-t-transparent" style={{ margin: "0 auto 16px" }} />
                <p style={{ color: "var(--text-muted)", fontWeight: 700 }}>Fetching evaluation system data...</p>
              </div>
            ) : (
              <div style={{ padding: "clamp(16px, 5vw, 40px)" }}>
                {formBuilderSuccess && (
                  <div className="animate-fade-in" style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 16,
                    padding: "16px 20px",
                    marginBottom: 28,
                    color: "#10b981",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 10
                  }}>
                    <span style={{ fontSize: 16 }}>✅</span> {formBuilderSuccess}
                  </div>
                )}

                {formBuilderError && (
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
                    <span style={{ fontSize: 16 }}>⚠️</span> {formBuilderError}
                  </div>
                )}
                {formTab === "edit" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* General Settings */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 24 }}>
                      {/* Left Panel */}
                      <div style={{ background: "var(--bg-elevated)", padding: 24, borderRadius: 24, border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 16 }}>
                        <div className="field">
                          <label className="label" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--text-secondary)" }}>{t.eventFormTitleLabel}</label>
                          <input
                            type="text"
                            className="input"
                            style={{ width: "100%", height: 46, borderRadius: 12, padding: "0 16px" }}
                            value={formTitle}
                            onChange={e => setFormTitle(e.target.value)}
                            placeholder="e.g. Event Satisfaction Survey"
                          />
                        </div>
                        <div className="field">
                          <label className="label" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--text-secondary)" }}>{t.eventFormInstructionLabel}</label>
                          <textarea
                            className="input custom-scrollbar"
                            style={{ width: "100%", minHeight: 80, borderRadius: 12, padding: "12px 16px", resize: "vertical" }}
                            value={formDescription}
                            onChange={e => setFormDescription(e.target.value)}
                            placeholder="Helpful prompt text for students..."
                          />
                        </div>
                      </div>
                      
                      {/* Right Panel */}
                      <div style={{ background: "var(--bg-elevated)", padding: 24, borderRadius: 24, border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
                        <div className="field">
                          <label className="label" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Zap size={14} style={{ color: "var(--accent-primary)" }} /> House Points Reward
                          </label>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Winning house gets these points.</p>
                          <input
                            type="number"
                            className="input"
                            style={{ width: "100%", height: 46, borderRadius: 12, padding: "0 16px", fontWeight: 800 }}
                            value={formPoints}
                            onChange={e => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))}
                          />
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: formIsAwarded ? "#10b981" : (formIsActive ? "var(--green-house)" : "var(--text-muted)")
                            }} />
                            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-secondary)" }}>
                              Status: {formIsAwarded ? "Finalized & Awarded" : (formIsActive ? "Accepting Entries" : "Closed / Inactive")}
                            </span>
                          </div>
                          
                          <button
                            type="button"
                            className={`btn ${formIsActive ? "btn-danger" : "btn-primary"}`}
                            style={{
                              width: "100%",
                              height: 38,
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6
                            }}
                            disabled={formIsAwarded}
                            onClick={toggleFormActiveStatus}
                          >
                            {formIsAwarded ? (
                              <>🔒 Locked (Points Awarded)</>
                            ) : formIsActive ? (
                              <>🔒 Close Form (Disable Entries)</>
                            ) : (
                              <>🔓 Open Form (Enable Entries)</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Questions Section */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--accent-primary)", color: "#fff", fontSize: 12 }}>{formQuestions.length}</span>
                          Form Questions
                        </h4>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            borderRadius: 12,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 800,
                            background: "rgba(255,107,0,0.1)",
                            color: "var(--accent-primary)",
                            border: "none",
                            cursor: "pointer"
                          }}
                          onClick={addQuestion}
                        >
                          ➕ {t.eventAddQuestionLabel}
                        </button>
                      </div>

                      {formQuestions.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--bg-elevated)", borderRadius: 20, border: "1px dashed var(--border-subtle)", color: "var(--text-muted)" }}>
                          {lang === "th" ? "ยังไม่มีคำถาม เพิ่มคำถามแรกกันเลย!" : lang === "cn" ? "尚未添加问题，添加第一个问题吧！" : lang === "mm" ? "မေးခွန်းများမရှိသေးပါ၊ ပထမဦးဆုံးမေးခွန်းကို ထည့်ပါ" : "No questions added yet. Add your first question!"}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {formQuestions.map((q, idx) => (
                            <div 
                              key={q.id || idx} 
                              style={{ 
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                                background: "var(--bg-elevated)", 
                                padding: "20px", 
                                borderRadius: 20,
                                border: "1px solid var(--border-subtle)"
                              }}
                            >
                              {/* Question Main Controls Row */}
                              <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {/* Label Input */}
                                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: "1 1 auto", width: "100%" }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: "var(--text-muted)", width: 20 }}>{idx + 1}.</span>
                                  <input
                                    type="text"
                                    className="input"
                                    style={{ flex: 1, height: 40, borderRadius: 10, padding: "0 12px" }}
                                    value={q.label}
                                    onChange={e => updateQuestion(q.id, "label", e.target.value)}
                                    placeholder={lang === "th" ? "ข้อความคำถาม..." : lang === "cn" ? "问题内容..." : lang === "mm" ? "မေးခွန်းစာသား..." : "Question Text..."}
                                  />
                                </div>

                                {/* Controls Container */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", width: "100%", justifyContent: "flex-end" }} className="md:w-auto">
                                  {/* Type Select */}
                                  <select
                                    className="input"
                                    style={{ height: 40, borderRadius: 10, padding: "0 12px", background: "var(--bg-surface)", cursor: "pointer", fontWeight: 700, fontSize: 13, flex: "1 1 auto", minWidth: 160 }}
                                    value={q.type}
                                    onChange={e => updateQuestion(q.id, "type", e.target.value)}
                                  >
                                    <option value="text">{lang === "th" ? "คำตอบแบบยาว" : lang === "cn" ? "长答题" : lang === "mm" ? "စာသားအဖြေရှည်" : "Long Answer"}</option>
                                    <option value="rating">{lang === "th" ? "คะแนนเรตติ้ง (1-5 ดาว)" : lang === "cn" ? "评分 (1-5 星)" : lang === "mm" ? "ကြယ်ပွင့်အဆင့်သတ်မှတ်ချက် (၁-၅)" : "Rating (1-5 Star)"}</option>
                                    <option value="choice">{lang === "th" ? "หลายตัวเลือก (เลือกได้ 1 ข้อ)" : lang === "cn" ? "单选题" : lang === "mm" ? "ရွေးချယ်စရာများစွာ (တစ်ခုရွေးရန်)" : "Multiple Choice"}</option>
                                    <option value="multiple">{lang === "th" ? "เครื่องหมายเลือก (เลือกได้หลายข้อ)" : lang === "cn" ? "多选题" : lang === "mm" ? "ရွေးချယ်စရာများစွာ (အများကြီးရွေးရန်)" : "Checkbox"}</option>
                                  </select>

                                  {/* Required Toggle */}
                                  <button
                                    type="button"
                                    style={{
                                      padding: "6px 12px",
                                      height: 40,
                                      borderRadius: 10,
                                      border: "none",
                                      background: q.required ? "rgba(16,185,129,0.1)" : "rgba(0,0,0,0.03)",
                                      color: q.required ? "#10b981" : "var(--text-muted)",
                                      whiteSpace: "nowrap",
                                      fontWeight: 800,
                                      fontSize: 11,
                                      cursor: "pointer"
                                    }}
                                    onClick={() => updateQuestion(q.id, "required", !q.required)}
                                  >
                                    {q.required ? t.eventRequiredLabel : (lang === "th" ? "ไม่บังคับ" : lang === "cn" ? "选填" : lang === "mm" ? "ရွေးချယ်နိုင်သည်" : "Optional")}
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    style={{ width: 40, height: 40, padding: 0, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                                    onClick={() => removeQuestion(q.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Google Forms-like Options Builder */}
                              {(q.type === "choice" || q.type === "multiple") && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 32, borderTop: "1px dashed var(--border-subtle)", paddingTop: 16 }}>
                                  <span style={{ fontSize: 11, fontWeight: 900, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    {lang === "th" ? "ตัวเลือกคำตอบ" : lang === "cn" ? "选项设置" : lang === "mm" ? "ရွေးချယ်စရာများ" : "Answer Options"}
                                  </span>
                                  {q.options?.map((opt: string, optIdx: number) => (
                                    <div key={optIdx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                                        {q.type === "choice" ? "○" : "□"}
                                      </span>
                                      <input
                                        type="text"
                                        className="input"
                                        style={{ flex: 1, height: 36, borderRadius: 8, padding: "0 12px", fontSize: 13 }}
                                        value={opt}
                                        onChange={e => updateOption(q.id, optIdx, e.target.value)}
                                        placeholder={`Option ${optIdx + 1}`}
                                      />
                                      <button
                                        type="button"
                                        className="btn btn-ghost"
                                        style={{ width: 36, height: 36, padding: 0, color: "#ef4444", borderRadius: 8, fontSize: 14, fontWeight: 800 }}
                                        onClick={() => removeOption(q.id, optIdx)}
                                        disabled={!q.options || q.options.length <= 1}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 800, color: "var(--accent-primary)", padding: "4px 12px", height: 32, borderRadius: 8, marginTop: 4 }}
                                    onClick={() => addOption(q.id)}
                                  >
                                    ➕ {lang === "th" ? "เพิ่มตัวเลือก" : lang === "cn" ? "添加选项" : lang === "mm" ? "ရွေးချယ်စရာထည့်ရန်" : "Add Option"}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, borderTop: "1px solid var(--border-subtle)", paddingTop: 28, marginTop: 12 }}>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        style={{ height: 46, borderRadius: 12, padding: "0 24px" }}
                        onClick={() => setShowFormBuilder(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        type="button"
                        style={{ height: 46, borderRadius: 12, padding: "0 24px" }}
                        disabled={formSaving || formIsAwarded}
                        onClick={saveForm}
                      >
                        {formSaving ? <div className="spinner w-4 h-4 border-2" /> : "Save Form Structure"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    
                    {/* Contest End Actions */}
                    {!formIsAwarded && (
                      <div 
                        style={{ 
                          background: "linear-gradient(135deg, rgba(255,107,0,0.08) 0%, rgba(255,50,0,0.08) 100%)", 
                          border: "1px solid rgba(255,107,0,0.2)", 
                          borderRadius: 24, 
                          padding: "24px 32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 24
                        }}
                      >
                        <div>
                          <h4 style={{ fontSize: 16, fontWeight: 900, color: "var(--accent-primary)", marginBottom: 4 }}>🏆 Declare House Points Winner!</h4>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            This will close this form, calculate which house has completed it the most, and award <b>+{formPoints} PTS</b> immediately!
                          </p>
                        </div>
                        <button
                          className="btn"
                          style={{
                            background: "linear-gradient(135deg, #ff6b00 0%, #ff3d00 100%)",
                            color: "#fff",
                            border: "none",
                            padding: "12px 24px",
                            borderRadius: 14,
                            fontWeight: 900,
                            fontSize: 14,
                            cursor: "pointer",
                            boxShadow: "0 4px 14px rgba(255,107,0,0.3)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                          }}
                          disabled={formAwarding || formSubmissions.length === 0}
                          onClick={awardFormPoints}
                          title={formSubmissions.length === 0 ? "Requires at least 1 submission" : ""}
                        >
                          {formAwarding ? <div className="spinner w-4 h-4 border-2" /> : <Trophy size={16} />} 
                          End & Award Points
                        </button>
                      </div>
                    )}

                    {/* Closed Status Banner */}
                    {!formIsActive && (
                      <div 
                        style={{ 
                          background: "var(--bg-elevated)", 
                          border: "1px solid var(--border-subtle)", 
                          borderRadius: 24, 
                          padding: "24px 32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            width: 44, 
                            height: 44, 
                            borderRadius: "50%", 
                            background: formIsAwarded ? "rgba(16,185,129,0.1)" : "rgba(255,107,0,0.1)", 
                            color: formIsAwarded ? "#10b981" : "var(--accent-primary)" 
                          }}>
                            {formIsAwarded ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
                          </div>
                          <div>
                            <h4 style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>
                              {formIsAwarded ? "Contest Finalized & Closed" : "Evaluation Form Suspended / Closed"}
                            </h4>
                            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                              {formIsAwarded 
                                ? "Points have been awarded to the winning house and this evaluation form is frozen."
                                : "This form is temporarily closed under Design & Rules. You can re-open it or declare points winner above."}
                            </p>
                          </div>
                        </div>
                        
                        {!formIsAwarded ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{
                              height: 38,
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              border: "1px solid var(--border-medium)"
                            }}
                            onClick={toggleFormActiveStatus}
                          >
                            🔓 Re-open Form
                          </button>
                        ) : (
                          <div style={{
                            padding: "8px 16px",
                            borderRadius: 10,
                            background: "rgba(16,185,129,0.1)",
                            color: "#10b981",
                            fontSize: 12,
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}>
                            🔒 Permanent Lock
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats Leaderboard Cards */}
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 900, marginBottom: 20 }}>📊 House Submission Standings</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {["red", "green", "yellow", "blue"].map(hId => {
                          const houseColors: Record<string, string> = {
                            red: "var(--red-house)",
                            green: "var(--green-house)",
                            yellow: "var(--yellow-house)",
                            blue: "var(--blue-house)"
                          };
                          const houseNames: Record<string, string> = {
                            red: t.houseMom || "Mom",
                            green: t.houseTo || "To",
                            yellow: t.houseLuang || "Luang",
                            blue: t.houseMakara || "Makara"
                          };
                          const count = formStats?.[hId] || 0;
                          return (
                            <div 
                              key={hId} 
                              style={{ 
                                background: "var(--bg-elevated)", 
                                border: `1px solid var(--border-subtle)`,
                                borderTop: `5px solid ${houseColors[hId]}`,
                                borderRadius: 16, 
                                padding: 20, 
                                textAlign: "center" 
                              }}
                            >
                              <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>{houseNames[hId]}</p>
                              <p style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)" }}>{count}</p>
                              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>submissions</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* List of Submissions */}
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 900, marginBottom: 20 }}>💬 Student Submissions ({formSubmissions.length})</h4>
                      {formSubmissions.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed var(--border-subtle)", borderRadius: 20 }}>
                          <p style={{ color: "var(--text-muted)", fontWeight: 700 }}>No feedback submissions yet.</p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Once students complete the form, their answers will appear here live!</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {formSubmissions.map((sub, sIdx) => (
                            <div 
                              key={sub.id || sIdx} 
                              style={{ 
                                background: "var(--bg-elevated)", 
                                border: "1px solid var(--border-subtle)", 
                                borderRadius: 20, 
                                padding: 24 
                              }}
                            >
                              {/* Header info */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: sub.houseId === "red" ? "var(--red-house)" : sub.houseId === "green" ? "var(--green-house)" : sub.houseId === "yellow" ? "var(--yellow-house)" : "var(--blue-house)"
                                  }} />
                                  <span style={{ fontWeight: 800, fontSize: 15 }}>{sub.studentName}</span>
                                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>• {sub.studentId}</span>
                                </div>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                  {new Date(sub.submittedAt).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              {/* Answers */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {formQuestions.map((q) => {
                                  const ans = sub.answers?.[q.id];
                                  return (
                                    <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>{q.label}</span>
                                      {q.type === "rating" ? (
                                        <div style={{ display: "flex", gap: 2, color: "#ffb000" }}>
                                          {Array.from({ length: 5 }).map((_, starIdx) => (
                                            <span key={starIdx} style={{ fontSize: 16 }}>
                                               {starIdx < (typeof ans === "number" ? ans : typeof ans === "string" ? parseInt(ans) || 0 : 0) ? "★" : "☆"}
                                            </span>
                                          ))}
                                        </div>
                                      ) : Array.isArray(ans) ? (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                                          {ans.length > 0 ? (
                                            ans.map((item: string, itemIdx: number) => (
                                              <span
                                                key={itemIdx}
                                                style={{
                                                  fontSize: 12,
                                                  fontWeight: 800,
                                                  background: "rgba(255,107,0,0.08)",
                                                  color: "var(--accent-primary)",
                                                  padding: "4px 8px",
                                                  borderRadius: 8,
                                                  border: "1px solid rgba(255,107,0,0.15)"
                                                }}
                                              >
                                                {item}
                                              </span>
                                            ))
                                          ) : (
                                            <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>No selection</span>
                                          )}
                                        </div>
                                      ) : (
                                        <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "pre-wrap" }}>
                                          {ans || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No answer</span>}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirm Modal for Awarding Contest Points */}
      {showAwardConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 2300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }} onClick={() => setShowAwardConfirm(false)}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "100%",
            maxWidth: 480,
            borderRadius: 28,
            padding: 36,
            textAlign: "center",
            boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,107,0,0.1)",
              color: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px"
            }}>
              <Trophy size={32} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", marginBottom: 12 }}>End Evaluation Contest?</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
              Are you sure you want to end this evaluation form session and award the points? This will freeze the form and update house standings immediately!
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, height: 46, borderRadius: 12 }}
                onClick={() => setShowAwardConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #ff6b00 0%, #ff3d00 100%)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 800,
                  boxShadow: "0 4px 14px rgba(255,107,0,0.3)"
                }}
                disabled={formAwarding}
                onClick={() => {
                  setShowAwardConfirm(false);
                  awardFormPointsReal();
                }}
              >
                {formAwarding ? <div className="spinner w-4 h-4 border-2" /> : "Confirm & End"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium custom Confirm Modal */}
      {confirmModal.show && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 2400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }} onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "90%",
            maxWidth: 440,
            borderRadius: 28,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: confirmModal.isDanger ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 107, 0, 0.1)",
              color: confirmModal.isDanger ? "#ef4444" : "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px"
            }}>
              <AlertCircle size={28} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", marginBottom: 12 }}>
              {confirmModal.title}
            </h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, height: 46, borderRadius: 12, fontSize: 14, fontWeight: 700 }}
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 800,
                  background: confirmModal.isDanger 
                    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" 
                    : "linear-gradient(135deg, #ff6b00 0%, #ff3d00 100%)",
                  color: "#fff",
                  border: "none",
                  boxShadow: confirmModal.isDanger 
                    ? "0 4px 14px rgba(239, 68, 68, 0.3)" 
                    : "0 4px 14px rgba(255, 107, 0, 0.3)"
                }}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium custom Error Modal */}
      {errorModal.show && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 2500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }} onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "90%",
            maxWidth: 440,
            borderRadius: 28,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px"
            }}>
              <X size={28} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", marginBottom: 12 }}>
              {errorModal.title}
            </h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
              {errorModal.message}
            </p>
            <button
              className="btn btn-ghost"
              style={{ width: "100%", height: 46, borderRadius: 12, fontSize: 14, fontWeight: 800, border: "1px solid var(--border-medium)" }}
              onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}
            >
              {lang === "th" ? "ปิด" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendance && (
        <div className="attendance-modal-overlay">
          <div className="animate-fade-in-up attendance-modal-container">
            {/* Modal Header */}
            <div className="attendance-modal-header">
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
                <h2 style={{ fontWeight: 900, letterSpacing: "-0.04em" }}>
                  {events.find(e => e.id === activeEventId)?.title || "Attendance List"}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={16} className="text-muted" />
                    <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 15 }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 800 }}>{checkInCount}</span> / <span style={{ color: "var(--text-primary)", fontWeight: 800 }}>{registeredCount}</span> checked in
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

            {/* Filter Bar */}
            {!loadingAttendance && attendance.length > 0 && (
              <div className="attendance-modal-filter-bar">
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setFilterMedical(!filterMedical)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 99,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.2s",
                      border: filterMedical ? "1px solid #ef4444" : "1px solid var(--border-subtle)",
                      background: filterMedical ? "rgba(239, 68, 68, 0.1)" : "var(--bg-surface)",
                      color: filterMedical ? "#ef4444" : "var(--text-secondary)"
                    }}
                  >
                    <HeartPulse size={16} />
                    {filterMedical ? "Showing: Medical Conditions Only" : "Filter: Medical Conditions Only"}
                  </button>

                  <button
                    onClick={() => setFilterNotCheckedIn(!filterNotCheckedIn)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 99,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.2s",
                      border: filterNotCheckedIn ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                      background: filterNotCheckedIn ? "var(--accent-glow)" : "var(--bg-surface)",
                      color: filterNotCheckedIn ? "var(--accent-primary)" : "var(--text-secondary)"
                    }}
                  >
                    <Clock size={16} />
                    {filterNotCheckedIn ? "Showing: Not Checked In Only" : "Filter: Not Checked In Only"}
                  </button>

                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color: filterThai ? "var(--text-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: "8px 16px",
                    borderRadius: 99,
                    background: filterThai ? "rgba(255, 107, 0, 0.08)" : "var(--bg-surface)",
                    border: filterThai ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                    transition: "all 0.2s"
                  }}>
                    <input
                      type="checkbox"
                      checked={filterThai}
                      onChange={(e) => setFilterThai(e.target.checked)}
                      style={{ accentColor: "var(--accent-primary)", width: 15, height: 15, cursor: "pointer" }}
                    />
                    Thai Students
                  </label>

                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color: filterInternational ? "var(--text-primary)" : "var(--text-muted)",
                    cursor: "pointer",
                    padding: "8px 16px",
                    borderRadius: 99,
                    background: filterInternational ? "rgba(255, 107, 0, 0.08)" : "var(--bg-surface)",
                    border: filterInternational ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                    transition: "all 0.2s"
                  }}>
                    <input
                      type="checkbox"
                      checked={filterInternational}
                      onChange={(e) => setFilterInternational(e.target.checked)}
                      style={{ accentColor: "var(--accent-primary)", width: 15, height: 15, cursor: "pointer" }}
                    />
                    International Students
                  </label>
                </div>
                {(filterMedical || filterNotCheckedIn || !filterThai || !filterInternational) && (
                  <p style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={14} className="animate-pulse" />
                    Filtered: Showing {filteredAttendance.length} of {attendance.length} students
                  </p>
                )}
              </div>
            )}

            {loadingAttendance ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                  <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
                  <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 16 }}>Synchronizing records...</p>
                </div>
              </div>
            ) : (
              <div className="attendance-modal-list custom-scrollbar">
                {attendance.length === 0 ? (
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
                ) : filteredAttendance.length === 0 ? (
                  <div style={{ padding: "80px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
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
                      {filterMedical ? <HeartPulse size={40} style={{ color: "#ef4444" }} /> : <Search size={40} />}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
                        {filterMedical 
                          ? "No medical conditions reported" 
                          : filterNotCheckedIn 
                          ? "All registered students checked in!" 
                          : "No students match the filters"}
                      </h3>
                      <p style={{ color: "var(--text-muted)", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
                        {filterMedical 
                          ? `None of the ${attendance.length} checked-in students have reported any medical conditions or allergies for this event.` 
                          : filterNotCheckedIn 
                          ? "Great! Every student registered for this event has successfully checked in."
                          : "Try adjusting your filters to see more students."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                    {Object.entries(groupedAttendance).map(([house, members]: [string, AdminAttendance[]]) => (
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
                            {house === "red" ? t.houseMom : house === "green" ? t.houseTo : house === "yellow" ? t.houseLuang : house === "blue" ? t.houseMakara : house}
                          </h4>
                          <span className="badge" style={{ padding: "6px 16px", borderRadius: 99, background: "var(--bg-surface)", fontWeight: 800, color: "var(--text-secondary)" }}>
                            {members.length} Members
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
                          {members.map((m: AdminAttendance) => (
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
                                      {m.checkInTime ? new Date(m.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }) : "-"}
                                    </p>
                                  </div>
                                </div>
                                {m.medsCheckOption && (
                                  <div style={{ 
                                    display: "inline-flex", 
                                    alignItems: "center", 
                                    gap: 6, 
                                    marginTop: 6, 
                                    padding: "4px 10px", 
                                    borderRadius: 8, 
                                    fontSize: 11, 
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    background: m.medsCheckOption === "brought" 
                                      ? "rgba(16, 185, 129, 0.12)" 
                                      : m.medsCheckOption === "forgot" 
                                      ? "rgba(239, 68, 68, 0.12)" 
                                      : "rgba(59, 130, 246, 0.12)",
                                    color: m.medsCheckOption === "brought" 
                                      ? "#10b981" 
                                      : m.medsCheckOption === "forgot" 
                                      ? "#ef4444" 
                                      : "#3b82f6",
                                    border: m.medsCheckOption === "brought"
                                      ? "1px solid rgba(16, 185, 129, 0.2)"
                                      : m.medsCheckOption === "forgot"
                                      ? "1px solid rgba(239, 68, 68, 0.2)"
                                      : "1px solid rgba(59, 130, 246, 0.2)"
                                  }}>
                                    <span style={{ 
                                      width: 6, 
                                      height: 6, 
                                      borderRadius: "50%", 
                                      background: m.medsCheckOption === "brought" 
                                        ? "#10b981" 
                                        : m.medsCheckOption === "forgot" 
                                        ? "#ef4444" 
                                        : "#3b82f6",
                                      boxShadow: m.medsCheckOption === "brought"
                                        ? "0 0 8px #10b981"
                                        : m.medsCheckOption === "forgot"
                                        ? "0 0 8px #ef4444"
                                        : "0 0 8px #3b82f6"
                                    }} />
                                    {m.medsCheckOption === "brought" 
                                      ? "Brought Meds / พกยามาด้วย" 
                                      : m.medsCheckOption === "forgot" 
                                      ? "No Meds (Risk) / ไม่ได้พกยา (รับความเสี่ยง)" 
                                      : "Acknowledged / รับทราบข้อมูล"}
                                  </div>
                                )}
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
                                  onClick={() => setSelectedStudent(m.user || null)}
                                >
                                  <Info size={18} />
                                </button>{m.status === "attended" ? (

                                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }} title="Checked In">

                                    <CheckCircle2 size={16} />

                                  </div>

                                ) : (

                                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,107,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)", border: "1px dashed var(--accent-primary)" }} title="Registered (Not Checked In)">

                                    <Clock size={14} className="animate-pulse" />

                                  </div>

                                )}
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
          zIndex: 2100,
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
                  {selectedStudent.emergencyMedication && selectedStudent.emergencyMedication.trim() !== "-" && <p style={{ fontSize: 14 }}><b>Emergency Medication:</b> <span style={{ color: "#ef4444", fontWeight: 700 }}>{selectedStudent.emergencyMedication}</span></p>}
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
                  {selectedStudent.emergencyContacts.map((c: EmergencyContact, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>
                          {c.name} ({c.relationship.startsWith("Other:") ? c.relationship.substring(6) : c.relationship})
                        </p>
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
    </>
  );
}