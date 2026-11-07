/**
 * Calendly v2 API integration.
 * Docs: https://developer.calendly.com/api-docs
 *
 * For Phase 1 (MVP), we use Calendly as a booking bridge:
 *   1. Get the spa's event type URI from config
 *   2. Fetch available times for a date range
 *   3. Return 2-3 slots for the bot to offer
 *   4. Create a one-off scheduling link for the chosen slot
 *
 * NOTE: Full real-time slot locking requires Calendly Teams plan.
 * For the free tier MVP, we generate a scheduling link and let
 * Calendly handle conflict resolution. This is fine for launch.
 */

const CALENDLY_BASE = "https://api.calendly.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.CALENDLY_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * Get the authenticated user's URI (needed for other API calls).
 */
export async function getCurrentUser() {
  const res = await fetch(`${CALENDLY_BASE}/users/me`, { headers: headers() });
  if (!res.ok) throw new Error(`Calendly /users/me failed: ${res.status}`);
  const { resource } = await res.json();
  return resource;
}

/**
 * List event types for a user (each service = one event type in Calendly).
 *
 * @param {string} userUri - from getCurrentUser().uri
 */
export async function getEventTypes(userUri) {
  const url = `${CALENDLY_BASE}/event_types?user=${encodeURIComponent(userUri)}&active=true`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Calendly event_types failed: ${res.status}`);
  const { collection } = await res.json();
  return collection;
}

/**
 * Get available times for a specific event type.
 *
 * @param {string} eventTypeUri  - Calendly event type URI
 * @param {string} startTime     - ISO 8601, e.g. "2026-05-19T00:00:00Z"
 * @param {string} endTime       - ISO 8601, e.g. "2026-05-26T00:00:00Z"
 * @returns {Array} list of available start times
 */
export async function getAvailableTimes(eventTypeUri, startTime, endTime) {
  const params = new URLSearchParams({
    event_type: eventTypeUri,
    start_time: startTime,
    end_time: endTime,
  });
  const res = await fetch(`${CALENDLY_BASE}/event_type_available_times?${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Calendly available_times failed: ${res.status}`);
  const { collection } = await res.json();
  // Each item: { status: "available", invitees_remaining: N, start_time: ISO }
  return collection.filter((s) => s.status === "available" && s.invitees_remaining > 0);
}

/**
 * Create a one-off scheduling link for a specific event type.
 * This is the simplest booking path: bot sends the link, customer completes booking on Calendly.
 *
 * @param {string} eventTypeUri
 * @param {number} maxEventCount - 1 means the link expires after one booking
 */
export async function createSchedulingLink(eventTypeUri, maxEventCount = 1) {
  const res = await fetch(`${CALENDLY_BASE}/scheduling_links`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      max_event_count: maxEventCount,
      owner: eventTypeUri,
      owner_type: "EventType",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendly scheduling_link failed: ${res.status} ${body}`);
  }
  const { resource } = await res.json();
  return resource.booking_url; // e.g. "https://calendly.com/d/abc-123/lip-filler"
}

/**
 * High-level helper: given a service name and a rough date preference,
 * return 2-3 slot strings the bot can quote in a message,
 * plus a booking link the customer can use to confirm.
 *
 * @param {object} spaConfig
 * @param {string} serviceName - Matches against Calendly event type names
 * @param {string} preferredDate - ISO date string or natural language (we search 7 days from this date)
 * @returns {{ slots: string[], bookingUrl: string }}
 */
export async function getSlotsAndLink(spaConfig, serviceName, preferredDate) {
  // If Calendly isn't configured (demo mode), return mock slots
  if (!process.env.CALENDLY_API_TOKEN || process.env.CALENDLY_API_TOKEN === "eyJ...") {
    return getMockSlots(serviceName, preferredDate);
  }

  const user = await getCurrentUser();
  const eventTypes = await getEventTypes(user.uri);

  // Match event type by name (case-insensitive partial match)
  const eventType = eventTypes.find((et) =>
    et.name.toLowerCase().includes(serviceName.toLowerCase()) ||
    serviceName.toLowerCase().includes(et.name.toLowerCase())
  );

  if (!eventType) {
    // Fall back to first active event type if no match
    const fallback = eventTypes[0];
    if (!fallback) return getMockSlots(serviceName, preferredDate);
    return getSlotsForEventType(fallback);
  }

  return getSlotsForEventType(eventType);
}

async function getSlotsForEventType(eventType) {
  const now = new Date();
  const startTime = now.toISOString();
  const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const available = await getAvailableTimes(eventType.uri, startTime, endTime);
  const top3 = available.slice(0, 3).map((s) => formatSlot(s.start_time));

  const bookingUrl = await createSchedulingLink(eventType.uri);
  return { slots: top3, bookingUrl };
}

/**
 * Format ISO datetime to human-friendly slot string.
 * e.g. "2026-05-20T15:30:00Z" -> "Tuesday May 20, 3:30 PM"
 */
function formatSlot(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago", // TODO: set per spa config
  });
}

/**
 * Mock slots for demo mode (no real Calendly token needed).
 * Generates plausible slots relative to today.
 */
function getMockSlots(serviceName, preferredDate) {
  const base = preferredDate ? new Date(preferredDate) : new Date();
  base.setDate(base.getDate() + 1); // start from tomorrow

  const slots = [
    formatSlot(new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0).toISOString()),
    formatSlot(new Date(base.getFullYear(), base.getMonth(), base.getDate(), 14, 30).toISOString()),
    formatSlot(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 11, 0).toISOString()),
  ];

  return {
    slots,
    bookingUrl: "https://calendly.com/example-spa-aesthetic-spa/consultation", // demo link
  };
}
