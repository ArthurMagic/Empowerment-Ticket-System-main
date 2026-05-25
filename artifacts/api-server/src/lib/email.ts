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
  logger.info({ to: opts.to, token: opts.token }, "[DEBUG 1/7] Funktion aufgerufen.");

  const gmailUser = process.env["GMAIL_USER"];
  const gmailPass = process.env["GMAIL_PASS"];

  if (!gmailUser || !gmailPass) {
    logger.warn("[DEBUG ABBRUCH] GMAIL_USER oder GMAIL_PASS fehlt.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  try {
    await transporter.verify();
    logger.info("[DEBUG 4/7] SMTP-Verbindung zu Google steht.");
  } catch (verifyError) {
    logger.error({ error: verifyError }, "[DEBUG ERROR] Google-Login fehlgeschlagen.");
    throw verifyError;
  }

  const emailHtml = buildEmailHtml(opts);
  const shortToken = opts.token.slice(0, 6).toUpperCase();
  const subject = `[Ref: ${shortToken}] Deine Reservierung für EMPOWERMENT – ${opts.ticketCount} Ticket${opts.ticketCount > 1 ? "s" : ""}`;

  try {
    logger.info("[DEBUG 6/7] Sende Mail via Gmail SMTP...");
    
    const base64Data = opts.qrCodeDataUrl.includes(",") 
      ? opts.qrCodeDataUrl.split(",")[1] 
      : opts.qrCodeDataUrl;

    await transporter.sendMail({
      from: `"EMPOWERMENT Tickets" <${gmailUser}>`,
      to: opts.to,
      subject: subject,
      html: emailHtml,
      attachments: [
        {
          filename: "ticket-qrcode-inline.png",
          content: base64Data,
          encoding: "base64",
          contentType: "image/png",
          cid: "ticket-qrcode", // Durch das 'cid' weiß Nodemailer automatisch, dass es "inline" gehört
        },
        {
          filename: `EMPOWERMENT-Ticket-${shortToken}.png`,
          content: base64Data,
          encoding: "base64",
          contentType: "image/png", // Ohne 'cid' wird es automatisch ein normaler Download-Anhang
        },
      ],
    });

    logger.info({ to: opts.to }, "[DEBUG 7/7] E-Mail wurde von Google gesendet!");
  } catch (error) {
    logger.error({ error }, "[DEBUG ERROR] Fehler beim Senden!");
    throw new Error(`Email send failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildEmailHtml(opts: TicketEmailOptions): string {
  const { name, ticketCount, specialNeeds, token } = opts;
  const eventDate = "30. Juni 2026, 19:00 Uhr";
  const eventLocation = "Haus der Jugend Charlottenburg, Zillestr. 54, 10585 Berlin";
  const timestamp = new Date().toISOString();

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
                    
                    <img src="cid:ticket-qrcode" alt="QR Code" width="200" height="200" style="display:block;margin:0 auto;" />
                    
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
                    <p style="margin:8px 0 0 0;font-size:10px;color:#ccc;">ID: ${token} | T: ${timestamp}</p>
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