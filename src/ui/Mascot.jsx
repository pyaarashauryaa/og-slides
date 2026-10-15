// "Pip": a sheet of paper with a folded corner, two dot eyes and a smile. Drawn in plain SVG so it
// is tiny, crisp at any size and recolourable. mood: happy | wink | oops | think
// Decorative only (aria-hidden), so screen readers never announce it.
const INK = "var(--ink)";

export default function Mascot({ mood = "happy", size = 160, className = "" }) {
  const eyes =
    mood === "wink" ? (
      <>
        <circle cx="42" cy="58" r="4.2" fill={INK} className="mascot__eye" />
        <path d="M66 58q5-5 10 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      </>
    ) : mood === "oops" ? (
      <>
        <path d="M37 54l9 8m0-8l-9 8" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M66 54l9 8m0-8l-9 8" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="42" cy="58" r="4.2" fill={INK} className="mascot__eye" />
        <circle cx="72" cy="58" r="4.2" fill={INK} className="mascot__eye" />
      </>
    );
  const mouth =
    mood === "oops" ? (
      <path d="M46 80q11-9 22 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
    ) : mood === "think" ? (
      <path d="M48 79h18" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    ) : (
      <path d="M45 76q12 13 24 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
    );
  return (
    <svg className={`mascot mascot--${mood} ${className}`} width={size} height={size * 1.12} viewBox="0 0 114 128" aria-hidden="true" focusable="false">
      {/* shadow */}
      <ellipse cx="58" cy="122" rx="30" ry="4.5" fill="rgba(42,23,56,.16)" className="mascot__shadow" />
      <g className="mascot__body">
        {/* paper sheet with a folded top-right corner */}
        <path d="M14 14h64l26 26v70a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V20a6 6 0 0 1 0-6z" fill="var(--paper)" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        <path d="M78 14v20a6 6 0 0 0 6 6h20" fill="var(--butter)" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        {/* cheeks */}
        <ellipse cx="32" cy="70" rx="6.5" ry="4.2" fill="var(--rani)" opacity=".55" />
        <ellipse cx="82" cy="70" rx="6.5" ry="4.2" fill="var(--rani)" opacity=".55" />
        {eyes}
        {mouth}
        {/* little "ruled" lines at the bottom, so it reads as a slide */}
        <path d="M30 97h30M30 106h46" stroke="var(--cobalt)" strokeWidth="3.4" strokeLinecap="round" opacity=".85" />
        {/* tiny arms */}
        <path className="mascot__arm" d="M14 74q-9 3-9 12" stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M104 74q9 3 9 12" stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
