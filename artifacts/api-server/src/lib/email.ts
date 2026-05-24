import nodemailer from "nodemailer";
import { logger } from "./logger";

interface TicketEmailOptions {
  to: string;
  name: string;
  ticketCount: number;
  specialNeeds?: string | null;
  token: string;
  qrCodeDataUrl: string;
}

export async function sendTicketConfirmationEmail(opts: TicketEmailOptions): Promise<void> {
  // [DEBUG 1] Funktionsstart & Parameter-Check
  logger.info(
    { 
      to: opts.to, 
      name: opts.name, 
      ticketCount: opts.ticketCount, 
      token: opts.token,
      specialNeeds: opts.specialNeeds,
      qrCodeDataSize: opts.qrCodeDataUrl ? `${opts.qrCodeDataUrl.length} Zeichen` : "Fehlt/Leer"
    }, 
    "[DEBUG 1/7] Funktion 'sendTicketConfirmationEmail' aufgerufen."
  );

  const gmailUser = process.env["GMAIL_USER"];
  const gmailPass = process.env["GMAIL_PASS"];

  // [DEBUG 2] Überprüfung der .env Variablen
  logger.info(
    { 
      GMAIL_USER_exists: !!gmailUser, 
      GMAIL_USER_value: gmailUser || null,
      GMAIL_PASS_exists: !!gmailPass,
      GMAIL_PASS_length: gmailPass ? gmailPass.length : 0
    }, 
    "[DEBUG 2/7] Umgebungsvariablen aus der .env.local ausgelesen."
  );

  if (!gmailUser || !gmailPass) {
    logger.warn("[DEBUG ABBRUCH] GMAIL_USER oder GMAIL_PASS fehlt in den Umgebungsvariablen — Abbruch!");
    return;
  }

  // [DEBUG 3] Transporter-Konfiguration initialisieren
  logger.info("[DEBUG 3/7] Initialisiere Nodemailer SMTP-Transporter für den Service 'gmail'...");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  // [DEBUG 4] Verbindungstest zu Google (Verify)
  try {
    logger.info("[DEBUG 4/7] Teste SMTP-Verbindung und Zugangsdaten bei Google (transporter.verify)...");
    await transporter.verify();
    logger.info("[DEBUG 4a/7] Google SMTP-Verbindung erfolgreich hergestellt und authentifiziert!");
  } catch (verifyError) {
    logger.error(
      { error: verifyError instanceof Error ? verifyError.message : String(verifyError) }, 
      "[DEBUG ERROR] Google hat die Zugangsdaten oder die Verbindung abgelehnt!"
    );
    throw verifyError; // Wir brechen direkt ab, da das Senden sowieso fehlschlagen würde
  }

  // [DEBUG 5] HTML-Template bauen
  logger.info("[DEBUG 5/7] Starte Generierung des HTML-Mail-Inhalts via buildEmailHtml()...");
  const emailHtml = buildEmailHtml(opts);
  logger.info(
    { htmlTotalLength: emailHtml.length }, 
    "[DEBUG 5a/7] HTML-Inhalt erfolgreich gerendert."
  );

  const subject = `Deine Reservierung für EMPOWERMENT – ${opts.ticketCount} Ticket${opts.ticketCount > 1 ? "s" : ""}`;
  logger.info({ subject }, "[DEBUG 6/7] Betreffzeile generiert.");

  // [DEBUG 6] Sendevorgang ausführen
  logger.info(
    { from: `"EMPOWERMENT Tickets" <${gmailUser}>`, to: opts.to }, 
    "[DEBUG 6a/7] Sende Mail-Befehl an Google SMTP ab..."
  );

  try {
    const info = await transporter.sendMail({
      from: `"EMPOWERMENT Tickets" <${gmailUser}>`,
      to: opts.to,
      subject: subject,
      html: emailHtml,
    });

    // [DEBUG 7] Erfolgs-Log mit Google Server-Antwort
    logger.info(
      { 
        messageId: info.messageId, 
        response: info.response, 
        accepted: info.accepted, 
        rejected: info.rejected 
      }, 
      "[DEBUG 7/7] Google hat die E-Mail entgegengenommen!"
    );

    logger.info({ to: opts.to, token: opts.token }, "Ticket confirmation email sent via Gmail");
  } catch (error) {
    // Ausgiebiges Fehler-Debugging
    logger.error(
      { 
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        to: opts.to 
      }, 
      "[DEBUG ERROR] Kritischer Fehler im Sendevorgang (transporter.sendMail)!"
    );
    throw new Error(`Email send failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildEmailHtml(opts: TicketEmailOptions): string {
  const { name, ticketCount, specialNeeds, qrCodeDataUrl } = opts;
  const eventDate = "30. Juni 2026, 19:00 Uhr";
  const eventLocation = "Haus der Jugend Charlottenburg, Zillestr. 54, 10585 Berlin";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deine EMPOWERMENT Tickets</title>
</head>
<body style="margin:0;padding:0;background-color:#1a0a1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a0a1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <tr>
            <td style="background:linear-gradient(135deg,#c2185b,#e91e8c,#ff69b4);padding:48px 40px;text-align:center;border-radius:16px 16px 0 0;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.2em;color:rgba(255,255,255,0.7);text-transform:uppercase;">Internationale Begegnung · Trento-Berlin 2026</p>
              <h1 style="margin:0;font-size:52px;font-weight:900;color:#fff;letter-spacing:-2px;line-height:1;">EMPOWER</h1>
              <h1 style="margin:0 0 8px 0;font-size:52px;font-weight:900;color:#fff;letter-spacing:-2px;line-height:1;">MENT</h1>
              <p style="margin:16px 0 0 0;font-size:15px;color:rgba(255,255,255,0.85);">Barbie · KEN · Power</p>
            </td>
          </tr>

          <tr>
            <td style="background:#fff;padding:40px;">
              <h2 style="margin:0 0 8px 0;font-size:24px;color:#1a0a1a;">Hallo ${escapeHtml(name)}! 🎭</h2>
              <p style="margin:0 0 24px 0;font-size:16px;color:#555;line-height:1.6;">
                Deine Reservierung für <strong>EMPOWERMENT</strong> ist bestätigt! Wir freuen uns darauf, dich bei unserer Aufführung zu begrüßen.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fce4ec;border-left:4px solid #c2185b;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;">
                    <table width="100%">
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="font-size:13px;font-weight:600;color:#c2185b;text-transform:uppercase;letter-spacing:0.1em;">Veranstaltung</span><br/>
                          <span style="font-size:16px;color:#1a0a1a;font-weight:600;">EMPOWERMENT</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="font-size:13px;font-weight:600;color:#c2185b;text-transform:uppercase;letter-spacing:0.1em;">Datum &amp; Uhrzeit</span><br/>
                          <span style="font-size:16px;color:#1a0a1a;font-weight:600;">${eventDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="font-size:13px;font-weight:600;color:#c2185b;text-transform:uppercase;letter-spacing:0.1em;">Ort</span><br/>
                          <span style="font-size:16px;color:#1a0a1a;font-weight:600;">${eventLocation}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="font-size:13px;font-weight:600;color:#c2185b;text-transform:uppercase;letter-spacing:0.1em;">Anzahl Tickets</span><br/>
                          <span style="font-size:16px;color:#1a0a1a;font-weight:600;">${ticketCount} Person${ticketCount > 1 ? "en" : ""}</span>
                        </td>
                      </tr>
                      ${specialNeeds ? `
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="font-size:13px;font-weight:600;color:#c2185b;text-transform:uppercase;letter-spacing:0.1em;">Besondere Anforderungen</span><br/>
                          <span style="font-size:16px;color:#1a0a1a;">${escapeHtml(specialNeeds)}</span>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:24px;background:#fafafa;border-radius:12px;border:2px dashed #e91e8c;margin-bottom:32px;">
                    <p style="margin:0 0 16px 0;font-size:14px;font-weight:700;color:#c2185b;text-transform:uppercase;letter-spacing:0.1em;">Dein Ticket-QR-Code</p>
                    <img src="${qrCodeDataUrl}" alt="QR Code" width="200" height="200" style="display:block;margin:0 auto;" />
                    <p style="margin:16px 0 0 0;font-size:12px;color:#999;">Zeige diesen QR-Code am Einlass vor</p>
                  </td>
                </tr>
              </table>

              <div style="height:32px;"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;margin-top:16px;">
                <tr>
                  <td style="padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
                      <strong>Datenschutzhinweis:</strong> Deine Daten (Name, E-Mail, Ticketanzahl) werden ausschließlich zur Verwaltung deiner Reservierung verwendet und nach der Veranstaltung gelöscht. Veranstalter: Jugendamt Charlottenburg-Wilmersdorf &amp; Jugendclubring Berlin e.V.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#1a0a1a;padding:24px 40px;text-align:center;border-radius:0 0 16px 16px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
                Jugendamt Charlottenburg-Wilmersdorf · Jugendclubring Berlin e.V.<br/>
                Unter der Schirmherrschaft von Bezirksstadtrat Simon Hertel<br/>
                Haus der Jugend Charlottenburg · Zillestr. 54 · 10585 Berlin
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}