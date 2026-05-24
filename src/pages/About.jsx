const CONTACT = [
  { label: "GitHub", href: "https://github.com/ctran37", text: "github.com/ctran37" },
  { label: "LinkedIn", href: "#", text: "linkedin.com/in/celinedtran" },
];

export default function About() {
  return (
    <div className="section">
        <div style={{ gridColumn: "1 / -1", marginTop: 16 }}>
          <h2 className="label-eyebrow" style={{ marginBottom: 20 }}>
            Get in touch
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {CONTACT.map(({ label, href, text }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "baseline", gap: 24 }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    color: "#bbb",
                    width: 60,
                    flexShrink: 0,
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
                <a href={href} className="contact-link">
                  {text}
                </a>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}