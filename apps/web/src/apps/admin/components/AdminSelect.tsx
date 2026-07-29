import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type AdminSelectOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export function AdminSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled = false,
  icon,
  required = false,
}: {
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  icon?: ReactNode;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className={`admin-select ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="admin-select-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {icon ? <span className="admin-select-icon">{icon}</span> : null}
        <span className={`admin-select-value ${selected ? "" : "placeholder"}`}>
          {selected ? (
            <>
              <b>{selected.label}</b>
              {selected.hint ? <small>{selected.hint}</small> : null}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown />
      </button>
      {open && !disabled ? (
        <div className="admin-select-panel" role="listbox">
          {options.length ? (
            options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                disabled={option.disabled}
                className={option.value === value ? "active" : ""}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>
                  <b>{option.label}</b>
                  {option.hint ? <small>{option.hint}</small> : null}
                </span>
                {option.value === value ? <Check /> : null}
              </button>
            ))
          ) : (
            <div className="admin-select-empty">No options available</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
