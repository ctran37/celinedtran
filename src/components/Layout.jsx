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
        minHeight: "100vh",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
      }}
    >
      <header
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 32px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <NavLink to="/" style={{ textDecoration: "none", color: "#1a1814" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              lineHeight: 1,
              color: "#1a1814",
            }}
          >
            Celine Tran
          </h1>
          <p
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "#999",
              marginTop: 6,
            }}
          >
            software engineer
          </p>
        </NavLink>
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
