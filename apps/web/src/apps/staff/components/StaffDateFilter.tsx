import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import {
  detectPreset,
  formatReportDateRange,
  rangeForPreset,
  type DateRangePreset,
} from '../../../shared/utils/reportDateRange';

const PRESETS: { id: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
];

function triggerLabel(from: string, to: string): string {
  const preset = detectPreset(from, to);
  if (preset !== 'custom') {
    return PRESETS.find((item) => item.id === preset)?.label ?? 'Select period';
  }
  return formatReportDateRange(from, to);
}

export function StaffDateFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const activePreset = detectPreset(from, to);
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(activePreset === 'custom');
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
    if (detectPreset(from, to) === 'custom') setCustomOpen(true);
  }, [from, to]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selectPreset = (preset: Exclude<DateRangePreset, 'custom'>) => {
    const [start, end] = rangeForPreset(preset);
    setDraftFrom(start);
    setDraftTo(end);
    setCustomOpen(false);
    onChange(start, end);
    setOpen(false);
  };

  const openCustom = () => {
    setCustomOpen(true);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    onChange(draftFrom, draftTo);
  };

  return (
    <div className="staff-period" ref={rootRef}>
      <div className={`staff-date-dropdown ${open ? 'open' : ''}`}>
        <button
          type="button"
          className="staff-date-dropdown-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="staff-date-dropdown-icon">
            <CalendarDays />
          </span>
          <span className="staff-date-dropdown-copy">
            <small>Period</small>
            <strong>{triggerLabel(from, to)}</strong>
          </span>
          <ChevronDown className="staff-date-dropdown-chevron" />
        </button>

        {open && (
          <div className="staff-date-dropdown-panel" id={panelId} role="menu">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="menuitemradio"
                aria-checked={activePreset === preset.id}
                className={activePreset === preset.id ? 'active' : ''}
                onClick={() => selectPreset(preset.id)}
              >
                <span>{preset.label}</span>
                {activePreset === preset.id && <Check />}
              </button>
            ))}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={activePreset === 'custom'}
              className={activePreset === 'custom' ? 'active' : ''}
              onClick={openCustom}
            >
              <span>Custom range…</span>
              {activePreset === 'custom' && <Check />}
            </button>
          </div>
        )}
      </div>

      {customOpen && (
        <div className="staff-period-custom">
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
          <button
            type="button"
            className="primary"
            disabled={!draftFrom || !draftTo || draftFrom > draftTo}
            onClick={applyCustom}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
