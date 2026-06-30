const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes", "gastario-control.mandanten.$tenantId.tsx");
let content = fs.readFileSync(file, "utf8");

content = content.replace(
`  if (intent === "createEmailAccount") {`,
`  if (intent === "createTenantUser") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();
    const role = String(formData.get("role") || "STAFF");

    if (!email) {
      return { error: "E-Mail-Adresse fehlt." };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const currentUserCount = await prisma.tenantUser.count({ where: { tenantId } });

    if (tenant && currentUserCount >= tenant.maxUsers) {
      return { error: "Limit erreicht: Für diesen Mandanten sind keine weiteren Benutzer erlaubt." };
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          passwordHash: "",
          platformRole: "USER",
        },
      });
    }

    const existingTenantUser = await prisma.tenantUser.findFirst({
      where: {
        tenantId,
        userId: user.id,
      },
    });

    if (existingTenantUser) {
      return { error: "Dieser Benutzer ist bereits diesem Mandanten zugeordnet." };
    }

    await prisma.tenantUser.create({
      data: {
        tenantId,
        userId: user.id,
        role: role as any,
      },
    });

    return { success: "Benutzer wurde dem Mandanten hinzugefügt." };
  }

  if (intent === "updateTenantUserRole") {
    const tenantUserId = String(formData.get("tenantUserId") || "");
    const role = String(formData.get("role") || "STAFF");

    if (!tenantUserId) {
      return { error: "Benutzer fehlt." };
    }

    await prisma.tenantUser.update({
      where: { id: tenantUserId },
      data: {
        role: role as any,
      },
    });

    return { success: "Benutzerrolle wurde aktualisiert." };
  }

  if (intent === "removeTenantUser") {
    const tenantUserId = String(formData.get("tenantUserId") || "");

    if (!tenantUserId) {
      return { error: "Benutzer fehlt." };
    }

    await prisma.tenantUser.delete({
      where: { id: tenantUserId },
    });

    return { success: "Benutzer wurde vom Mandanten entfernt." };
  }

  if (intent === "createEmailAccount") {`
);

content = content.replace(
`        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Benutzer</div>
              <h2 className="panelTitle">Zugänge</h2>
            </div>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Noch keine Benutzer vorhanden.</td>
                  </tr>
                ) : (
                  users.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.user.name || "-"}</td>
                      <td>{entry.user.email}</td>
                      <td>{entry.role}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>`,
`        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Benutzer</div>
              <h2 className="panelTitle">Zugänge verwalten</h2>
            </div>
          </div>

          <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 150px auto", gap: 10, marginBottom: 14 }}>
            <input type="hidden" name="intent" value="createTenantUser" />

            <input name="name" placeholder="Name optional" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }} />

            <input name="email" type="email" placeholder="benutzer@firma.de" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }} />

            <select name="role" defaultValue="STAFF" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }}>
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Mitarbeiter</option>
            </select>

            <button className="btn btnPrimary" type="submit">Hinzufügen</button>
          </Form>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Noch keine Benutzer vorhanden.</td>
                  </tr>
                ) : (
                  users.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.user.name || "-"}</td>
                      <td>{entry.user.email}</td>
                      <td>
                        <Form method="post" style={{ display: "flex", gap: 8 }}>
                          <input type="hidden" name="intent" value="updateTenantUserRole" />
                          <input type="hidden" name="tenantUserId" value={entry.id} />
                          <select name="role" defaultValue={entry.role} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "8px 10px" }}>
                            <option value="OWNER">Owner</option>
                            <option value="ADMIN">Admin</option>
                            <option value="STAFF">Mitarbeiter</option>
                          </select>
                          <button className="btn" type="submit">Speichern</button>
                        </Form>
                      </td>
                      <td>
                        <Form method="post">
                          <input type="hidden" name="intent" value="removeTenantUser" />
                          <input type="hidden" name="tenantUserId" value={entry.id} />
                          <button className="btn" type="submit" style={{ color: "#b91c1c" }}>
                            Entfernen
                          </button>
                        </Form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>`
);

fs.writeFileSync(file, content, "utf8");
console.log("Benutzerverwaltung ergänzt.");
