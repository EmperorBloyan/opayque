"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "28rem", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "2rem", padding: "2rem", textAlign: "center", background: "#09090b" }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#71717a" }}>Fatal Terminal Error</p>
            <h2 style={{ marginTop: "0.75rem", fontSize: "1.5rem", fontWeight: 900 }}>The terminal interface is recovering from a runtime crash.</h2>
            <p style={{ marginTop: "0.75rem", fontSize: "0.95rem", color: "#a1a1aa" }}>A graceful fallback screen is now active to prevent the checkout flow from collapsing.</p>
            <button onClick={() => reset()} style={{ marginTop: "1.5rem", borderRadius: "999px", background: "#fff", color: "#000", padding: "0.75rem 1rem", fontWeight: 900, textTransform: "uppercase" }}>
              Recover UI
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
