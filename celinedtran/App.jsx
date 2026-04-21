import { useState, useEffect } from "react";

const NAV = ["about", "work", "contact"];

const PROJECTS = [
  {
    id: 1,
    title: "Project One",
    category: "Design",
    year: "2025",
    description: "A short description of what this project was about and what you built.",
  },
  {
    id: 2,
    title: "Project Two",
    category: "Development",
    year: "2024",
    description: "A short description of what this project was about and what you built.",
  },
  {
    id: 3,
    title: "Project Three",
    category: "Design & Dev",
    year: "2024",
    description: "A short description of what this project was about and what you built.",
  },
];

export default function App() {
  const [active, setActive] = useState("about");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
  }, []);

  return (
    <div style={{
      fontFamily: "'DM Serif Display', Georgia, serif",
      minHeight: "100vh",
      background: "#faf8f5",
      color: "#1a1814",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.7s ease",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #faf8f5; }

        .nav-link {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 300;
          letter-spacing: 0.12em;
          text-transform: lowercase;
          color: #888;
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

        .project-row {
          display: grid;
          grid-template-columns: 48px 1fr 80px 90px;
          gap: 0 24px;
          align-items: baseline;
          padding: 20px 0;
          border-bottom: 1px solid #e8e4dd;
          cursor: default;
          transition: background 0.15s;
        }
        .project-row:hover { background: #f3f0ea; margin: 0 -32px; padding-left: 32px; padding-right: 32px; }

        .tag {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          background: #ede9e0;
          color: #666;
          padding: 3px 8px;
          border-radius: 2px;
          white-space: nowrap;
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

        @media (max-width: 600px) {
          .project-row { grid-template-columns: 1fr 90px; }
          .project-row .proj-num, .project-row .proj-cat { display: none; }
        }
      `}</style>

      {/* Header */}
      <header style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 32px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1 }}>
            Celine Tran
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "#999",
            marginTop: 6,
            fontWeight: 300,
          }}>
            designer & developer
          </p>
        </div>
        <nav style={{ display: "flex", gap: 24 }}>
          {NAV.map(n => (
            <button
              key={n}
              className={`nav-link ${active === n ? "active" : ""}`}
              onClick={() => setActive(n)}
            >
              {n}
            </button>
          ))}
        </nav>
      </header>

      {/* Divider */}
      <div style={{ maxWidth: 720, margin: "32px auto 0", padding: "0 32px" }}>
        <div style={{ height: 1, background: "#1a1814" }} />
      </div>

      {/* Content */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 96px" }}>

        {active === "about" && (
          <div key="about" className="section">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px 64px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ fontSize: 28, lineHeight: 1.45, fontStyle: "italic", maxWidth: 520, color: "#2a2520" }}>
                  I build things for the web — with care for craft, detail, and the people who use them.
                </p>
              </div>
              <div>
                <h2 style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#999", marginBottom: 16, fontWeight: 400 }}>
                  BACKGROUND
                </h2>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 300, lineHeight: 1.75, color: "#555" }}>
                  Based somewhere creative. Interested in the intersection of design systems, frontend engineering, and interfaces that feel good to use.
                </p>
              </div>
              <div>
                <h2 style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#999", marginBottom: 16, fontWeight: 400 }}>
                  CURRENTLY
                </h2>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 300, lineHeight: 1.75, color: "#555" }}>
                  Open to new opportunities. Working on personal projects and exploring what's next.
                </p>
              </div>
            </div>
          </div>
        )}

        {active === "work" && (
          <div key="work" className="section">
            <div style={{ borderTop: "1px solid #e8e4dd" }}>
              {PROJECTS.map((p, i) => (
                <div key={p.id} className="project-row">
                  <span className="proj-num" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#bbb", fontWeight: 300 }}>
                    0{i + 1}
                  </span>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 400, marginBottom: 4 }}>{p.title}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888", fontWeight: 300 }}>{p.description}</p>
                  </div>
                  <span className="proj-cat tag">{p.category}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#bbb", fontWeight: 300, textAlign: "right" }}>{p.year}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "contact" && (
          <div key="contact" className="section">
            <p style={{ fontSize: 26, fontStyle: "italic", lineHeight: 1.5, marginBottom: 48, maxWidth: 400 }}>
              Let's make something together.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { label: "Email", href: "mailto:hello@celinedtran.com", text: "hello@celinedtran.com" },
                { label: "GitHub", href: "https://github.com/ctran37", text: "github.com/ctran37" },
                { label: "LinkedIn", href: "#", text: "linkedin.com/in/celinedtran" },
              ].map(({ label, href, text }) => (
                <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#bbb", width: 60, flexShrink: 0 }}>
                    {label.toUpperCase()}
                  </span>
                  <a href={href} className="contact-link">{text}</a>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "0 32px 40px",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ccc", fontWeight: 300 }}>
          celinedtran.com
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#ccc", fontWeight: 300 }}>
          {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
