// ============================================================
// CONFIGURATION — all sensitive values come from environment variables.
// Set these in Netlify: Site Settings > Environment Variables.
// For local testing, create a .env file (see .env.example).
// ============================================================
const RESTAURANT_NAME      = "Il Brindo Pizzeria";
const OWNER_WHATSAPP       = process.env.CALLMEBOT_PHONE;      // set in Netlify env vars
const CALLMEBOT_API_KEY    = process.env.CALLMEBOT_API_KEY;    // set in Netlify env vars
const LARGE_GROUP_THRESHOLD = 8;               // Guests >= this trigger the large-group warning
const CUTOFF_HOUR          = 18;               // After this hour (Italy time) today is not bookable
const OPEN_DAYS            = [5, 6, 0, 1];    // 5=Fri, 6=Sat, 0=Sun, 1=Mon
// Netlify sets process.env.URL automatically to your site's URL.
const BASE_URL = process.env.URL || "https://il-brindo.netlify.app";
// ============================================================

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON non valido" }) };
  }

  const { name, phone, email, date, time_slot, guests, notes } = body;

  // --- Validation ---
  if (!name || !phone || !date || !time_slot || !guests) {
    return { statusCode: 400, body: JSON.stringify({ error: "Campi obbligatori mancanti." }) };
  }

  // --- Date validation (open days only, cutoff hour) ---
  const bookingDate = new Date(date + "T00:00:00"); // force local midnight
  const dayOfWeek   = bookingDate.getDay();

  if (!OPEN_DAYS.includes(dayOfWeek)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Il ristorante è aperto solo venerdì, sabato, domenica e lunedì." }),
    };
  }

  // Check if booking date is today and it's past the cutoff hour (Italy time UTC+2/+1)
  const now          = new Date();
  const italyOffset  = 2 * 60; // minutes — CEST; adjust to 1 for CET if needed
  const italyNow     = new Date(now.getTime() + italyOffset * 60000);
  const todayStr     = italyNow.toISOString().split("T")[0];

  if (date === todayStr && italyNow.getHours() >= CUTOFF_HOUR) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Le prenotazioni per oggi non sono più accettate dopo le 18:00. Scegli un altro giorno." }),
    };
  }

  // --- Build a unique booking token (used for confirm/reject links) ---
  const token = Buffer.from(JSON.stringify({ name, phone, email, date, time_slot, guests, notes })).toString("base64url");

  const confirmUrl = `${BASE_URL}/.netlify/functions/confirm-booking?token=${token}`;
  const rejectUrl  = `${BASE_URL}/.netlify/functions/reject-booking?token=${token}`;

  // --- Format date in Italian ---
  const dateObj      = new Date(date + "T12:00:00");
  const italianDate  = dateObj.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const guestsNum    = parseInt(guests, 10);
  const isLargeGroup = guestsNum >= LARGE_GROUP_THRESHOLD;

  // --- Build WhatsApp message ---
  let waMessage;
  const bookingLine = `🍕 Nuova prenotazione! ${name} — ${guestsNum} person${guestsNum === 1 ? "a" : "e"} — ${italianDate} ${time_slot}. Tel: ${phone}`;
  const confirmLine = `✅ Conferma: ${confirmUrl}`;
  const rejectLine  = `❌ Rifiuta: ${rejectUrl}`;

  if (isLargeGroup) {
    waMessage = `⚠️ GRUPPO GRANDE — CHIAMA PRIMA DI CONFERMARE\n${bookingLine}\n${confirmLine}\n${rejectLine}`;
  } else {
    waMessage = `${bookingLine}\n${confirmLine}\n${rejectLine}`;
  }

  // --- Send WhatsApp via Callmebot ---
  const encodedMsg = encodeURIComponent(waMessage);
  const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=${OWNER_WHATSAPP}&text=${encodedMsg}&apikey=${CALLMEBOT_API_KEY}`;

  try {
    const waRes = await fetch(callmebotUrl);
    if (!waRes.ok) {
      console.error("Callmebot error:", await waRes.text());
      // Still return success to the customer — the booking was received even if WA failed
    }
  } catch (err) {
    console.error("Callmebot fetch error:", err);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: "Prenotazione ricevuta! Ti confermiamo a breve." }),
  };
};
