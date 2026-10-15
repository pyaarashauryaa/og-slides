import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCw, Download, TriangleAlert } from "lucide-react";
import { readVoiceMessage, formatClock, playbackProblem } from "../cometchat/voiceNote.js";

// OGSlides' own audio bubble. It plays the stored file with a plain <audio> element, which streams the file and
// does not need the download-and-decode step the chat kit's default bubble uses (that step is what shows
// "Failed to load audio" when the file server or the browser refuses it).
// Only one voice note plays at a time. Nothing here is faked: duration and bars come from the message's own data.

let playing = null; // the pause function of whichever bubble is playing now

const FALLBACK_BARS = [30, 55, 40, 75, 50, 85, 45, 65, 35, 70, 55, 80, 40, 60, 30, 72, 48, 66, 38, 58, 44, 78, 52, 62, 34, 68, 46, 74, 42, 56, 36, 64, 50, 70, 40, 54];

export default function VoiceBubble({ message, alignment = "left" }) {
  const info = useMemo(() => readVoiceMessage(message), [message]);
  // A message that is still being uploaded has only the local file: play it from a temporary link that is
  // revoked afterwards. The temporary link is never stored or sent anywhere.
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (info.url || !info.localFile) { setLocalUrl(""); return undefined; }
    const u = URL.createObjectURL(info.localFile);
    setLocalUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [info.url, info.localFile]);
  const src = info.url || localUrl;
  const uploading = !info.url && Boolean(info.localFile);

  const audio = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | playing | error
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(info.duration || 0);
  const [problem, setProblem] = useState("");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setState(src ? "loading" : "error");
    setProblem(src ? "" : "This voice note has no audio file attached.");
    setTime(0);
    setLength(info.duration || 0);
  }, [src, tries, info.duration]);

  // Stop the audio when the message goes away (changing conversation, scrolling it out, unmounting). The element
  // itself is released with the bubble; src is NOT cleared here, because React StrictMode runs this cleanup once
  // right after mount and would otherwise leave a player with no file.
  useEffect(() => {
    const a = audio.current;
    return () => {
      if (!a) return;
      try { a.pause(); } catch { /* already gone */ }
      if (playing === a.__stop) playing = null;
    };
  }, []);

  const pause = () => { audio.current?.pause(); };
  const toggle = async () => {
    const a = audio.current;
    if (!a || state === "error") return;
    if (!a.paused) { a.pause(); return; }
    if (playing && playing !== pause) playing();
    playing = pause;
    a.__stop = pause;
    try { await a.play(); } catch (e) {
      if (e?.name === "NotAllowedError") setProblem("Your browser blocked playback. Click play again.");
      else { setState("error"); setProblem(playbackProblem(a.error?.code || 4)); }
    }
  };

  const onMeta = (e) => {
    const d = e.currentTarget.duration;
    if (Number.isFinite(d) && d > 0) setLength(d);
    setState((s) => (s === "loading" ? "ready" : s));
  };
  const bars = info.peaks || FALLBACK_BARS;
  const shown = length || 0;
  const pct = shown ? Math.min(100, (time / shown) * 100) : 0;
  const label = state === "playing" ? "Pause voice note" : "Play voice note";

  return (
    <div className={`vbub vbub--${alignment === "right" ? "mine" : "theirs"} is-${state}${uploading ? " is-uploading" : ""}`}>
      <audio
        key={tries}
        ref={audio}
        src={src || undefined}
        preload="metadata"
        onLoadedMetadata={onMeta}
        onDurationChange={onMeta}
        onCanPlay={() => setState((s) => (s === "loading" ? "ready" : s))}
        onPlay={() => { setState("playing"); setProblem(""); }}
        onPause={() => setState((s) => (s === "playing" ? "ready" : s))}
        onEnded={() => { setState("ready"); setTime(0); if (playing === pause) playing = null; }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onError={(e) => { setState("error"); setProblem(playbackProblem(e.currentTarget.error?.code)); }}
      />
      {state === "error" ? (
        <div className="vbub__err" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>{problem}</span>
          <span className="vbub__errbtns">
            {src && <button type="button" className="vbub__link" onClick={() => setTries((n) => n + 1)}><RotateCw size={13} aria-hidden="true" /> Try again</button>}
            {info.url && <a className="vbub__link" href={info.url} target="_blank" rel="noopener noreferrer" download={info.name}><Download size={13} aria-hidden="true" /> Download</a>}
          </span>
        </div>
      ) : (
        <>
          <button type="button" className="vbub__play" onClick={toggle} aria-label={label} aria-pressed={state === "playing"} disabled={state === "loading" && !src}>
            {state === "playing" ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <div className="vbub__body">
            <div className="vbub__wave" aria-hidden="true">
              {bars.map((h, i) => <i key={i} className={(i + 0.5) / bars.length * 100 <= pct ? "on" : ""} style={{ height: `${Math.max(14, h)}%` }} />)}
            </div>
            <input
              className="vbub__seek"
              type="range"
              min="0"
              max={shown || 1}
              step="0.1"
              value={Math.min(time, shown || 1)}
              disabled={!shown || state === "loading"}
              aria-label="Seek in voice note"
              aria-valuetext={`${formatClock(time)} of ${formatClock(shown)}`}
              onChange={(e) => { const a = audio.current; if (a) { a.currentTime = Number(e.target.value); setTime(a.currentTime); } }}
            />
            <div className="vbub__meta">
              <span className="vbub__time">{state === "loading" && !shown ? "Loading…" : `${formatClock(time)} / ${shown ? formatClock(shown) : "--:--"}`}</span>
              {uploading && <span className="vbub__status" role="status">Sending…</span>}
              {problem && state !== "error" && <span className="vbub__status" role="status">{problem}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
