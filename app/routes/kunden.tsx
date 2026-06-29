import AppLayout from "../components/AppLayout";

const customers = [
  {
    name: "Muster GmbH",
    type: "Firma",
    contact: "Frau Schulz",
    email: "events@muster-gmbh.de",
    phone: "030 123456",
    address: "Musterstraße 12, 10115 Berlin",
    orders: "12 Aufträge",
    status: "Stammkunde",
  },
  {
    name: "ABC Consulting",
    type: "Firma",
    contact: "Herr Wagner",
    email: "office@abc-consulting.de",
    phone: "030 987654",
    address: "Friedrichstraße 88, 10117 Berlin",
    orders: "8 Aufträge",
    status: "Aktiv",
  },
  {
    name: "Eventagentur Berlin",
    type: "Agentur",
    contact: "Jana Keller",
    email: "booking@eventagentur-berlin.de",
    phone: "0176 555555",
    address: "Köpenicker Straße 40, 10997 Berlin",
    orders: "5 Aufträge",
    status: "Aktiv",
  },
  {
    name: "Müller & Partner",
    type: "Firma",
    contact: "Herr Müller",
    email: "kontakt@mueller-partner.de",
    phone: "030 456789",
    address: "Kurfürstendamm 210, 10719 Berlin",
    orders: "2 Aufträge",
    status: "Neu",
  },
];

export function meta() {
  return [{ title: "Kunden · Gastario" }];
}

export default function CustomersPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Kunden</h1>
          <span className="pageSubline">
            Firmenkunden, Ansprechpartner, Lieferadressen und Rechnungsdaten zentral verwalten.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Importieren</button>
          <button className="primaryButton">Neuer Kunde</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Kunden gesamt</p>
            <strong>48</strong>
            <span>davon 21 Firmenkunden</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Stammkunden</p>
            <strong>14</strong>
            <span>regelmäßige Aufträge</span>
          </div>
          <small data-trend="bereit">stabil</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Neue Kontakte</p>
            <strong>6</strong>
            <span>in den letzten 30 Tagen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Kundenübersicht</p>
            <h2>Aktuelle Kunden</h2>
          </div>

          <div className="filterActions">
            <button className="ghostButton">Alle Typen</button>
            <button className="ghostButton">Status filtern</button>
          </div>
        </div>

        <div className="customersGrid">
          {customers.map((customer) => (
            <article className="customerCard" key={customer.name}>
              <div className="customerTop">
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.type} · {customer.status}</span>
                </div>
                <small>{customer.orders}</small>
              </div>

              <div className="customerDetails">
                <p>
                  <b>Ansprechpartner</b>
                  <span>{customer.contact}</span>
                </p>
                <p>
                  <b>E-Mail</b>
                  <span>{customer.email}</span>
                </p>
                <p>
                  <b>Telefon</b>
                  <span>{customer.phone}</span>
                </p>
                <p>
                  <b>Adresse</b>
                  <span>{customer.address}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
