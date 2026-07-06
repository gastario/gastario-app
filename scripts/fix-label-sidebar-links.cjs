const fs = require("fs");

const path = "app/components/AppLayout.tsx";
let content = fs.readFileSync(path, "utf8");

// Sidebar-Links korrigieren
content = content.replace(
  /{ label: "MHD-Labels", to: "\/foodlabels" }/g,
  '{ label: "MHD-Labels", to: "/mhd-labels" }'
);

content = content.replace(
  /{ label: "Foodlabel erstellen", to: "\/foodlabels\/neu" }/g,
  '{ label: "Foodlabel erstellen", to: "/foodlabels" }'
);

// Falls Schreibweise anders ist, nochmal robust ersetzen
content = content.replace(
  /label: "MHD-Labels",\s*to: "\/foodlabels"/g,
  'label: "MHD-Labels", to: "/mhd-labels"'
);

content = content.replace(
  /label: "Foodlabel erstellen",\s*to: "\/foodlabels\/neu"/g,
  'label: "Foodlabel erstellen", to: "/foodlabels"'
);

fs.writeFileSync(path, content, "utf8");
console.log("Sidebar-Links fuer MHD-Labels und Foodlabels korrigiert.");
