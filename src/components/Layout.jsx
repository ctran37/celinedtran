import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { label: "about", to: "/" },
  { label: "roland garros", to: "/roland-garros-2026" },
];

export default function Layout() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        fontFamily: "'DM Serif Display', Georgia, serif",
        minHeight: "100vh",
        background: "#faf8f5",
        color: "#1a1814",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #faf8f5; }

        a { color: inherit; }

        .nav-link {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 300;
          letter-spacing: 0.12em;
          text-transform: lowercase;
          color: #888;
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.2s;
        }
        .nav-link:hover { color: #1a1814; }
        .nav-link.active { color: #1a1814; border-bottom: 1px solid #1a1814; }

        .section {
          opacity: 0;
          transform: translateY(16px);
          animation: fadeUp 0.6s ease forwards;
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        .mono {
          font-family: 'DM Mono', monospace;
          font-weight: 300;
        }

        .label-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.15em;
          color: #999;
          font-weight: 400;
          text-transform: uppercase;
        }

        .contact-link {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 300;
          color: #1a1814;
          text-decoration: none;
          border-bottom: 1px solid #ccc;
          padding-bottom: 1px;
          transition: border-color 0.2s;
        }
        .contact-link:hover { border-color: #1a1814; }

        .btn {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.1em;
          text-transform: lowercase;
          color: #faf8f5;
          background: #1a1814;
          border: 1px solid #1a1814;
          padding: 10px 18px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: background 0.15s, color 0.15s;
        }
        .btn:hover { background: #2a2520; }
        .btn.secondary {
          background: transparent;
          color: #1a1814;
        }
        .btn.secondary:hover { background: #1a1814; color: #faf8f5; }
        .btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .match-card {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 10px 0;
          border-bottom: 1px solid #eee5d8;
        }
        .pick-button {
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 300;
          text-align: left;
          padding: 10px 14px;
          background: #fdfbf6;
          border: 1px solid #eee5d8;
          cursor: pointer;
          transition: all 0.12s;
          color: #1a1814;
        }
        .pick-button:hover { background: #f3efe5; border-color: #d8cfb8; }
        .pick-button.picked {
          background: #1a1814;
          color: #faf8f5;
          border-color: #1a1814;
        }
        .pick-button .seed {
          font-size: 10px;
          color: #aaa;
          margin-right: 6px;
        }
        .pick-button.picked .seed { color: #888; }
        .pick-button .nat {
          font-size: 10px;
          color: #999;
          margin-left: 6px;
        }
        .pick-button.picked .nat { color: #aaa; }
        .pick-button.empty {
          color: #bbb;
          cursor: not-allowed;
          font-style: italic;
        }
        .pick-button.empty:hover { background: #fdfbf6; border-color: #eee5d8; }

        .round-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }
        .round-pill {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          padding: 5px 10px;
          border: 1px solid #e8e4dd;
          background: transparent;
          color: #aaa;
          border-radius: 2px;
          text-transform: uppercase;
        }
        .round-pill.done { color: #1a1814; border-color: #1a1814; background: #fdfbf6; }
        .round-pill.current { color: #1a1814; border-color: #1a1814; background: #1a1814; color: #faf8f5; }

        @media (max-width: 600px) {
          .match-card { grid-template-columns: 1fr; }
        }
      `}</style>

      <header
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 32px 0",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <nav style={{ display: "flex", gap: 24 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: "32px auto 0", padding: "0 32px" }}>
        <div style={{ height: 1, background: "#1a1814" }} />
      </div>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 32px 96px",
        }}
      >
        <Outlet />
      </main>

      <footer
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 32px 40px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 10, color: "#ccc" }}
        >
          celinedtran.com
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, color: "#ccc" }}
        >
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
