const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// useEffect import ergänzen
content = content.replace(
  'import { useState } from "react";',
  'import { useEffect, useState } from "react";'
);

// kaputten Auto-Refresh-Block entfernen
content = content.replace(
`  if (typeof window !== "undefined" && autoRefreshEnabled) {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (!isTyping) {
        window.location.reload();
      }
    }, 30000);
  }`,
`  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = window.setInterval(() => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (!isTyping) {
        window.location.reload();
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled]);`
);

// doppelte Labels reparieren
content = content.replaceAll("Sonstiges / Absagen / Absagen", "Sonstiges / Absagen");
content = content.replaceAll("Erinnerungen / Lieferscheine / Lieferscheine", "Erinnerungen / Lieferscheine");

fs.writeFileSync(path, content, "utf8");
console.log("500-Fix fuer Auftragseingang angewendet.");
