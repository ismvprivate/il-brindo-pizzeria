// ============================================================
// CONFIGURATION — all sensitive values come from environment variables.
// Set these in Netlify: Site Settings > Environment Variables.
// For local testing, create a .env file (see .env.example).
// ============================================================
const RESTAURANT_NAME      = "Il Brindo Pizzeria";
const EMAILJS_SERVICE_ID   = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID  = process.env.EMAILJS_TEMPLATE_CONFIRM;
const EMAILJS_PUBLIC_KEY   = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY  = process.env.EMAILJS_PRIVATE_KEY;
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

  // Format date in Italian
  const dateObj     = new Date(date + "T12:00:00");
  const italianDate = dateObj.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const guestsNum   = parseInt(guests, 10);

  // If customer provided an email, send a confirmation via EmailJS REST API
  let emailSent = false;
  let emailError = null;

  if (email) {
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
      emailError = "Variabili EmailJS non configurate in Netlify.";
      console.error("EmailJS env vars missing:", { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY: !!EMAILJS_PRIVATE_KEY });
    } else {
      const emailPayload = {
        service_id:   EMAILJS_SERVICE_ID,
        template_id:  EMAILJS_TEMPLATE_ID,
        user_id:      EMAILJS_PUBLIC_KEY,
        accessToken:  EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email:        email,
          to_name:         name,
          restaurant_name: RESTAURANT_NAME,
          date:            italianDate,
          time_slot:       time_slot,
          guests:          String(guestsNum),
          phone:           phone,
        },
      };

      try {
        const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(emailPayload),
        });
        if (res.ok) {
          emailSent = true;
        } else {
          const errText = await res.text();
          emailError = `EmailJS errore ${res.status}: ${errText}`;
          console.error("EmailJS confirm error:", errText);
        }
      } catch (err) {
        emailError = `Errore di rete: ${err.message}`;
        console.error("EmailJS fetch error:", err);
      }
    }
  }

  const emailStatusHtml = email
    ? (emailSent
        ? "<br><br>✅ Email di conferma inviata al cliente."
        : `<br><br>⚠️ Email NON inviata al cliente. Errore: ${escHtml(emailError || "sconosciuto")}. Contattalo al ${escHtml(phone)}.`)
    : "";

  return htmlPage(
    "Prenotazione confermata ✅",
    `Hai confermato la prenotazione di <strong>${escHtml(name)}</strong> per <strong>${guestsNum} person${guestsNum === 1 ? "a" : "e"}</strong> il <strong>${escHtml(italianDate)}</strong> alle <strong>${escHtml(time_slot)}</strong>.${emailStatusHtml}`
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
    <div class="icon">✅</div>
    <h1>${escHtml(title)}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`,
  };
}
