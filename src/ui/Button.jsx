import { forwardRef } from "react";

// One place for the button look. It only builds the class names that already exist in
// styles/controls.css, so it can be adopted a piece at a time without touching other code.
//   variant: "primary" | "secondary" | "ghost" | "danger"      size: "md" | "sm"
const VARIANT = { primary: "btn--primary", secondary: "btn--soft", ghost: "btn--ghost", danger: "btn--danger" };

export const Button = forwardRef(function Button(
  { variant = "primary", size = "md", className = "", type = "button", children, ...rest },
  ref
) {
  const cls = ["btn", VARIANT[variant] || VARIANT.primary, size === "sm" ? "btn--small" : "", className].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {children}
    </button>
  );
});

// Square, quiet icon-only button. `label` is required so it always has an accessible name.
export const IconButton = forwardRef(function IconButton({ label, small, className = "", type = "button", children, ...rest }, ref) {
  const cls = ["icon-btn", small ? "icon-btn--sm" : "", className].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type} className={cls} aria-label={label} title={rest.title ?? label} {...rest}>
      {children}
    </button>
  );
});

export default Button;
