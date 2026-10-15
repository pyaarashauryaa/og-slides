// A small illustration for the Home hero: three overlapping "slides" with chat bubbles.
export default function TeamRoomArt() {
  return (
    <svg className="hero__art" viewBox="0 0 320 240" role="img" aria-label="Three slides with chat bubbles">
      <rect x="22" y="38" width="190" height="124" rx="18" fill="#EEE7FF" transform="rotate(-6 117 100)" />
      <rect x="60" y="52" width="196" height="128" rx="18" fill="#F8C9D9" transform="rotate(4 158 116)" />
      <rect x="44" y="64" width="210" height="136" rx="18" fill="#FFFFFF" stroke="#F0E5EB" strokeWidth="2" />
      <rect x="64" y="86" width="96" height="10" rx="5" fill="#54213B" />
      <rect x="64" y="106" width="150" height="8" rx="4" fill="#F0E5EB" />
      <rect x="64" y="122" width="120" height="8" rx="4" fill="#F0E5EB" />
      <path d="M200 150h52a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12h-30l-12 11v-11h-10a12 12 0 0 1-12-12v-18a12 12 0 0 1 12-12z" style={{ fill: "var(--rani)" }} />
      <circle cx="208" cy="171" r="4" fill="#FFF9F5" />
      <circle cx="224" cy="171" r="4" fill="#FFF9F5" />
      <circle cx="240" cy="171" r="4" fill="#FFF9F5" />
      <path d="M262 44l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" style={{ fill: "var(--rani)" }} />
      <path d="M40 206l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#54213B" opacity=".55" />
    </svg>
  );
}
