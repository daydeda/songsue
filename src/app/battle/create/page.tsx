"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { StudentNav } from "@/components/layout/StudentNav";

export default function CreateRoomPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function create() {
      try {
        const res = await fetch("/api/battle/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "ox" }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create room");
        }

        const room = await res.json();
        router.replace(`/battle/room/${room.roomCode}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    }
    create();
  }, [router]);

  return (
    <>
      <StudentNav />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "80px 24px", textAlign: "center" }}>
        {error ? (
          <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", padding: "24px", borderRadius: "var(--radius-lg)", color: "#991b1b", maxWidth: 400 }}>
            <h2 style={{ fontWeight: 700, marginBottom: 8, fontSize: "1.25rem" }}>เกิดข้อผิดพลาด</h2>
            <p style={{ fontSize: 14 }}>{error}</p>
            <button className="btn" style={{ background: "var(--text-primary)", color: "#fff", marginTop: 16 }} onClick={() => router.push("/battle")}>
              กลับอารีน่า
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: "var(--accent-glow)", color: "var(--accent-primary)", marginBottom: 20 }}>
              <Swords size={40} className="pulse" />
            </div>
            <div className="spinner" style={{ marginBottom: 16 }}></div>
            <h2 style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--text-primary)" }}>กำลังสร้างห้องประลอง...</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 4 }}>กำลังจองเซสชันบนเซิร์ฟเวอร์ P2P</p>
          </div>
        )}
      </div>
    </>
  );
}
