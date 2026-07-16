import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

type PageSectionProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  soft?: boolean;
  flat?: boolean;
};

type MetricGridProps = {
  children: ReactNode;
  className?: string;
};

type MetricCardProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  attention?: boolean;
};

type NoticeProps = {
  children: ReactNode;
  type?: "success" | "warning" | "danger" | "info";
  className?: string;
};

function joinClasses(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

export function PageShell({
  children,
  className,
}: PageShellProps) {
  return (
    <div className={joinClasses("g-ui-page", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <header className="g-ui-page-header">
      <div className="g-ui-page-heading">
        {eyebrow ? (
          <p className="g-ui-eyebrow">{eyebrow}</p>
        ) : null}

        <h1 className="g-ui-page-title">{title}</h1>

        {subtitle ? (
          <div className="g-ui-page-subtitle">
            {subtitle}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="g-ui-header-actions">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function PageSection({
  children,
  className,
  title,
  eyebrow,
  description,
  actions,
  soft = false,
  flat = false,
}: PageSectionProps) {
  return (
    <section
      className={joinClasses(
        "g-ui-card",
        soft && "g-ui-card--soft",
        flat && "g-ui-card--flat",
        className
      )}
    >
      {title || eyebrow || description || actions ? (
        <div className="g-ui-section-header">
          <div>
            {eyebrow ? (
              <p className="g-ui-eyebrow">{eyebrow}</p>
            ) : null}

            {title ? (
              <h2 className="g-ui-section-title">
                {title}
              </h2>
            ) : null}

            {description ? (
              <div className="g-ui-section-hint">
                {description}
              </div>
            ) : null}
          </div>

          {actions ? (
            <div className="g-ui-header-actions">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}

export function MetricGrid({
  children,
  className,
}: MetricGridProps) {
  return (
    <section
      className={joinClasses(
        "g-ui-metric-grid",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  description,
  badge,
  attention = false,
}: MetricCardProps) {
  return (
    <article
      className={joinClasses(
        "g-ui-metric-card",
        attention && "g-ui-metric-card--attention"
      )}
    >
      <div>
        <p>{label}</p>
        <strong>{value}</strong>

        {description ? (
          <span>{description}</span>
        ) : null}
      </div>

      {badge ? <small>{badge}</small> : null}
    </article>
  );
}

export function Notice({
  children,
  type = "info",
  className,
}: NoticeProps) {
  return (
    <div
      className={joinClasses(
        "g-ui-notice",
        `g-ui-notice--${type}`,
        className
      )}
    >
      {children}
    </div>
  );
}
