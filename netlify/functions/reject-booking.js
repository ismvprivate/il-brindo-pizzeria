// ============================================================
// CONFIGURATION — all sensitive values come from environment variables.
// Set these in Netlify: Site Settings > Environment Variables.
// For local testing, create a .env file (see .env.example).
// ============================================================
const RESTAURANT_NAME     = "Il Brindo Pizzeria";
const RESTAURANT_PHONE    = "342 762 3961";
const EMAILJS_SERVICE_ID  = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_REJECT;
const EMAILJS_PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY;
// ============================================================

exports.handler = async (event) => {
  const { token } = event.queryStringParameters || {};

  if (!token) {
    return htmlPage("Errore", "Link non valido o scaduto.");
  }

  let booking;
  try {
    booking = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return htmlPage("Errore", "Link non valido o scaduto.");
  }

  const { name, phone, email, date, time_slot, guests } = booking;

  const dateObj     = new Date(date + "T12:00:00");
  const italianDate = dateObj.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const guestsNum   = parseInt(guests, 10);

  // If customer provided an email, send a polite rejection via EmailJS REST API
  if (email) {
    const emailPayload = {
      service_id:  EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id:     EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email:         email,
        to_name:          name,
        restaurant_name:  RESTAURANT_NAME,
        restaurant_phone: RESTAURANT_PHONE,
        date:             italianDate,
        time_slot:        time_slot,
        guests:           String(guestsNum),
        phone:            phone,
      },
    };

    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(emailPayload),
      });
      if (!res.ok) {
        console.error("EmailJS reject error:", await res.text());
      }
    } catch (err) {
      console.error("EmailJS fetch error:", err);
    }
  }

  return htmlPage(
    "Prenotazione rifiutata ❌",
    `Hai rifiutato la prenotazione di <strong>${escHtml(name)}</strong> per il <strong>${escHtml(italianDate)}</strong> alle <strong>${escHtml(time_slot)}</strong>.${email ? "<br><br>Una email di comunicazione è stata inviata al cliente." : `<br><br><strong>Nota:</strong> il cliente non ha fornito un'email — contattalo telefonicamente al ${escHtml(phone)} se necessario.`}`
  );
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title, body) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(title)} — Il Brindo Pizzeria</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #F5F0E8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; max-width: 480px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,.10); }
    h1 { font-size: 24px; margin-bottom: 16px; color: #1E1C1A; }
    p { font-size: 16px; line-height: 1.7; color: #3C3835; }
    .icon { font-size: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>${escHtml(title)}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`,
  };
}
