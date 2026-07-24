type DeliveryNoteButtonProps = {
  orderId: string;
  compact?: boolean;
  refresh?: boolean;
};

export default function DeliveryNoteButton({
  orderId,
  compact = false,
  refresh = false,
}: DeliveryNoteButtonProps) {
  const href =
    "/lieferscheine/" +
    orderId +
    "/pdf" +
    (refresh ? "?refresh=1" : "");

  if (refresh) {
    return (
      <a
        className="deliveryDocumentRefreshLink"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        Neu erzeugen
      </a>
    );
  }

  return (
    <a
      className={
        "deliveryDocumentButton " +
        (compact
          ? "deliveryDocumentButtonCompact"
          : "deliveryDocumentButtonFull")
      }
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={
        compact
          ? "Lieferschein öffnen"
          : undefined
      }
      title={
        compact
          ? "Lieferschein öffnen"
          : undefined
      }
    >
      <span
        className="deliveryDocumentIcon"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M7 3.5h7l3.5 3.5v13.5H7V3.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />

          <path
            d="M14 3.5V7h3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M9.5 11h5M9.5 14.5h5M9.5 18h3.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {!compact ? (
        <span className="deliveryDocumentLabel">
          Lieferschein öffnen
        </span>
      ) : null}
    </a>
  );
}