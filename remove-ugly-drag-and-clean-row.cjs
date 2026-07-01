const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Drag-State und Funktion entfernen
text = text.replace(
`  const [draggingRowId, setDraggingRowId] = useState<number | null>(null);

  function movePositionRow(fromId: number, toId: number) {
    if (fromId === toId) return;

    setPositionRows((rows) => {
      const fromIndex = rows.findIndex((row) => row.id === fromId);
      const toIndex = rows.findIndex((row) => row.id === toId);

      if (fromIndex === -1 || toIndex === -1) return rows;

      const nextRows = [...rows];
      const [movedRow] = nextRows.splice(fromIndex, 1);
      nextRows.splice(toIndex, 0, movedRow);

      return nextRows;
    });
  }

`, "");

// Drag-Handler aus Positionszeilen entfernen
text = text.replace(
`                  <div
                    key={row.id}
                    data-position-row={row.type}
                    draggable
                    onDragStart={(event) => {
                      setDraggingRowId(row.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(row.id));
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const fromId = Number(event.dataTransfer.getData("text/plain"));
                      movePositionRow(fromId, row.id);
                      setDraggingRowId(null);
                    }}
                    onDragEnd={() => setDraggingRowId(null)}
                    style={{`,
`                  <div
                    key={row.id}
                    data-position-row={row.type}
                    style={{`
);

// Drag-Optik entfernen
text = text.replace(
`background: draggingRowId === row.id ? "#f1f5f9" : "#ffffff",
                      opacity: draggingRowId === row.id ? 0.65 : 1,
                      cursor: "grab"`,
`background: "#ffffff"`
);

// Spalte links wieder normal
text = text.replaceAll(
  `"58px minmax(320px, 1fr) 86px 118px 138px 92px 150px 38px"`,
  `"42px minmax(320px, 1fr) 86px 118px 138px 92px 150px 38px"`
);

text = text.replaceAll(
  `"58px minmax(0, 1fr) 40px"`,
  `"42px minmax(0, 1fr) 40px"`
);

// Griff + Nummer wieder nur Nummer
const oldNumberBlock = `                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginTop: row.type === "text" ? 24 : 26,
                      color: "#777"
                    }}>
                      <span
                        title="Position verschieben"
                        style={{
                          fontSize: 18,
                          lineHeight: 1,
                          cursor: "grab",
                          userSelect: "none"
                        }}
                      >
                        ↕
                      </span>

                      <span style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: "#eeeeee",
                        color: "#555",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 850
                      }}>
                        {rowIndex + 1}
                      </span>
                    </div>`;

const newNumberBlock = `                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: "#eeeeee",
                      color: "#555",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 850,
                      marginTop: row.type === "text" ? 24 : 26
                    }}>
                      {rowIndex + 1}
                    </div>`;

text = text.replace(oldNumberBlock, newNumberBlock);

// Unten den hässlichen Freitext-Hinweis entfernen
text = text.replace(
`                  <span style={{
                    color: "#666",
                    padding: "8px 6px",
                    fontWeight: 850,
                    fontSize: 14
                  }}>
                    ≡ Freitext direkt unter Artikel
                  </span>`,
""
);

// Falls nur Text übrig ist
text = text.replaceAll("≡ Freitext direkt unter Artikel", "");

// Buttonleiste ruhiger
text = text.replaceAll(
  `gap: 24,
                  padding: "18px 18px 22px",`,
  `gap: 22,
                  padding: "16px 18px 20px",`
);

// Summenleiste etwas weniger wuchtig
text = text.replaceAll(
  `minHeight: 74,`,
  `minHeight: 68,`
);

text = text.replaceAll(
  `fontSize: 26, fontWeight: 500`,
  `fontSize: 24, fontWeight: 500`
);

text = text.replaceAll(
  `fontSize: 26, fontWeight: 800`,
  `fontSize: 24, fontWeight: 800`
);

fs.writeFileSync(file, text, "utf8");
