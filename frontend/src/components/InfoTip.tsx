import { useId, useState } from 'react';

/** Small "i" button that shows a one-line explanation on hover, focus or tap. */
export function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip__btn"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        i
      </button>
      <span role="tooltip" id={id} className={`infotip__body${open ? ' is-open' : ''}`}>
        {text}
      </span>
    </span>
  );
}
