import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Calendar, Check, ChevronDown, FileText } from 'lucide-react';
import {
  currentMonthRange,
  formatReportDateRange,
  isoDate,
} from '../../../shared/utils/reportDateRange';

type Option = { value: string; label: string };

export function ReportSelect({
  value,
  options,
  onChange,
  icon = <FileText />,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className={`reports-filter reports-select-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button type="button" className="reports-filter-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="reports-filter-icon">{icon}</span>
        <span>{selected?.label ?? 'Select report'}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="reports-filter-panel" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              className={option.value === value ? 'active' : ''}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PRESETS = [
  {
    label: 'This month',
    range: () => currentMonthRange(),
  },
  {
    label: 'Last month',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return [isoDate(from), isoDate(to)] as const;
    },
  },
  {
    label: 'Last 7 days',
    range: () => {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      return [isoDate(from), isoDate(to)] as const;
    },
  },
] as const;

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const apply = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    onChange(draftFrom, draftTo);
    setOpen(false);
  };

  return (
    <div className={`reports-filter reports-date-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="reports-filter-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="reports-filter-icon">
          <Calendar />
        </span>
        <span>{formatReportDateRange(from, to)}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="reports-filter-panel reports-date-panel" id={panelId}>
          <div className="reports-date-presets">
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.label}
                onClick={() => {
                  const [start, end] = preset.range();
                  setDraftFrom(start);
                  setDraftTo(end);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="reports-date-fields">
            <label>
              <span>From</span>
              <input
                className="form-control"
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                className="form-control"
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
              />
            </label>
          </div>
          <div className="reports-date-actions">
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={!draftFrom || !draftTo || draftFrom > draftTo}
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
