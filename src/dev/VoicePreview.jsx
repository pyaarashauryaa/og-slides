// DEV ONLY (?preview=voice): renders the voice-note bubble with stand-in message objects so the player, errors and
// retry can be looked at and tested without CometChat. It is never part of the real app screens.
import VoiceBubble from "../components/VoiceBubble.jsx";

const msg = ({ url = "", meta = {} } = {}) => ({
  getMetadata: () => meta,
  getAttachment: () => (url ? { getUrl: () => url, getName: () => "voice-note.wav", getMimeType: () => "audio/wav" } : null),
});
const base = typeof location !== "undefined" ? location.origin : "";
const peaks = Array.from({ length: 36 }, (_, i) => 20 + Math.round(70 * Math.abs(Math.sin(i / 3))));

function wavBlob(seconds = 2) {
  const rate = 8000, n = rate * seconds, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 12) * 8000, true);
  return new Blob([buf], { type: "audio/wav" });
}
const localFile = new File([wavBlob(2)], "voice-note-test.wav", { type: "audio/wav" });

export default function VoicePreview() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 420 }}>
      <h1>Voice bubble preview</h1>
      <section aria-label="Received, with duration and waveform"><VoiceBubble message={msg({ url: `${base}/__t/ok.wav`, meta: { audioType: "voice_note", duration: 2, peaks } })} alignment="left" /></section>
      <section aria-label="Second note"><VoiceBubble message={msg({ url: `${base}/__t/ok2.wav`, meta: { audioType: "voice_note" } })} alignment="right" /></section>
      <section aria-label="File missing"><VoiceBubble message={msg({ url: `${base}/__t/missing.wav`, meta: { audioType: "voice_note" } })} alignment="left" /></section>
      <section aria-label="Still sending"><VoiceBubble message={msg({ meta: { audioType: "voice_note", file: localFile, duration: 2 } })} alignment="right" /></section>
      <section aria-label="No audio"><VoiceBubble message={msg({})} alignment="left" /></section>
    </main>
  );
}
