import { Children, useEffect } from "react";
import { Link } from "react-router";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export {
  PageShell as GastarioPage,
  PageHeader as GastarioHeader,
  PageSection as GastarioCard,
  MetricGrid as GastarioMetricGrid,
  MetricCard as GastarioMetric,
  Notice as GastarioNotice,
} from "./PageShell";

function joinClasses(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

type GastarioFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
};

export function GastarioField({
  label,
  hint,
  required = false,
  children,
  className,
  fullWidth = false,
}: GastarioFieldProps) {
  return (
    <label
      className={joinClasses(
        "g-ui-field",
        fullWidth && "g-ui-field--full",
        className
      )}
    >
      <span className="g-ui-field-label">
        {label}
        {required ? (
          <span className="g-ui-field-required"> *</span>
        ) : null}
      </span>

      {children}

      {hint ? (
        <span className="g-ui-field-hint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

type GastarioInputProps =
  InputHTMLAttributes<HTMLInputElement>;

export function GastarioInput({
  className,
  ...props
}: GastarioInputProps) {
  return (
    <input
      {...props}
      className={joinClasses("g-ui-input", className)}
    />
  );
}


type GastarioSelectProps =
  SelectHTMLAttributes<HTMLSelectElement>;

export function GastarioSelect({
  className,
  children,
  ...props
}: GastarioSelectProps) {
  return (
    <select
      {...props}
      className={joinClasses("g-ui-select", className)}
    >
      {children}
    </select>
  );
}

type GastarioTextareaProps =
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function GastarioTextarea({
  className,
  ...props
}: GastarioTextareaProps) {
  return (
    <textarea
      {...props}
      className={joinClasses("g-ui-textarea", className)}
    />
  );
}

export type GastarioButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

export function gastarioButtonClass(
  variant: GastarioButtonVariant = "secondary",
  className?: string
) {
  return joinClasses(
    "g-ui-button",
    `g-ui-button--${variant}`,
    className
  );
}

type GastarioButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: GastarioButtonVariant;
  };

export function GastarioButton({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: GastarioButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={gastarioButtonClass(
        variant,
        className
      )}
    />
  );
}

type GastarioFormGridProps = {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
};

export function GastarioFormGrid({
  children,
  columns = 4,
  className,
}: GastarioFormGridProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-form-grid",
        `g-ui-form-grid--${columns}`,
        className
      )}
    >
      {children}
    </div>
  );
}

export type GastarioToolbarAlign =
  | "start"
  | "end"
  | "between";

type GastarioToolbarProps = {
  children: ReactNode;
  className?: string;
  align?: GastarioToolbarAlign;
};

export function GastarioToolbar({
  children,
  className,
  align = "end",
}: GastarioToolbarProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-toolbar",
        `g-ui-toolbar--${align}`,
        className
      )}
    >
      {children}
    </div>
  );
}

type GastarioSplitViewProps = {
  children: ReactNode;
  className?: string;
  wide?: boolean;
};

export function GastarioSplitView({
  children,
  className,
  wide = false,
}: GastarioSplitViewProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-split",
        wide && "g-ui-split--wide",
        className
      )}
    >
      {children}
    </div>
  );
}

type GastarioSplitAreaProps = {
  children: ReactNode;
  className?: string;
};

export function GastarioSplitMain({
  children,
  className,
}: GastarioSplitAreaProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-split-main",
        className
      )}
    >
      {children}
    </div>
  );
}

export function GastarioSplitAside({
  children,
  className,
}: GastarioSplitAreaProps) {
  return (
    <aside
      className={joinClasses(
        "g-ui-split-aside",
        className
      )}
    >
      {children}
    </aside>
  );
}
type GastarioEmptyStateProps = {
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function GastarioEmptyState({
  title,
  children,
  className,
}: GastarioEmptyStateProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-empty",
        className
      )}
    >
      {title ? (
        <strong className="g-ui-empty-title">
          {title}
        </strong>
      ) : null}

      {children ? (
        <div className="g-ui-empty-text">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type GastarioTableProps = {
  children: ReactNode;
  className?: string;
};

export function GastarioTable({
  children,
  className,
}: GastarioTableProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-table-shell",
        className
      )}
    >
      <table className="g-ui-table">
        {children}
      </table>
    </div>
  );
}

type GastarioStackProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function GastarioStack({
  children,
  className,
  compact = false,
}: GastarioStackProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-stack",
        compact && "g-ui-stack--compact",
        className
      )}
    >
      {children}
    </div>
  );
}

/* GASTARIO CENTRAL LAYOUT V1 */

type GastarioLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function GastarioWorkspace({
  children,
  className,
}: GastarioLayoutProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-workspace",
        className
      )}
    >
      {children}
    </div>
  );
}

export function GastarioMain({
  children,
  className,
}: GastarioLayoutProps) {
  return (
    <main
      className={joinClasses(
        "g-ui-main",
        className
      )}
    >
      {children}
    </main>
  );
}

export function GastarioAside({
  children,
  className,
}: GastarioLayoutProps) {
  return (
    <aside
      className={joinClasses(
        "g-ui-aside",
        className
      )}
    >
      {children}
    </aside>
  );
}

type GastarioToolGridProps = {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3;
};

export function GastarioToolGrid({
  children,
  className,
  columns = 2,
}: GastarioToolGridProps) {
  return (
    <section
      className={joinClasses(
        "g-ui-tool-grid",
        `g-ui-tool-grid--${columns}`,
        className
      )}
    >
      {children}
    </section>
  );
}

export function GastarioDataSection({
  children,
  className,
}: GastarioLayoutProps) {
  return (
    <section
      className={joinClasses(
        "g-ui-data-section",
        className
      )}
    >
      {children}
    </section>
  );
}

/* GASTARIO INTERACTION PRIMITIVES V2 */

/* =========================================================
   GASTARIO INSIGHT V1
========================================================= */

export type GastarioInsightTone =
  | "neutral"
  | "sand"
  | "sage"
  | "blue"
  | "rose";

type GastarioInsightProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: ReactNode;
  actionTo?: string;
  onAction?: () => void;
  tone?: GastarioInsightTone;
  className?: string;
};

export function GastarioInsight({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  tone = "neutral",
  className,
}: GastarioInsightProps) {
  const action =
    actionLabel && actionTo ? (
      <Link
        to={actionTo}
        className={gastarioButtonClass("secondary")}
      >
        {actionLabel}
      </Link>
    ) : actionLabel && onAction ? (
      <GastarioButton
        variant="secondary"
        type="button"
        onClick={onAction}
      >
        {actionLabel}
      </GastarioButton>
    ) : null;

  return (
    <section
      className={joinClasses(
        "g-ui-insight",
        `g-ui-insight--${tone}`,
        className
      )}
    >
      <div className="g-ui-insight-copy">
        {eyebrow ? (
          <div className="g-ui-insight-eyebrow">
            {eyebrow}
          </div>
        ) : null}

        <strong className="g-ui-insight-title">
          {title}
        </strong>

        {description ? (
          <div className="g-ui-insight-description">
            {description}
          </div>
        ) : null}
      </div>

      {action ? (
        <div className="g-ui-insight-action">
          {action}
        </div>
      ) : null}
    </section>
  );
}

/* =========================================================
   SECTION
========================================================= */

