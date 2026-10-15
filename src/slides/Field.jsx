import { useDraft } from "./useDraft.js";

// A text field that saves a moment after you stop typing, and warns about collisions.
export default function Field({ label, remote, byOther, who, onCommit, multiline, hint, max, rows = 6, id }) {
  const d = useDraft(remote ?? "", onCommit, byOther);
  const props = { value: d.value, maxLength: max, onChange: (e) => d.onChange(e.target.value), onBlur: d.flush, id };
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? <textarea rows={rows} {...props} /> : <input {...props} />}
      {hint && <small>{hint}</small>}
      {d.conflict && (
        <span className="field__conflict field__conflict--box" role="alert">
          <b>{who || "Someone"} also changed this while you were typing.</b>
          <span className="field__cmp"><i>Theirs</i> {String(d.theirs ?? "").slice(0, 160) || "(empty)"}</span>
          <span className="field__cmp"><i>Yours</i> {String(d.value ?? "").slice(0, 160) || "(empty)"}</span>
          <span className="field__conflict-actions">
            <button type="button" className="btn btn--small btn--primary" onClick={() => d.flush(true)}>Keep mine (replaces theirs)</button>
            <button type="button" className="btn btn--small btn--ghost" onClick={d.useTheirs}>Use theirs</button>
          </span>
        </span>
      )}
    </label>
  );
}
