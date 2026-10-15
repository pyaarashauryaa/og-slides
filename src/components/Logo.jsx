// The OGSlides mark: two stacked paper slides, the front one with a speech-bubble tail.
// It is the same "paper" language as the mascot, so the brand reads as one family.
export default function Logo({ size = 40 }) {
  return (
    <div className="logo">
      <svg className="logo__mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <rect x="9" y="5" width="32" height="24" rx="5" transform="rotate(8 25 17)" fill="var(--butter)" stroke="var(--ink)" strokeWidth="2.4" />
        <path
          d="M8 11h28a5 5 0 0 1 5 5v17a5 5 0 0 1-5 5H24l-8 6v-6h-8a5 5 0 0 1-5-5V16a5 5 0 0 1 5-5z"
          fill="var(--rani)"
          stroke="var(--ink)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <rect x="11" y="19" width="22" height="3.2" rx="1.6" fill="#fff" />
        <rect x="11" y="26" width="14" height="3.2" rx="1.6" fill="#fff" opacity=".8" />
      </svg>
      <span className="logo__word">
        OG<span>Slides</span>
      </span>
    </div>
  );
}