type GastarioSectionProps = {
  title?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function GastarioSection({
  title,
  description,
  eyebrow,
  action,
  children,
  className,
}: GastarioSectionProps) {
  return (
    <section
      className={joinClasses(
        "g-ui-section",
        className
      )}
    >
      {(eyebrow || title || description || action) ? (
        <div className="g-ui-section-heading">
          <div className="g-ui-section-heading-copy">
            {eyebrow ? (
              <div className="g-ui-section-eyebrow">
                {eyebrow}
              </div>
            ) : null}

            {title ? (
              <h2 className="g-ui-section-heading-title">
                {title}
              </h2>
            ) : null}

            {description ? (
              <div className="g-ui-section-heading-description">
                {description}
              </div>
            ) : null}
          </div>

          {action ? (
            <div className="g-ui-section-heading-action">
              {action}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="g-ui-section-body">
        {children}
      </div>
    </section>
  );
}


/* =========================================================
   PANEL
========================================================= */

type GastarioPanelVariant =
  | "default"
  | "soft"
  | "flat";

type GastarioPanelProps = {
  children: ReactNode;
  className?: string;
  variant?: GastarioPanelVariant;
};

export function GastarioPanel({
  children,
  className,
  variant = "default",
}: GastarioPanelProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-panel",
        `g-ui-panel--${variant}`,
        className
      )}
    >
      {children}
    </div>
  );
}


/* =========================================================
   ACTION CARDS
========================================================= */

type GastarioActionGridProps = {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
};

export function GastarioActionGrid({
  children,
  columns = 3,
  className,
}: GastarioActionGridProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-action-grid",
        `g-ui-action-grid--${columns}`,
        className
      )}
    >
      {children}
    </div>
  );
}

type GastarioActionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  className?: string;
  tone?: "neutral" | "sand" | "sage" | "blue" | "rose";
};

export function GastarioActionCard({
  title,
  description,
  icon,
  meta,
  onClick,
  to,
  disabled = false,
  className,
  tone = "neutral",
}: GastarioActionCardProps) {
  const content = (
    <>
      {icon ? (
        <span className="g-ui-action-card-icon">
          {icon}
        </span>
      ) : null}

      <span className="g-ui-action-card-copy">
        <strong className="g-ui-action-card-title">
          {title}
        </strong>

        {description ? (
          <span className="g-ui-action-card-description">
            {description}
          </span>
        ) : null}
      </span>

      {meta ? (
        <span className="g-ui-action-card-meta">
          {meta}
        </span>
      ) : null}

      <span
        className="g-ui-action-card-arrow"
        aria-hidden="true"
      >
        →
      </span>
    </>
  );

  const classes = joinClasses(
    "g-ui-action-card",
    `g-ui-action-card--${tone}`,
    className
  );

  if (to && !disabled) {
    return (
      <Link
        to={to}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}

/* =========================================================
   ICON BUTTON
========================================================= */

type GastarioIconButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: GastarioButtonVariant;
  };

export function GastarioIconButton({
  label,
  variant = "ghost",
  className,
  type = "button",
  children,
  ...props
}: GastarioIconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      className={joinClasses(
        "g-ui-icon-button",
        `g-ui-icon-button--${variant}`,
        className
      )}
    >
      {children}
    </button>
  );
}


/* =========================================================
   BADGE
========================================================= */

export type GastarioBadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

type GastarioBadgeProps = {
  children: ReactNode;
  variant?: GastarioBadgeVariant;
  className?: string;
};

export function GastarioBadge({
  children,
  variant = "neutral",
  className,
}: GastarioBadgeProps) {
  return (
    <span
      className={joinClasses(
        "g-ui-badge",
        `g-ui-badge--${variant}`,
        className
      )}
    >
      {children}
    </span>
  );
}


/* =========================================================
   WORKFLOW STEPS
========================================================= */

/* =========================================================
   TABS
========================================================= */

export type GastarioTabItem = {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
};

type GastarioTabsProps = {
  items: GastarioTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
};

