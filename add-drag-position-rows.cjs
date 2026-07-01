const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Drag-State und Reorder-Funktion nach positionRows-State einfügen
const oldState = `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);`;

const newState = `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);
  const [draggingRowId, setDraggingRowId] = useState<number | null>(null);

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
  }`;

if (!text.includes(oldState)) {
  throw new Error("positionRows-State wurde nicht gefunden.");
}

text = text.replace(oldState, newState);

// Grid erste Spalte breiter machen, damit Griff + Nummer passen
text = text.replaceAll(
  `"42px minmax(320px, 1fr) 86px 118px 138px 92px 150px 38px"`,
  `"58px minmax(320px, 1fr) 86px 118px 138px 92px 150px 38px"`
);

text = text.replaceAll(
  `"42px minmax(0, 1fr) 40px"`,
  `"58px minmax(0, 1fr) 40px"`
);

// Row draggable machen
const oldRowStart = `                  <div
                    key={row.id}
                    data-position-row={row.type}
                    style={{`;

const newRowStart = `                  <div
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
                    style={{`;

if (!text.includes(oldRowStart)) {
  throw new Error("Positionszeilen-Start wurde nicht gefunden.");
}

text = text.replace(oldRowStart, newRowStart);

// Zeilen optisch beim Ziehen markieren
text = text.replace(
  `background: "#ffffff"
                    }}`,
  `background: draggingRowId === row.id ? "#f1f5f9" : "#ffffff",
                      opacity: draggingRowId === row.id ? 0.65 : 1,
                      cursor: "grab"
                    }}`
);

// Nummernkreis durch Griff + Nummer ersetzen
const oldNumberBlock = `                    <div style={{
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

const newNumberBlock = `                    <div style={{
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

if (!text.includes(oldNumberBlock)) {
  throw new Error("Nummernblock wurde nicht gefunden.");
}

text = text.replace(oldNumberBlock, newNumberBlock);

fs.writeFileSync(file, text, "utf8");
