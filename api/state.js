import { kv } from "@vercel/kv";

const KEYS = {
  profiles: "event:profiles",
  participants: "event:participants",
  messages: "event:messages"
};

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(data));
}

function normalizeHex(hex) {
  return String(hex || "").trim().toLowerCase();
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, n));
  return "#" + [clamp(r), clamp(g), clamp(b)]
    .map(v => v.toString(16).padStart(2, "0"))
    .join("");
}

function isColorTaken(color, profiles, ignoreDeviceId = null) {
  const normalized = normalizeHex(color);
  return profiles.some(p =>
    normalizeHex(p.color) === normalized &&
    p.deviceId !== ignoreDeviceId
  );
}

function suggestSimilarAvailableColor(baseColor, profiles, ignoreDeviceId = null) {
  if (!isColorTaken(baseColor, profiles, ignoreDeviceId)) {
    return normalizeHex(baseColor);
  }

  const { r, g, b } = hexToRgb(baseColor);

  const shifts = [
    [4, 0, 0], [-4, 0, 0],
    [0, 4, 0], [0, -4, 0],
    [0, 0, 4], [0, 0, -4],
    [6, 3, 0], [-6, -3, 0],
    [3, 6, 0], [-3, -6, 0],
    [0, 6, 3], [0, -6, -3],
    [8, 0, 4], [-8, 0, -4],
    [10, 2, 2], [-10, -2, -2],
    [12, 4, 0], [-12, -4, 0],
    [0, 12, 4], [0, -12, -4],
    [4, 0, 12], [-4, 0, -12],
    [15, 5, 5], [-15, -5, -5],
    [20, 0, 0], [0, 20, 0], [0, 0, 20],
    [-20, 0, 0], [0, -20, 0], [0, 0, -20]
  ];

  for (const [dr, dg, db] of shifts) {
    const candidate = rgbToHex(r + dr, g + dg, b + db);
    if (!isColorTaken(candidate, profiles, ignoreDeviceId)) {
      return candidate;
    }
  }

  for (let step = 0; step <= 255; step += 17) {
    const candidate = rgbToHex((r + step) % 256, (g + 2 * step) % 256, (b + 3 * step) % 256);
    if (!isColorTaken(candidate, profiles, ignoreDeviceId)) {
      return candidate;
    }
  }

  return rgbToHex((r + 37) % 256, (g + 73) % 256, (b + 109) % 256);
}

async function getAllState() {
  const [profiles, participants, messages] = await Promise.all([
    kv.get(KEYS.profiles),
    kv.get(KEYS.participants),
    kv.get(KEYS.messages)
  ]);

  return {
    profiles: Array.isArray(profiles) ? profiles : [],
    participants: Array.isArray(participants) ? participants : [],
    messages: Array.isArray(messages) ? messages : []
  };
}

async function saveAllState({ profiles, participants, messages }) {
  await Promise.all([
    kv.set(KEYS.profiles, profiles),
    kv.set(KEYS.participants, participants),
    kv.set(KEYS.messages, messages)
  ]);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const state = await getAllState();
      return json(res, 200, { ok: true, ...state });
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = body.action;

    const state = await getAllState();
    let { profiles, participants, messages } = state;

    // ---------------------------
    // Tworzenie / aktualizacja profilu
    // ---------------------------
    if (action === "saveProfile") {
      const nickname = String(body.nickname || "").trim();
      const deviceId = String(body.deviceId || "").trim();
      let color = normalizeHex(body.color || "");

      if (!nickname || nickname.length < 2) {
        return json(res, 400, { ok: false, error: "Niepoprawny pseudonim." });
      }

      if (!deviceId) {
        return json(res, 400, { ok: false, error: "Brak deviceId." });
      }

      if (!/^#[0-9a-f]{6}$/i.test(color)) {
        return json(res, 400, { ok: false, error: "Niepoprawny kolor." });
      }

      let colorAdjusted = false;
      if (isColorTaken(color, profiles, deviceId)) {
        color = suggestSimilarAvailableColor(color, profiles, deviceId);
        colorAdjusted = true;
      }

      const existingIndex = profiles.findIndex(p => p.deviceId === deviceId);
      const profile = {
        deviceId,
        nickname,
        color,
        createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : Date.now(),
        updatedAt: Date.now()
      };

      if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
      } else {
        profiles.push(profile);
      }

      await saveAllState({ profiles, participants, messages });

      return json(res, 200, {
        ok: true,
        profile,
        colorAdjusted,
        message: colorAdjusted
          ? "Kolor był zajęty, ustawiono podobny wolny kolor."
          : "Profil zapisany."
      });
    }

    // ---------------------------
    // Dodawanie uczestnika
    // ---------------------------
    if (action === "joinParticipant") {
      const deviceId = String(body.deviceId || "").trim();
      if (!deviceId) {
        return json(res, 400, { ok: false, error: "Brak deviceId." });
      }

      const profile = profiles.find(p => p.deviceId === deviceId);
      if (!profile) {
        return json(res, 400, { ok: false, error: "Profil nie istnieje." });
      }

      const exists = participants.some(p => p.deviceId === deviceId);
      if (!exists) {
        participants.push({
          deviceId: profile.deviceId,
          nickname: profile.nickname,
          color: profile.color,
          joinedAt: Date.now()
        });

        participants.sort((a, b) => a.joinedAt - b.joinedAt);
        await saveAllState({ profiles, participants, messages });
      }

      return json(res, 200, {
        ok: true,
        participants,
        message: exists ? "Użytkownik już jest zapisany." : "Dodano do listy uczestników."
      });
    }

    // ---------------------------
    // Wysyłanie wiadomości
    // ---------------------------
    if (action === "sendMessage") {
      const deviceId = String(body.deviceId || "").trim();
      const text = String(body.text || "").trim();

      if (!deviceId) {
        return json(res, 400, { ok: false, error: "Brak deviceId." });
      }

      if (!text) {
        return json(res, 400, { ok: false, error: "Pusta wiadomość." });
      }

      const profile = profiles.find(p => p.deviceId === deviceId);
      if (!profile) {
        return json(res, 400, { ok: false, error: "Profil nie istnieje." });
      }

      messages.push({
        id: "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2),
        deviceId: profile.deviceId,
        nickname: profile.nickname,
        color: profile.color,
        text: text.slice(0, 1000),
        createdAt: Date.now()
      });

      messages = messages.slice(-300);

      await saveAllState({ profiles, participants, messages });

      return json(res, 200, {
        ok: true,
        messages,
        message: "Wiadomość zapisana."
      });
    }

    return json(res, 400, { ok: false, error: "Nieznana akcja." });
  } catch (error) {
    console.error("API error:", error);
    return json(res, 500, {
      ok: false,
      error: "Błąd serwera.",
      details: error?.message || String(error)
    });
  }
}
