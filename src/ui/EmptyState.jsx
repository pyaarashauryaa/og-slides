import Mascot from "./Mascot.jsx";
// One empty-state look for every list in the app (presentations, tasks, links, decisions, deadlines).
// tone picks the colour family: rani | coral | teal | violet | sky | mint
export default function EmptyState({ icon: Icon, tone = "rani", title, children, action, art, compact = false, as: Tag = "div", ...rest }) {
  return (
    <Tag className={`empty-state empty-state--${tone}${compact ? " empty-state--compact" : ""}`} {...rest}>
      {art}
      {!compact && !art && <Mascot className="empty-state__pip" size={84} mood="wink" />}
      {Icon && !art && compact && <span className="empty-state__icon" aria-hidden="true"><Icon size={compact ? 22 : 28} strokeWidth={1.75} /></span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </Tag>
  );
}