export function GastarioTabs({
  items,
  activeId,
  onChange,
  className,
}: GastarioTabsProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-tabs",
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === activeId;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            className={joinClasses(
              "g-ui-tab",
              active && "g-ui-tab--active"
            )}
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>

            {item.badge ? (
              <span className="g-ui-tab-badge">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}


/* =========================================================
   DIALOG
========================================================= */

export type GastarioDialogSize =
  | "sm"
  | "md"
  | "lg"
  | "xl";

type GastarioDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: GastarioDialogSize;
  className?: string;
};

export function GastarioDialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = "lg",
  className,
}: GastarioDialogProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="g-ui-dialog-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className={joinClasses(
          "g-ui-dialog",
          `g-ui-dialog--${size}`,
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="g-ui-dialog-header">
          <div className="g-ui-dialog-heading">
            <h2 className="g-ui-dialog-title">
              {title}
            </h2>

            {description ? (
              <div className="g-ui-dialog-description">
                {description}
              </div>
            ) : null}
          </div>

          <GastarioIconButton
            label="Fenster schließen"
            onClick={onClose}
          >
            ×
          </GastarioIconButton>
        </header>

        <div className="g-ui-dialog-body">
          {children}
        </div>

        {footer ? (
          <footer className="g-ui-dialog-footer">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}


/* =========================================================
   DRAWER
========================================================= */

/* =========================================================
   CHECK ROW
========================================================= */

type GastarioCheckRowProps = {
  name?: string;
  title: ReactNode;
  description?: ReactNode;
  value?: string;
  required?: boolean;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function GastarioCheckRow({
  name,
  title,
  description,
  value = "1",
  required = false,
  defaultChecked = false,
  checked,
  disabled = false,
  onCheckedChange,
}: GastarioCheckRowProps) {
  return (
    <label className="g-ui-check-row">
      <input
        className="g-ui-check-row-control"
        type="checkbox"
        name={name}
        value={value}
        required={required}
        checked={checked}
        defaultChecked={
          checked === undefined
            ? defaultChecked
            : undefined
        }
        disabled={disabled}
        onChange={(event) =>
          onCheckedChange?.(
            event.currentTarget.checked
          )
        }
      />

      <span className="g-ui-check-row-copy">
        <strong className="g-ui-check-row-title">
          {title}
        </strong>

        {description ? (
          <span className="g-ui-check-row-description">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/* =========================================================
   DETAIL DIALOG

   GASTARIO DETAIL INTERACTION STANDARD

   Datensätze aus Listen, Tabellen oder Übersichten werden
   zum Ansehen, Prüfen oder Bearbeiten in diesem zentralen
   Detailfenster geöffnet.

   Der aktuelle Seitenkontext bleibt im Hintergrund sichtbar.
   Keine route-spezifischen Detailfenster oder Overlays.
========================================================= */

export type GastarioDetailDialogProps =
  Omit<GastarioDialogProps, "size"> & {
    size?: GastarioDialogSize;
  };

export function GastarioDetailDialog({
  className,
  size = "xl",
  ...props
}: GastarioDetailDialogProps) {
  return (
    <GastarioDialog
      {...props}
      size={size}
      className={joinClasses(
        "g-ui-detail-dialog",
        className
      )}
    />
  );
}


/* =========================================================
   DETAIL WORKSPACE

   Zentraler Gastario-Standard innerhalb von Detailfenstern:
   Tabs oben, darunter genau ein aktiver Inhaltsbereich.
========================================================= */

type GastarioDetailTabsProps = {
  items: Array<{
    id: string;
    label: ReactNode;
    badge?: ReactNode;
    disabled?: boolean;
  }>;
  activeId: string;
  onChange: (id: string) => void;
};

export function GastarioDetailTabs({
  items,
  activeId,
  onChange,
}: GastarioDetailTabsProps) {
  return (
    <div className="g-ui-detail-tabs">
      <GastarioTabs
        items={items}
        activeId={activeId}
        onChange={onChange}
      />
    </div>
  );
}

type GastarioDetailPaneProps = {
  active: boolean;
  children: ReactNode;
  className?: string;
};

export function GastarioDetailPane({
  active,
  children,
  className,
}: GastarioDetailPaneProps) {
  if (!active) return null;

  return (
    <div
      className={joinClasses(
        "g-ui-detail-pane",
        className
      )}
    >
      {children}
    </div>
  );
}


type GastarioDrawerProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
};

export function GastarioDrawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className,
}: GastarioDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="g-ui-drawer-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <aside
        className={joinClasses(
          "g-ui-drawer",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="g-ui-drawer-header">
          <div className="g-ui-drawer-heading">
            <h2 className="g-ui-drawer-title">
              {title}
            </h2>

            {description ? (
              <div className="g-ui-drawer-description">
                {description}
              </div>
            ) : null}
          </div>

          <GastarioIconButton
            label="Seitenfenster schließen"
            onClick={onClose}
          >
            ×
          </GastarioIconButton>
        </header>

        <div className="g-ui-drawer-body">
          {children}
        </div>

        {footer ? (
          <footer className="g-ui-drawer-footer">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}


/* =========================================================
   DATA LIST
========================================================= */

type GastarioDataListProps = {
  children: ReactNode;
  className?: string;
};

export function GastarioDataList({
  children,
  className,
}: GastarioDataListProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-data-list",
        className
      )}
    >
      {children}
    </div>
  );
}

type GastarioDataRowProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  to?: string;
};

export function GastarioDataRow({
  children,
  className,
  onClick,
  to,
}: GastarioDataRowProps) {
  if (to) {
    return (
      <Link
        to={to}
        className={joinClasses(
          "g-ui-data-row",
          "g-ui-data-row--clickable",
          className
        )}
      >
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={joinClasses(
          "g-ui-data-row",
          "g-ui-data-row--clickable",
          className
        )}
        onClick={onClick}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={joinClasses(
        "g-ui-data-row",
        className
      )}
    >
      {children}
    </div>
  );
}

/* GASTARIO FILTER BAR V1 */

type GastarioFilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function GastarioFilterBar({
  children,
  actions,
  className,
}: GastarioFilterBarProps) {
  const controlCount =
    Children.count(children);

  const singleControl =
    controlCount === 1;

  return (
    <div
      className={joinClasses(
        "g-ui-filter-bar",
        singleControl &&
          "g-ui-filter-bar--single",
        className
      )}
    >
      <div
        className={joinClasses(
          "g-ui-filter-controls",
          singleControl &&
            "g-ui-filter-controls--single"
        )}
      >
        {children}
      </div>

      {actions ? (
        <div className="g-ui-filter-actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}


/* =========================================================
   WORKFLOW

   Zentraler Gastario-Prozess für geführte Abläufe.
   Schritte können abgeschlossen, aktuell, verfügbar
   oder gesperrt sein.
========================================================= */

export type GastarioWorkflowState =
  | "done"
  | "current"
  | "available"
  | "locked";

export type GastarioWorkflowItem = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  state: GastarioWorkflowState;
};

type GastarioWorkflowProps = {
  items: GastarioWorkflowItem[];
  activeId?: string;
  onChange?: (id: string) => void;
};

export function GastarioWorkflow({
  items,
  activeId,
  onChange,
}: GastarioWorkflowProps) {
  return (
    <ol
      className="g-ui-workflow"
      aria-label="Arbeitsablauf"
    >
      {items.map(
        (
          item,
          index
        ) => {
          const locked =
            item.state ===
            "locked";

          const current =
            item.state ===
              "current" ||
            item.id ===
              activeId;

          const done =
            item.state ===
            "done";

          return (
            <li
              key={item.id}
              className={[
                "g-ui-workflow-item",
                `g-ui-workflow-item--${item.state}`,
                current
                  ? "is-current"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className={gastarioButtonClass(
                  "ghost",
                  "g-ui-workflow-step"
                )}
                disabled={
                  locked
                }
                aria-current={
                  current
                    ? "step"
                    : undefined
                }
                onClick={() => {
                  if (
                    locked ||
                    !onChange
                  ) {
                    return;
                  }

                  onChange(
                    item.id
                  );
                }}
              >
                <span className="g-ui-workflow-index">
                  {done
                    ? "✓"
                    : index +
                      1}
                </span>

                <span className="g-ui-workflow-copy">
                  <strong>
                    {item.label}
                  </strong>

                  {item.description ? (
                    <small>
                      {
                        item.description
                      }
                    </small>
                  ) : null}
                </span>

                <span
                  className="g-ui-workflow-state"
                  aria-hidden="true"
                >
                  {locked
                    ? "Gesperrt"
                    : done
                      ? "Erledigt"
                      : current
                        ? "Aktuell"
                        : "Offen"}
                </span>
              </button>
            </li>
          );
        }
      )}
    </ol>
  );
}
