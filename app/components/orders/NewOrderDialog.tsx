import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Form } from "react-router";

import {
  GastarioButton,
  GastarioDialog,
  GastarioField,
  GastarioFormGrid,
  GastarioInput,
  GastarioMetric,
  GastarioMetricGrid,
  GastarioNotice,
  GastarioPanel,
  GastarioSection,
  GastarioStack,
  GastarioTabs,
  GastarioTextarea,
  GastarioToolbar,
} from "../ui";

type ManualItem = {
  id: string;
  name: string;
  quantity: string;
  unitPriceEuro: string;
  itemNotes: string;
};

type NewOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  serverError?: string | null;
  formAction?: string;
};

function makeItem(
  partial: Partial<ManualItem> = {}
): ManualItem {
  return {
    id: Math.random()
      .toString(36)
      .slice(2),
    name: partial.name || "",
    quantity:
      partial.quantity || "1",
    unitPriceEuro:
      partial.unitPriceEuro || "",
    itemNotes:
      partial.itemNotes || "",
  };
}

function euroInputToNumber(
  value: string
) {
  const raw = String(value || "0")
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const number = Number(raw);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatEuro(value: number) {
  return value.toLocaleString(
    "de-DE",
    {
      style: "currency",
      currency: "EUR",
    }
  );
}

export default function NewOrderDialog({
  open,
  onClose,
  serverError,
  formAction = "/neuer-auftrag",
}: NewOrderDialogProps) {
  const [step, setStep] =
    useState(0);

  const [
    localError,
    setLocalError,
  ] = useState<string | null>(
    null
  );

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    deliveryDate,
    setDeliveryDate,
  ] = useState("");

  const [items, setItems] =
    useState<ManualItem[]>([
      makeItem({
        quantity: "1",
      }),
      makeItem({
        quantity: "1",
      }),
    ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep(0);
    setLocalError(null);
    setCustomerName("");
    setDeliveryDate("");
    setItems([
      makeItem({
        quantity: "1",
      }),
      makeItem({
        quantity: "1",
      }),
    ]);
  }, [open]);

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) => {
        const quantity = Number(
          String(
            item.quantity || "1"
          ).replace(",", ".")
        );

        const cleanQuantity =
          Number.isFinite(quantity) &&
          quantity > 0
            ? quantity
            : 0;

        return (
          sum +
          cleanQuantity *
            euroInputToNumber(
              item.unitPriceEuro
            )
        );
      },
      0
    );
  }, [items]);

  const steps = [
    {
      id: "0",
      label: "1. Kunde",
    },
    {
      id: "1",
      label: "2. Lieferung",
    },
    {
      id: "2",
      label: "3. Positionen",
    },
    {
      id: "3",
      label: "4. Abschluss",
    },
  ];

  function updateItem(
    id: string,
    field: keyof ManualItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      makeItem({
        quantity: "1",
      }),
    ]);
  }

  function addTextItem() {
    setItems((current) => [
      ...current,
      makeItem({
        name: "Freitextposition",
        quantity: "1",
      }),
    ]);
  }

  function removeItem(id: string) {
    setItems((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter(
        (item) =>
          item.id !== id
      );
    });
  }

  function hasValidItems() {
    return items.some(
      (item) =>
        item.name.trim() ||
        item.itemNotes.trim()
    );
  }

  function validateStep(
    currentStep: number
  ) {
    if (
      currentStep === 0 &&
      !customerName.trim()
    ) {
      setLocalError(
        "Bitte zuerst den Kunden eintragen."
      );

      return false;
    }

    if (
      currentStep === 1 &&
      !deliveryDate.trim()
    ) {
      setLocalError(
        "Bitte zuerst das Lieferdatum eintragen."
      );

      return false;
    }

    if (
      currentStep === 2 &&
      !hasValidItems()
    ) {
      setLocalError(
        "Bitte mindestens eine Position eintragen."
      );

      return false;
    }

    setLocalError(null);

    return true;
  }

  function goNext() {
    if (!validateStep(step)) {
      return;
    }

    setStep((current) =>
      Math.min(
        3,
        current + 1
      )
    );
  }

  function goBack() {
    setLocalError(null);

    setStep((current) =>
      Math.max(
        0,
        current - 1
      )
    );
  }

  function handleTabChange(
    id: string
  ) {
    const target = Number(id);

    if (
      !Number.isFinite(target)
    ) {
      return;
    }

    if (target <= step) {
      setLocalError(null);
      setStep(target);
      return;
    }

    if (target === step + 1) {
      goNext();
    }
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    if (!customerName.trim()) {
      event.preventDefault();

      setStep(0);

      setLocalError(
        "Bitte den Kunden eintragen."
      );

      return;
    }

    if (!deliveryDate.trim()) {
      event.preventDefault();

      setStep(1);

      setLocalError(
        "Bitte das Lieferdatum eintragen."
      );

      return;
    }

    if (!hasValidItems()) {
      event.preventDefault();

      setStep(2);

      setLocalError(
        "Bitte mindestens eine Position eintragen."
      );
    }
  }

  return (
    <Form
      method="post"
      action={formAction}
      noValidate
      onSubmit={handleSubmit}
    >
      <GastarioDialog
        open={open}
        size="xl"
        title="Neuer Auftrag"
        description={`Schritt ${
          step + 1
        } von 4 · ${steps[
          step
        ].label.replace(
          /^\d+\.\s*/,
          ""
        )}`}
        onClose={onClose}
        footer={
          <>
            <GastarioButton
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Abbrechen
            </GastarioButton>

            {step > 0 ? (
              <GastarioButton
                type="button"
                variant="secondary"
                onClick={goBack}
              >
                Zurück
              </GastarioButton>
            ) : null}

            {step < 3 ? (
              <GastarioButton
                type="button"
                variant="primary"
                onClick={goNext}
              >
                Weiter
              </GastarioButton>
            ) : (
              <GastarioButton
                type="submit"
                variant="primary"
              >
                Auftrag anlegen
              </GastarioButton>
            )}
          </>
        }
      >
        <GastarioStack>
          {serverError ? (
            <GastarioNotice type="danger">
              {serverError}
            </GastarioNotice>
          ) : null}

          {localError ? (
            <GastarioNotice type="warning">
              {localError}
            </GastarioNotice>
          ) : null}

          <GastarioTabs
            items={steps}
            activeId={String(
              step
            )}
            onChange={
              handleTabChange
            }
          />

          <div
            hidden={
              step !== 0
            }
          >
            <GastarioSection
              eyebrow="Schritt 1"
              title="Wer bestellt?"
              description="Die wichtigsten Kundendaten für den Auftrag."
            >
              <GastarioFormGrid
                columns={3}
              >
                <GastarioField
                  label="Kunde"
                  required
                >
                  <GastarioInput
                    name="customerName"
                    value={
                      customerName
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerName(
                        event.target
                          .value
                      )
                    }
                    placeholder="z. B. Muster GmbH"
                  />
                </GastarioField>

                <GastarioField label="E-Mail">
                  <GastarioInput
                    name="customerEmail"
                    type="email"
                    placeholder="kunde@example.de"
                  />
                </GastarioField>

                <GastarioField label="Telefon">
                  <GastarioInput
                    name="customerPhone"
                    placeholder="030..."
                  />
                </GastarioField>

                <GastarioField label="Kontaktperson">
                  <GastarioInput
                    name="contactName"
                    placeholder="Name"
                  />
                </GastarioField>

                <GastarioField label="Kontakt Telefon">
                  <GastarioInput
                    name="contactPhone"
                    placeholder="Mobil / Büro"
                  />
                </GastarioField>
              </GastarioFormGrid>

              <GastarioPanel variant="soft">
                Bestehende Kunden
                werden anhand von
                Name oder E-Mail
                erkannt. Neue Kunden
                legt Gastario beim
                Speichern automatisch
                an.
              </GastarioPanel>
            </GastarioSection>
          </div>

          <div
            hidden={
              step !== 1
            }
          >
            <GastarioSection
              eyebrow="Schritt 2"
              title="Wann und wohin?"
              description="Lieferdatum, Uhrzeit und Adresse."
            >
              <GastarioFormGrid
                columns={3}
              >
                <GastarioField
                  label="Lieferdatum"
                  required
                >
                  <GastarioInput
                    name="deliveryDate"
                    value={
                      deliveryDate
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryDate(
                        event.target
                          .value
                      )
                    }
                    inputMode="numeric"
                    placeholder="TT.MM.JJJJ"
                  />
                </GastarioField>

                <GastarioField label="Lieferzeit">
                  <GastarioInput
                    name="deliveryTime"
                    placeholder="z. B. 12:00"
                  />
                </GastarioField>

                <GastarioField label="Straße / Hausnummer">
                  <GastarioInput
                    name="deliveryStreet"
                    placeholder="Straße 12"
                  />
                </GastarioField>

                <GastarioField label="PLZ">
                  <GastarioInput
                    name="deliveryZip"
                    inputMode="numeric"
                    placeholder="10115"
                  />
                </GastarioField>

                <GastarioField label="Ort">
                  <GastarioInput
                    name="deliveryCity"
                    placeholder="Berlin"
                  />
                </GastarioField>
              </GastarioFormGrid>

              <GastarioField label="Zusatz zur Lieferadresse">
                <GastarioTextarea
                  name="deliveryAddressNote"
                  placeholder="Hinterhof, Etage, Klingelname, Ansprechpartner vor Ort..."
                />
              </GastarioField>
            </GastarioSection>
          </div>

          <div
            hidden={
              step !== 2
            }
          >
            <GastarioSection
              eyebrow="Schritt 3"
              title="Was wird bestellt?"
              description="Positionen, Mengen und Preise erfassen."
            >
              <GastarioStack>
                {items.map(
                  (
                    item,
                    index
                  ) => (
                    <GastarioPanel
                      key={
                        item.id
                      }
                      variant="soft"
                    >
                      <GastarioFormGrid
                        columns={4}
                      >
                        <GastarioField
                          label={`Position ${
                            index + 1
                          }`}
                        >
                          <GastarioInput
                            name="itemName"
                            value={
                              item.name
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                item.id,
                                "name",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="z. B. Chicken Bowl"
                          />
                        </GastarioField>

                        <GastarioField label="Menge">
                          <GastarioInput
                            name="quantity"
                            type="number"
                            min="0"
                            step="1"
                            value={
                              item.quantity
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                item.id,
                                "quantity",
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </GastarioField>

                        <GastarioField label="Einzelpreis netto">
                          <GastarioInput
                            name="unitPriceEuro"
                            value={
                              item.unitPriceEuro
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                item.id,
                                "unitPriceEuro",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="0,00"
                          />
                        </GastarioField>

                        <GastarioField label="Freitext / Hinweis">
                          <GastarioInput
                            name="itemNotes"
                            value={
                              item.itemNotes
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                item.id,
                                "itemNotes",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Allergene, Besonderheit, Beschreibung..."
                          />
                        </GastarioField>
                      </GastarioFormGrid>

                      <GastarioToolbar>
                        <GastarioButton
                          type="button"
                          variant="danger"
                          disabled={
                            items.length <=
                            1
                          }
                          onClick={() =>
                            removeItem(
                              item.id
                            )
                          }
                        >
                          Position löschen
                        </GastarioButton>
                      </GastarioToolbar>
                    </GastarioPanel>
                  )
                )}

                <GastarioToolbar>
                  <GastarioButton
                    type="button"
                    variant="primary"
                    onClick={
                      addItem
                    }
                  >
                    + Position
                  </GastarioButton>

                  <GastarioButton
                    type="button"
                    variant="secondary"
                    onClick={
                      addTextItem
                    }
                  >
                    + Freitextposition
                  </GastarioButton>
                </GastarioToolbar>

                <GastarioMetricGrid>
                  <GastarioMetric
                    label="Gesamtsumme netto"
                    value={formatEuro(
                      total
                    )}
                    description={`${items.length} Position(en)`}
                    badge="EUR"
                  />
                </GastarioMetricGrid>
              </GastarioStack>
            </GastarioSection>
          </div>

          <div
            hidden={
              step !== 3
            }
          >
            <GastarioSection
              eyebrow="Schritt 4"
              title="Prüfen und anlegen"
              description="Letzte Hinweise ergänzen und Auftrag anlegen."
            >
              <GastarioMetricGrid>
                <GastarioMetric
                  label="Kunde"
                  value={
                    customerName ||
                    "–"
                  }
                  description="Auftraggeber"
                />

                <GastarioMetric
                  label="Lieferdatum"
                  value={
                    deliveryDate ||
                    "–"
                  }
                  description="geplante Lieferung"
                />

                <GastarioMetric
                  label="Positionen"
                  value={
                    items.filter(
                      (item) =>
                        item.name.trim() ||
                        item.itemNotes.trim()
                    ).length
                  }
                  description="erfasste Leistungen"
                />

                <GastarioMetric
                  label="Netto"
                  value={formatEuro(
                    total
                  )}
                  description="Auftragswert"
                  badge="EUR"
                />
              </GastarioMetricGrid>

              <GastarioField label="Interne Notizen">
                <GastarioTextarea
                  name="notes"
                  rows={5}
                  placeholder="Besonderheiten, Absprachen, Hinweise..."
                />
              </GastarioField>

              <GastarioNotice type="neutral">
                Der Auftrag landet
                nach dem Anlegen im
                Auftragseingang und
                wird dort geprüft und
                bestätigt.
              </GastarioNotice>
            </GastarioSection>
          </div>
        </GastarioStack>
      </GastarioDialog>
    </Form>
  );
}