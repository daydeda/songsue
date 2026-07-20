"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import Link from "next/link";

// Landing page for the site-wide preview-access activation link
// (users.previewAccess / site_settings.previewAccessToken): a small invited
// group redeems this ONCE to permanently gain early registration access for
// ANY event, everywhere in the site — see the bypass in
// /api/events/[id]/register. This page — not src/proxy.ts — owns the
// sign-in/onboarding round-trip so the token in the URL survives it (see the
// "/preview" entry in proxy.ts's isPublicPath).
//
// useSearchParams() requires a Suspense boundary for the build's static-export
// bailout check (this route has no dynamic segment, unlike the per-event
// version this replaced, so Next tries to prerender it) — the actual page is
// in PreviewActivationContent below, wrapped here.
export default function PreviewActivationPage() {
  return (
    <Suspense fallback={null}>
      <PreviewActivationContent />
    </Suspense>
  );
}

function PreviewActivationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const startedRef = useRef(false);

  const profileCompleted = session?.user?.profileCompleted ?? false;

  useEffect(() => {
    if (status === "authenticated" && !profileCompleted) {
      // Carry this page's URL through onboarding via returnTo, so once
      // registration is done the user comes back here to actually redeem
      // the token instead of landing on /dashboard unactivated.
      const returnTo = encodeURIComponent(`/preview?token=${encodeURIComponent(token)}`);
      router.replace(`/onboarding?returnTo=${returnTo}`);
    }
  }, [status, profileCompleted, token, router]);

  useEffect(() => {
    if (status !== "authenticated" || !profileCompleted || !token || startedRef.current) return;
    startedRef.current = true;
    fetch("/api/preview/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          // Eagerly refresh the JWT so session.user.previewAccess flips to
          // true before they navigate to /dashboard — otherwise src/proxy.ts's
          // pre-launch gate sees the stale (still-false) session and bounces a
          // freshly-activated tester right back to "/". Session only auto-
          // refreshes every DB_REFRESH_INTERVAL_MS (2 min) otherwise.
          await update();
          setResult({
            ok: true,
            message: "คุณได้รับสิทธิ์เข้าถึงล่วงหน้าแล้ว ตอนนี้คุณสามารถลงทะเบียนกิจกรรมใดก็ได้ก่อนวันเปิดจริง",
          });
        } else {
          setResult({ ok: false, message: "ลิงก์เข้าถึงไม่ถูกต้องหรือหมดอายุแล้ว" });
        }
      })
      .catch(() => {
        setResult({ ok: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง" });
      });
  }, [status, profileCompleted, token, update]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "var(--bg-elevated)", borderRadius: 20, padding: 32, border: "1px solid var(--border-subtle)", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );

  const heading = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
      <KeyRound size={22} style={{ color: "#6366f1" }} />
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
        สิทธิ์เข้าถึงล่วงหน้า
      </h1>
    </div>
  );

  if (status === "loading") {
    return shell(<p style={{ color: "var(--text-muted)" }}>กำลังโหลด...</p>);
  }

  if (!token) {
    return shell(
      <>
        {heading}
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว
        </p>
      </>
    );
  }

  if (status !== "authenticated") {
    return shell(
      <>
        {heading}
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
          กรุณาเข้าสู่ระบบด้วย Google เพื่อรับสิทธิ์เข้าถึงล่วงหน้า
        </p>
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={() => signIn("google", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" })}
        >
          เข้าสู่ระบบด้วย Google
        </button>
      </>
    );
  }

  if (!profileCompleted) {
    return shell(<p style={{ color: "var(--text-muted)" }}>กำลังเปลี่ยนเส้นทาง...</p>);
  }

  return shell(
    <>
      {heading}
      {!result && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>กำลังโหลด...</p>
      )}
      {result && (
        <>
          <p style={{ fontSize: 14, marginBottom: 20, color: result.ok ? "#10b981" : "#ef4444", fontWeight: 600 }}>
            {result.message}
          </p>
          {result.ok && (
            <Link href="/dashboard" className="btn btn-primary" style={{ width: "100%", display: "inline-block" }}>
              ไปที่หน้าหลัก
            </Link>
          )}
        </>
      )}
    </>
  );
}
