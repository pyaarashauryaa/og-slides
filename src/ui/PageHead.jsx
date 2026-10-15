// Page heading used by Slides, Tasks, Resources and Decisions: a coloured icon tile + title + one line of help.
export default function PageHead({ icon: Icon, title, text, children }) {
  return (
    <div className="gallery__head">
      <div className="page-head">
        {Icon && <span className="page-head__tile" aria-hidden="true"><Icon size={22} strokeWidth={2} /></span>}
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
