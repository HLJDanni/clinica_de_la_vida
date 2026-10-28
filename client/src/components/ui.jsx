import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { avatarColor, cx, shortInitials } from '../utils.js';

export const spring = { type: 'spring', stiffness: 420, damping: 34 };

export function Page({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Button({ variant = 'primary', size, icon: Icon, loading, block, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx('btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', !children && 'btn-icon', className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="spinner" /> : Icon && <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, auto, className, children }) {
  return (
    <div className={cx('field', className)}>
      {label && (
        <label>
          {label}
          {auto && <span className="auto-tag">Automático</span>}
          {hint && <span className="hint">{hint}</span>}
        </label>
      )}
      {children}
    </div>
  );
}

export function Input({ label, hint, auto, className, suffix, ...props }) {
  const id = useId();
  return (
    <Field label={label && <span id={id}>{label}</span>} hint={hint} auto={auto} className={className}>
      <div className="input-wrap">
        <input aria-labelledby={label ? id : undefined} className={cx('input', auto && 'auto')} {...props} value={props.value ?? ''} />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </div>
    </Field>
  );
}

/** Textarea que crece con el contenido */
export function Textarea({ label, hint, className, minRows = 3, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight + 2, minRows * 22 + 20)}px`;
  }, [props.value, minRows]);
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea ref={ref} className="textarea" {...props} value={props.value ?? ''} />
    </Field>
  );
}

export function Select({ label, hint, className, options, ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className="select" {...props} value={props.value ?? ''}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Segmented({ value, onChange, options, layoutId }) {
  const auto = useId();
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const Icon = o.icon;
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} className={cx(on && 'on')} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={layoutId || auto} className="seg-pill" transition={spring} />}
            {Icon && <Icon size={15} />}
            {o.label}
            {o.count !== undefined && <span className="muted small">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ value, onChange, tabs }) {
  const id = useId();
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = t.value === value;
        return (
          <button key={t.value} type="button" role="tab" aria-selected={on} className={cx('tab', on && 'on')} onClick={() => onChange(t.value)}>
            {Icon && <Icon size={16} />}
            {t.label}
            {t.count ? <span className="count">{t.count}</span> : null}
            {on && <motion.span layoutId={`tabline-${id}`} className="tab-line" transition={spring} />}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, icon: Icon, width = 560, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            className="modal"
            style={{ maxWidth: width }}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={spring}
          >
            {title && (
              <div className="modal-head">
                {Icon && (
                  <div className="stat-icon tone-blue">
                    <Icon size={19} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2>{title}</h2>
                  {subtitle && <p>{subtitle}</p>}
                </div>
                <Button variant="ghost" icon={X} onClick={onClose} aria-label="Cerrar" />
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export const Badge = ({ tone = 'tone-gray', children, icon: Icon }) => (
  <span className={cx('badge', tone)}>
    {Icon && <Icon size={12} strokeWidth={2.5} />}
    {children}
  </span>
);

export function Avatar({ patient, size = 40 }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(140deg, ${avatarColor(patient?.id)}, ${avatarColor(patient?.id)}cc)` }}
    >
      {shortInitials(patient)}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={24} />
        </div>
      )}
      <b>{title}</b>
      {text && <div style={{ maxWidth: 360 }}>{text}</div>}
      {children}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = '100%', style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} />;

export function LoadingList({ rows = 4 }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="row" style={{ gap: 14 }}>
          <Skeleton h={40} w={40} style={{ borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton h={12} w="40%" />
            <Skeleton h={10} w="65%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Animación escalonada para listas */
export const listItem = (i) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: Math.min(i * 0.03, 0.3), duration: 0.3, ease: [0.22, 1, 0.36, 1] },
});
