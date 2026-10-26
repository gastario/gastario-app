import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioDataList,
  GastarioDataRow,
  GastarioToolbar,
  GastarioButton,
  GastarioSplitView,
  GastarioSplitMain,
  GastarioSplitAside,
} from "../components/ui";

const revenueBySource = [
  {
    source: "Direkt",
    revenue: "12.840 €",
    orders: "18 Aufträge",
    share: "46 %",
  },
  {
    source: "Heycater",
    revenue: "8.260 €",
    orders: "11 Aufträge",
    share: "30 %",
  },
  {
    source: "Egora",
    revenue: "4.120 €",
    orders: "5 Aufträge",
    share: "15 %",
  },
  {
    source: "E-Mail",
    revenue: "2.480 €",
    orders: "4 Aufträge",
    share: "9 %",
  },
];

const topProducts = [
  {
    product: "Chicken Bowl",
    quantity: "420 Stück",
    revenue: "4.578 €",
    margin: "71 %",
  },
  {
    product: "Falafel Bowl",
    quantity: "310 Stück",
    revenue: "3.255 €",
    margin: "74 %",
  },
  {
    product: "Frühstücksbox",
    quantity: "180 Personen",
    revenue: "2.502 €",
    margin: "63 %",
  },
  {
    product: "Fingerfood Platte",
    quantity: "74 Platten",
    revenue: "2.146 €",
    margin: "59 %",
  },
];

const weeklyNumbers = [
  {
    label: "Montag",
    value: "3.240 €",
  },
  {
    label: "Dienstag",
    value: "4.120 €",
  },
  {
    label: "Mittwoch",
    value: "5.680 €",
  },
  {
    label: "Donnerstag",
    value: "6.210 €",
  },
  {
    label: "Freitag",
    value: "8.450 €",
  },
];

export function meta() {
  return [
    {
      title: "Auswertungen · Gastario",
    },
  ];
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Übersicht"
          title="Auswertungen"
          description="Umsatz, Aufträge und Wirtschaftlichkeit kompakt im Blick behalten."
          actions={
            <GastarioToolbar>
              <GastarioButton
                type="button"
                variant="secondary"
              >
                Zeitraum wählen
              </GastarioButton>

              <GastarioButton
                type="button"
                variant="primary"
              >
                Exportieren
              </GastarioButton>
            </GastarioToolbar>
          }
        />

        <GastarioMetricGrid>
          <GastarioMetric
            label="Umsatz"
            value="27.700 €"
            description="+18 % zum Vormonat"
            badge="Monat"
          />

          <GastarioMetric
            label="Aufträge"
            value="38"
            description="Ø 729 € Auftragswert"
            badge="Monat"
          />

          <GastarioMetric
            label="Wareneinsatz"
            value="31 %"
            description="Über kalkulierte Produkte"
            badge="Aktuell"
          />
        </GastarioMetricGrid>

        <GastarioSplitView>
          <GastarioSplitMain>
            <GastarioSection
              eyebrow="Umsatz"
              title="Nach Quelle"
              actions={
                <GastarioButton
                  type="button"
                  variant="secondary"
                >
                  Monat
                </GastarioButton>
              }
            >
              <GastarioDataList>
                {revenueBySource.map((item) => (
                  <GastarioDataRow key={item.source}>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {item.source}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {item.orders}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {item.revenue}
                      </strong>

                      <span>
                        {item.share}
                      </span>
                    </div>
                  </GastarioDataRow>
                ))}
              </GastarioDataList>
            </GastarioSection>
          </GastarioSplitMain>

          <GastarioSplitAside>
            <GastarioSection
              eyebrow="Produkte"
              title="Top-Produkte"
              actions={
                <GastarioButton
                  type="button"
                  variant="secondary"
                >
                  Marge
                </GastarioButton>
              }
            >
              <GastarioDataList>
                {topProducts.map((item) => (
                  <GastarioDataRow key={item.product}>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {item.product}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {item.quantity}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {item.revenue}
                      </strong>

                      <span>
                        {item.margin}
                      </span>
                    </div>
                  </GastarioDataRow>
                ))}
              </GastarioDataList>
            </GastarioSection>
          </GastarioSplitAside>
        </GastarioSplitView>

        <GastarioSection
          eyebrow="Verlauf"
          title="Umsatz nach Liefertag"
          actions={
            <GastarioButton
              type="button"
              variant="secondary"
            >
              Details
            </GastarioButton>
          }
        >
          <GastarioDataList>
            {weeklyNumbers.map((day) => (
              <GastarioDataRow key={day.label}>
                <div className="g-ui-data-row-main">
                  <strong className="g-ui-data-row-title">
                    {day.label}
                  </strong>

                  <span className="g-ui-data-row-description">
                    Liefertag
                  </span>
                </div>

                <div className="g-ui-data-row-meta">
                  <strong>
                    {day.value}
                  </strong>
                </div>
              </GastarioDataRow>
            ))}
          </GastarioDataList>
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}