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
      <span className="deliveryDocumentButtonIcon">
        PDF
      </span>

      <span className="deliveryDocumentButtonText">
        <strong>
          {refresh ? "Neu erzeugen" : "Lieferschein"}
        </strong>

        {!compact ? (
          <small>
            {refresh ? "PDF aktualisieren" : "PDF öffnen"}
          </small>
        ) : null}
      </span>
    </a>
  );
}
