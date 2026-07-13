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
        (compact ? "deliveryDocumentButtonCompact" : "")
      }
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span
        className="deliveryDocumentIcon"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
        >
          <path
            d="M7 3.75h7l3 3v13.5H7V3.75Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M14 3.75v3h3M9.5 11h5M9.5 14h5M9.5 17h3.25"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <span>
        {compact ? "Lieferschein" : "PDF öffnen"}
      </span>
    </a>
  );
}
