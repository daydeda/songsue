"use client";

import { useEffect, useState } from "react";

type Event = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  quota?: number;
  pointsAwarded: number;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  startTime: "",
  endTime: "",
  quota: 100,
  location: "",
  pointsAwarded: 0,
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/events");
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const set = (k: string, v: any) => setFormData((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      }),
    });
    if (res.ok) {
      setFormData(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      await fetchEvents();
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save event");
    }
    setSubmitting(false);
  };

  const handleEdit = (evt: Event) => {
    const toLocal = (iso: string) => new Date(iso).toISOString().slice(0, 16);
    setFormData({
      title: evt.title,
      description: evt.description ?? "",
      startTime: toLocal(evt.startTime),
      endTime: toLocal(evt.endTime),
      quota: evt.quota ?? 100,
      location: evt.location ?? "",
      pointsAwarded: evt.pointsAwarded ?? 0,
    });
    setEditingId(evt.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
    setDeletingId(id);
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    await fetchEvents();
    setDeletingId(null);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p className="section-title">Admin Panel</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>Manage Events</h1>
        </div>
        <button
          id="new-event-btn"
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormData(EMPTY_FORM);
            setShowForm(!showForm);
          }}
        >
          {showForm ? "✕ Cancel" : "+ New Event"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="animate-fade-in-up"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-lg)",
            padding: 28,
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
            {editingId ? "Edit Event" : "Create New Event"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="field">
                <label className="label">Event Title *</label>
                <input className="input" required value={formData.title} onChange={(e) => set("title", e.target.value)} placeholder="Freshmen Welcome 2026" />
              </div>
              <div className="field">
                <label className="label">Location</label>
                <input className="input" value={formData.location} onChange={(e) => set("location", e.target.value)} placeholder="CAMT Main Hall" />
              </div>
              <div className="field">
                <label className="label">Start Time *</label>
                <input className="input" required type="datetime-local" value={formData.startTime} onChange={(e) => set("startTime", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">End Time *</label>
                <input className="input" required type="datetime-local" value={formData.endTime} onChange={(e) => set("endTime", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Participant Quota</label>
                <input className="input" type="number" min={1} value={formData.quota} onChange={(e) => set("quota", Number(e.target.value))} />
              </div>
              <div className="field">
                <label className="label">Points Awarded</label>
                <input className="input" type="number" min={0} value={formData.pointsAwarded} onChange={(e) => set("pointsAwarded", Number(e.target.value))} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={3}
                value={formData.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe the event..."
                style={{ resize: "vertical" }}
              />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠️</span> {error}</div>}
            <div style={{ display: "flex", gap: 12 }}>
              <button id="submit-event-btn" type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><div className="spinner" />Saving…</> : editingId ? "Update Event" : "Create Event"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Events table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Location</th>
                  <th>Start</th>
                  <th>Quota</th>
                  <th>Points</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      No events yet. Click "+ New Event" to create one.
                    </td>
                  </tr>
                )}
                {events.map((evt) => {
                  const isPast = new Date(evt.endTime) < new Date();
                  return (
                    <tr key={evt.id}>
                      <td>
                        <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{evt.title}</p>
                        {evt.description && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            {evt.description.slice(0, 60)}…
                          </p>
                        )}
                      </td>
                      <td>{evt.location ?? "—"}</td>
                      <td>
                        <span className={isPast ? "badge" : "badge badge-blue"}
                          style={isPast ? { background: "var(--bg-glass)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" } : {}}>
                          {new Date(evt.startTime).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td>{evt.quota ?? "∞"}</td>
                      <td>
                        <span className="badge badge-purple">{evt.pointsAwarded} pts</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(evt)}>Edit</button>
                          <button
                            id={`delete-event-${evt.id}-btn`}
                            className="btn btn-danger btn-sm"
                            disabled={deletingId === evt.id}
                            onClick={() => handleDelete(evt.id)}
                          >
                            {deletingId === evt.id ? <div className="spinner" /> : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}