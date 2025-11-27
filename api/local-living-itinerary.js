
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  // stored on Vercel, not in code
});

// helper: detect days from text (default 7)
function detectDays(text = "") {
  const match = text.match(/(\d+)\s*day/i);
  if (match) {
    const n = parseInt(match[1]);
    if (!isNaN(n)) return Math.min(Math.max(n, 3), 21);
  }
  return 7;
}

export default async function handler(req, res) {
  // --- CORS so Shopify can call this ---
  const allowedOrigin = "*"; 
  // You can replace * with your domain like "https://localliving.co"
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  // -------------------------------------

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { user_request, style_preference } = body;

    if (!user_request) {
      res.status(400).json({ error: "Missing user_request" });
      return;
    }

    const days = detectDays(user_request);
    const style = style_preference || "Auto";

    const prompt = `
ROLE: "Local Living Maldives" AI travel concierge.
STYLE: Fast, concise, documentary, no resort language.

USER FREE TEXT:
"${user_request}"

USER STYLE PREFERENCE: "${style}"
- "Budget": cheaper stays, public ferries, simple local food.
- "Adventurous": sharks, dives, surf, long active days.
- "Photography": sunrise/sunset slots, best viewpoints, colourful harbours.
- "Culture": families, mosques, local food, fishing, crafts, stories.
- "Auto": infer from text or create a balanced Local Living trip.

DURATION RULE:
- If user clearly says number of days/nights, use it.
- Otherwise treat it as a 7-day ideal trip.

ACCOMMODATION RULE:
Use ONLY these verified local guesthouses (no new names, no resorts, no overwater villas):
Dhigurah: Dhonveli, Bliss, White Sand
Thulusdhoo: Blue Haven, Season Paradise, Samura
Fuvahmulah: Isle Royal, Tiger Shark Residence
Maafushi: Arora Inn, Kaani Grand, Arena Beach
Fulidhoo: Kinan Retreat, Seena Inn
Ukulhas: Ostrov Beach, West Sands

CONTENT RULES:
- Max JSON size: under 1500 tokens.
- Short sentences, no fluff.
- 1 main island + optional side-island.
- At least one clearly slow "Local Living" day.
- Realistic transfers (Male → island → Male).
- Max 3 recommended_activities.
- Max 3 signature_experiences.
- Cost breakdown max 4 items.
- Map query must be simple (e.g. "Dhigurah Maldives").
- Do NOT describe water villas, overwater bungalows, or resort imagery.

OUTPUT STRICT JSON ONLY:
{
 "title": "",
 "trip_length_days": ${days},
 "style_used": "",
 "hotel_name": "",
 "island": "",
 "price_level": "",
 "days": [
   {"title": "Day 1", "desc": ""}
 ],
 "recommended_activities": [
   {"name": "", "why": ""}
 ],
 "signature_experiences": [
   {"title": "", "desc": ""}
 ],
 "estimated_cost": {
   "currency": "USD",
   "approx_total_per_person": 0,
   "breakdown": [
     {"label": "", "amount": ""}
   ],
   "notes": ""
 },
 "transfers": [
   {"day": "", "mode": "", "route": "", "details": ""}
 ],
 "map_query": ""
}
    `;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200
    });

    const itinerary = JSON.parse(completion.choices[0].message.content);
    res.status(200).json(itinerary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
