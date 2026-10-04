/* AI Receptionist — monitoring dashboard (vanilla JS, no build step). */

const state = {
  view: "inbox",
  channel: "",
  status: "",
  search: "",
  conversations: [],
  selectedId: null,
  selected: null,
};

// ── Helpers ────────────────────────────────────────────────

async function api(path) {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtWhen(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function identityName(c) {
  if (c.display_name) return c.display_name;
  if (c.username) return `@${c.username}`;
  return c.phone;
}

function contactLine(c) {
  const parts = [];
  if (c.username) parts.push(`@${c.username}`);
  parts.push(c.phone);
  return parts.join(" · ");
}

// ── Stats ──────────────────────────────────────────────────

async function loadStats() {
  try {
    const s = await api("/admin/api/stats");
    const channels = (s.channels || [])
      .map((c) => `${c.count} ${c.channel}`)
      .join(" / ") || "—";
    const cards = [
      ["Conversations", s.conversations],
      ["Contacts", s.contacts],
      ["Active", s.active],
      ["Handed off", s.handed_off],
      ["Open handoffs", s.open_handoffs],
      ["Messages (24h)", s.messages_24h],
      ["Bookings", s.bookings],
      ["Channels", channels],
    ];
    document.getElementById("stats").innerHTML = cards
      .map(([l, n]) => `<div class="stat"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`)
      .join("");
  } catch (err) {
    console.error("stats failed", err);
  }
}

// ── Inbox ──────────────────────────────────────────────────

async function loadInbox() {
  const params = new URLSearchParams();
  if (state.channel) params.set("channel", state.channel);
  if (state.status) params.set("status", state.status);
  if (state.search) params.set("search", state.search);

  try {
    state.conversations = await api(`/admin/api/conversations?${params}`);
    renderList();
  } catch (err) {
    console.error("conversations failed", err);
  }
}

function renderList() {
  const list = document.getElementById("convList");
  if (!state.conversations.length) {
    list.innerHTML = `<li class="conv"><div class="preview">No conversations yet.</div></li>`;
    return;
  }
  list.innerHTML = state.conversations.map((c) => {
    const preview = c.last_message
      ? `${c.last_role === "assistant" ? "↩ " : ""}${c.last_message}`
      : "No messages";
    return `
      <li class="conv ${c.id === state.selectedId ? "selected" : ""}" data-id="${esc(c.id)}">
        <div class="row1">
          <span class="who">${esc(identityName(c))}</span>
          <span class="time">${esc(fmtWhen(c.last_message_at))}</span>
        </div>
        <div class="preview">${esc(preview)}</div>
        <div class="meta">
          <span class="badge ${esc(c.channel)}">${esc(c.channel)}</span>
          <span class="badge ${esc(c.status)}">${esc(c.status)}</span>
          <span class="time muted">${esc(c.message_count)} msg</span>
        </div>
      </li>`;
  }).join("");

  list.querySelectorAll(".conv").forEach((el) => {
    el.addEventListener("click", () => selectConversation(el.dataset.id));
  });
}

async function selectConversation(id) {
  state.selectedId = id;
  renderList();
  await loadDetail();
}

async function loadDetail() {
  const pane = document.getElementById("detail");
  if (!state.selectedId) return;

  try {
    const c = await api(`/admin/api/conversations/${state.selectedId}`);
    state.selected = c;

    const handoffHtml = c.handoffs.length
      ? `<div class="detail-foot">${c.handoffs
          .map((h) => `${esc(h.urgency)} · ${esc(h.reason)} · ${esc(fmtDateTime(h.created_at))}${h.resolved ? " · resolved" : ""}`)
          .join("<br>")}</div>`
      : "";

    const messages = c.messages.length
      ? c.messages.map((m) => `
          <div class="bubble ${esc(m.role)}">
            ${esc(m.content)}
            <span class="ts">${esc(fmtDateTime(m.created_at))}</span>
          </div>`).join("")
      : `<div class="empty">No messages in this session.</div>`;

    pane.innerHTML = `
      <div class="detail-head">
        <div>
          <div class="name">${esc(identityName(c))}</div>
          <div class="idline">${esc(contactLine(c))} · started ${esc(fmtDateTime(c.created_at))}</div>
        </div>
        <div class="badges">
          <span class="badge ${esc(c.channel)}">${esc(c.channel)}</span>
          <span class="badge ${esc(c.status)}">${esc(c.status)}</span>
        </div>
      </div>
      <div class="transcript">${messages}</div>
      ${handoffHtml}`;

    const t = pane.querySelector(".transcript");
    if (t) t.scrollTop = t.scrollHeight;
  } catch (err) {
    console.error("detail failed", err);
  }
}

// ── Handoffs ───────────────────────────────────────────────

async function loadHandoffs() {
  const body = document.querySelector("#handoffsTable tbody");
  try {
    const rows = await api("/admin/api/handoffs");
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No handoffs yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((h) => `
      <tr>
        <td>${esc(fmtDateTime(h.created_at))}</td>
        <td>${esc(h.display_name || (h.username ? "@" + h.username : h.phone))}
          <div class="muted">${esc(h.phone)}</div></td>
        <td><span class="badge ${esc(h.channel)}">${esc(h.channel)}</span></td>
        <td>${esc(h.reason)}</td>
        <td><span class="badge ${h.urgency === "high" ? "high" : ""}">${esc(h.urgency)}</span></td>
        <td>${h.notified ? "yes" : "no"}</td>
        <td>${h.resolved ? "yes" : "no"}</td>
      </tr>`).join("");
  } catch (err) {
    console.error("handoffs failed", err);
  }
}

// ── Bookings ───────────────────────────────────────────────

async function loadBookings() {
  const body = document.querySelector("#bookingsTable tbody");
  try {
    const rows = await api("/admin/api/bookings");
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No bookings yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((b) => `
      <tr>
        <td>${esc(fmtDateTime(b.created_at))}</td>
        <td>${esc(b.display_name || (b.username ? "@" + b.username : b.phone))}
          <div class="muted">${esc(b.phone)}</div></td>
        <td><span class="badge ${esc(b.channel)}">${esc(b.channel)}</span></td>
        <td>${esc(b.service)}</td>
        <td>${esc(b.client_name || "")}<div class="muted">${esc(b.client_phone || b.client_email || "")}</div></td>
        <td>${esc(fmtDateTime(b.slot_datetime))}</td>
        <td>${esc(b.status)}</td>
      </tr>`).join("");
  } catch (err) {
    console.error("bookings failed", err);
  }
}

// ── View / refresh orchestration ───────────────────────────

function showView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === view));
  document.getElementById("view-inbox").classList.toggle("hidden", view !== "inbox");
  document.getElementById("view-handoffs").classList.toggle("hidden", view !== "handoffs");
  document.getElementById("view-bookings").classList.toggle("hidden", view !== "bookings");
  refresh();
}

async function refresh() {
  await loadStats();
  if (state.view === "inbox") {
    await loadInbox();
    if (state.selectedId) await loadDetail();
  } else if (state.view === "handoffs") {
    await loadHandoffs();
  } else if (state.view === "bookings") {
    await loadBookings();
  }
  document.getElementById("updated").textContent =
    "updated " + new Date().toLocaleTimeString();
}

function init() {
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => showView(t.dataset.view)));

  document.getElementById("filterChannel").addEventListener("change", (e) => {
    state.channel = e.target.value; loadInbox();
  });
  document.getElementById("filterStatus").addEventListener("change", (e) => {
    state.status = e.target.value; loadInbox();
  });

  let searchTimer;
  document.getElementById("search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value.trim(); loadInbox(); }, 250);
  });

  document.getElementById("autoRefresh").addEventListener("change", () => {});

  refresh();
  setInterval(() => {
    if (document.getElementById("autoRefresh").checked) refresh();
  }, 5000);
}

init();
