import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // Already authenticated & profile complete → go to dashboard
  if (session?.user && (session.user as any).profileCompleted) {
    redirect("/dashboard");
  }
  // Authenticated but no profile → onboarding
  if (session?.user && !(session.user as any).profileCompleted) {
    redirect("/onboarding");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background gradient orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(108,110,255,0.15) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-60%, -55%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(108,110,255,0.08) 0%, transparent 70%)",
          bottom: "10%",
          right: "5%",
        }}
      />

      {/* Main card */}
      <main
        className="relative z-10 flex flex-col items-center gap-8 p-10 animate-fade-in-up"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-2xl)",
          maxWidth: 460,
          width: "calc(100% - 32px)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="animate-pulse-glow"
            style={{
              width: 64,
              height: 64,
              borderRadius: "var(--radius-lg)",
              background:
                "linear-gradient(135deg, var(--accent-primary), #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.04em",
            }}
          >
            A
          </div>
          <div className="text-center">
            <h1
              className="gradient-text"
              style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              ActiveCAMT
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginTop: 6,
              }}
            >
              CAMT Student Activity Hub
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="divider" style={{ width: "100%", margin: 0 }} />

        {/* Sign-in section */}
        <div className="flex flex-col items-center gap-5" style={{ width: "100%" }}>
          <div className="text-center">
            <p
              style={{
                fontSize: 15,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              Sign in with your{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                @cmu.ac.th
              </span>{" "}
              account to access events, house points, and your digital ID.
            </p>
          </div>

          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
            style={{ width: "100%" }}
          >
            <button
              id="google-signin-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              style={{ gap: 12 }}
            >
              {/* Google icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>
          </form>

          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Access restricted to{" "}
            <code
              style={{
                background: "var(--bg-elevated)",
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              @cmu.ac.th
            </code>{" "}
            accounts only
          </p>
        </div>
      </main>
    </div>
  );
}
