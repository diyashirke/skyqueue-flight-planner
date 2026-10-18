/* =========================================================
   SkyQueue — browser simulation of airline.c
   The browser does NOT run the C program. This JavaScript
   re-implements the same logic so the website can work:
     - 5 confirmed seats per flight (same as MAX_SEATS in C)
     - Waiting list = FIFO queue made with a linked list
     - Cancel a confirmed seat -> first waiting passenger promoted
   ========================================================= */

const MAX_SEATS = 5;

/* ---------- Linked-list queue (same idea as airline.c) ---------- */
class PassengerNode {
  constructor(ticketId, name) {
    this.ticketId = ticketId;
    this.name = name;
    this.next = null;
  }
}

class WaitingQueue {
  constructor() { this.front = null; this.rear = null; this.size = 0; }

  // ENQUEUE: add at rear — O(1)
  enqueue(node) {
    if (this.rear === null) { this.front = this.rear = node; }
    else { this.rear.next = node; this.rear = node; }
    this.size++;
  }

  // DEQUEUE: remove from front — O(1)
  dequeue() {
    if (this.front === null) return null;
    const node = this.front;
    this.front = node.next;
    if (this.front === null) this.rear = null;
    node.next = null;
    this.size--;
    return node;
  }

  // Remove any waiting passenger by ticket id — O(w)
  remove(ticketId) {
    let cur = this.front, prev = null;
    while (cur && cur.ticketId !== ticketId) { prev = cur; cur = cur.next; }
    if (!cur) return false;
    if (prev === null) this.front = cur.next; else prev.next = cur.next;
    if (cur === this.rear) this.rear = prev;
    this.size--;
    return true;
  }

  position(ticketId) {
    let pos = 1;
    for (let n = this.front; n; n = n.next, pos++) if (n.ticketId === ticketId) return pos;
    return -1;
  }

  toArray() {
    const list = [];
    for (let n = this.front; n; n = n.next) list.push({ ticketId: n.ticketId, name: n.name });
    return list;
  }
}

/* ---------- One flight = 5 seats + waiting queue ---------- */
class FlightReservation {
  constructor() {
    this.seats = new Array(MAX_SEATS).fill(null); // null = empty seat
    this.waiting = new WaitingQueue();
  }

  findFreeSeat() { return this.seats.indexOf(null); } // O(n)

  // Returns { status: "CONFIRMED", seat } or { status: "WAITING", position }
  book(ticketId, name) {
    const seat = this.findFreeSeat();
    if (seat !== -1) {
      this.seats[seat] = { ticketId, name };
      return { status: "CONFIRMED", seat: seat + 1 };
    }
    this.waiting.enqueue(new PassengerNode(ticketId, name));
    return { status: "WAITING", position: this.waiting.size };
  }

  // Returns { ok, promoted? , message }
  cancel(ticketId) {
    const seatIndex = this.seats.findIndex(s => s && s.ticketId === ticketId);
    if (seatIndex !== -1) {
      this.seats[seatIndex] = null;
      const next = this.waiting.dequeue(); // FIFO: first waiting passenger
      if (next) {
        this.seats[seatIndex] = { ticketId: next.ticketId, name: next.name };
        return { ok: true, promoted: { ticketId: next.ticketId, name: next.name, seat: seatIndex + 1 } };
      }
      return { ok: true };
    }
    if (this.waiting.remove(ticketId)) return { ok: true };
    return { ok: false, message: "Ticket not found or already cancelled." };
  }

  // Current status of one ticket
  statusOf(ticketId) {
    const i = this.seats.findIndex(s => s && s.ticketId === ticketId);
    if (i !== -1) return { status: "CONFIRMED", seat: i + 1 };
    const pos = this.waiting.position(ticketId);
    if (pos !== -1) return { status: "WAITING", position: pos };
    return { status: "CANCELLED" };
  }

  available() { return this.seats.filter(s => s === null).length; }

  toJSON() { return { seats: this.seats, waiting: this.waiting.toArray() }; }

  static fromJSON(data) {
    const f = new FlightReservation();
    f.seats = data.seats;
    data.waiting.forEach(p => f.waiting.enqueue(new PassengerNode(p.ticketId, p.name)));
    return f;
  }
}

/* Export for the queue explanation page */
window.SkyQueueEngine = { MAX_SEATS, WaitingQueue, PassengerNode, FlightReservation };

/* =========================================================
   MAIN WEBSITE (index.html)
   ========================================================= */
const AIRPORTS = [
  { code: "BOM", city: "Mumbai" },
  { code: "DEL", city: "Delhi" },
  { code: "PNQ", city: "Pune" },
  { code: "BLR", city: "Bengaluru" },
  { code: "HYD", city: "Hyderabad" },
  { code: "GOI", city: "Goa" },
  { code: "COK", city: "Kochi" },
  { code: "JAI", city: "Jaipur" },
];
const CABIN_MULTIPLIER = { "Economy": 1, "Premium Economy": 1.6, "Business": 2.8 };
const STORAGE_KEY = "skyqueue-demo-v1";

let state = { nextTicketId: 101, flights: {}, bookings: {} }; // flights: id -> FlightReservation
let search = null, selectedFlight = null, passengerList = [], contact = {};

function $(id) { return document.getElementById(id); }
function airportLabel(code) { const a = AIRPORTS.find(x => x.code === code); return `${a.city} (${a.code})`; }
function rupees(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3500); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

function saveState() {
  const flights = {};
  for (const id in state.flights) flights[id] = state.flights[id].toJSON();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, flights }));
}
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw) return;
    const flights = {};
    for (const id in raw.flights) flights[id] = FlightReservation.fromJSON(raw.flights[id]);
    state = { ...raw, flights };
  } catch (e) { /* ignore broken data */ }
}
function getFlight(id) {
  if (!state.flights[id]) state.flights[id] = new FlightReservation();
  return state.flights[id];
}

/* Simple deterministic sample flights for a route + date */
function sampleFlights(from, to, date, cabin) {
  const seed = (from + to).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const departures = ["06:10", "09:45", "14:20", "19:35"];
  const duration = 75 + (seed % 90); // minutes
  return departures.map((dep, i) => {
    const [h, m] = dep.split(":").map(Number);
    const arrMin = h * 60 + m + duration;
    const arr = `${String(Math.floor(arrMin / 60) % 24).padStart(2, "0")}:${String(arrMin % 60).padStart(2, "0")}`;
    const number = `SQ ${100 + ((seed + i * 37) % 800)}`;
    const base = 3200 + (seed % 25) * 90 + i * 450;
    return {
      id: `${number.replace(" ", "")}-${from}-${to}-${date}`,
      number, from, to, date, dep, arr,
      duration: `${Math.floor(duration / 60)}h ${duration % 60}m`,
      cabin, fare: base * CABIN_MULTIPLIER[cabin],
    };
  });
}

function showStep(n) {
  [1, 2, 3, 4].forEach(i => { $("step" + i).hidden = i !== n; });
  document.querySelectorAll("#steps li").forEach(li => {
    const s = Number(li.dataset.step);
    li.className = s === n ? "active" : s < n ? "done" : "";
  });
  $("flow").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResults(list) {
  $("resultsTitle").textContent = `${airportLabel(search.from)} to ${airportLabel(search.to)} · ${search.date}`;
  $("seatInfo").textContent = `Sample schedules and fares for demonstration. Each flight has ${MAX_SEATS} seats; when full, new bookings join the waiting list.`;
  $("results").innerHTML = list.map((f, i) => {
    const avail = getFlight(f.id).available();
    const badge = avail > 0
      ? `<span class="badge ok">${avail} of ${MAX_SEATS} seats left</span>`
      : `<span class="badge wait">Full · waiting list</span>`;
    return `<div class="card flight">
      <div><div class="code">${f.number}</div><div class="muted">${f.cabin}</div>${badge}</div>
      <div class="times"><div><strong>${f.dep}</strong><div class="muted">${f.from}</div></div>
        <div class="line">${f.duration} · Non-stop</div>
        <div><strong>${f.arr}</strong><div class="muted">${f.to}</div></div></div>
      <div><div class="fare">${rupees(f.fare)}</div><div class="muted">per passenger (demo)</div></div>
      <button class="btn btn-primary" data-select="${i}">Select Flight</button>
    </div>`;
  }).join("");
  $("results").querySelectorAll("[data-select]").forEach(btn => btn.addEventListener("click", () => {
    selectedFlight = list[Number(btn.dataset.select)];
    renderPaxFields();
    showStep(2);
  }));
}

function renderPaxFields() {
  let html = "";
  for (let i = 0; i < search.passengers; i++) {
    html += `<div class="pax-block"><h4>Passenger ${i + 1}</h4>
      <div class="field"><label for="first${i}">First name</label><input id="first${i}"></div>
      <div class="field"><label for="last${i}">Last name</label><input id="last${i}"></div>
      <div class="field"><label for="age${i}">Age</label><input id="age${i}" type="number" min="0" max="120"></div></div>`;
  }
  $("paxFields").innerHTML = html;
}

function renderReview() {
  const f = selectedFlight;
  const total = f.fare * passengerList.length;
  const avail = getFlight(f.id).available();
  const waitNote = avail < passengerList.length
    ? `<p class="badge wait">Only ${avail} seat(s) free — ${passengerList.length - avail} passenger(s) will join the waiting list.</p>` : "";
  $("reviewBox").innerHTML = `<dl class="summary">
    <dt>Flight</dt><dd>${f.number} · ${f.cabin}</dd>
    <dt>Route</dt><dd>${airportLabel(f.from)} → ${airportLabel(f.to)}</dd>
    <dt>Date & time</dt><dd>${f.date}, ${f.dep} – ${f.arr}</dd>
    ${search.trip === "round" ? `<dt>Return date</dt><dd>${search.returnDate} (return flight not booked in demo)</dd>` : ""}
    <dt>Passengers</dt><dd>${passengerList.map(p => escapeHtml(p.name)).join(", ")}</dd>
    <dt>Contact</dt><dd>${escapeHtml(contact.email)} · ${escapeHtml(contact.phone)}</dd>
    <dt>Total (demo)</dt><dd>${rupees(total)}</dd></dl>${waitNote}`;
}

function bookingCard(ref) {
  const b = state.bookings[ref];
  const flight = getFlight(b.flight.id);
  const rows = b.tickets.map(t => {
    const s = flight.statusOf(t.ticketId);
    const label = s.status === "CONFIRMED" ? `<span class="badge ok">Confirmed · Seat ${s.seat}</span>`
      : s.status === "WAITING" ? `<span class="badge wait">Waiting list #${s.position}</span>`
      : `<span class="badge cancel">Cancelled</span>`;
    return `<li><span>Ticket ${t.ticketId} · ${escapeHtml(t.name)}</span>${label}</li>`;
  }).join("");
  return `<p class="muted">Booking reference</p><div class="ref">${ref}</div>
    <dl class="summary" style="margin-top:12px">
      <dt>Flight</dt><dd>${b.flight.number} · ${b.flight.cabin}</dd>
      <dt>Route</dt><dd>${airportLabel(b.flight.from)} → ${airportLabel(b.flight.to)}</dd>
      <dt>Date & time</dt><dd>${b.flight.date}, ${b.flight.dep} – ${b.flight.arr}</dd></dl>
    <ul class="ticket-list">${rows}</ul>`;
}

function confirmBooking() {
  const flight = getFlight(selectedFlight.id);
  const tickets = passengerList.map(p => {
    const ticketId = state.nextTicketId++;
    flight.book(ticketId, p.name);
    return { ticketId, name: p.name };
  });
  const ref = "SQ-" + tickets[0].ticketId;
  state.bookings[ref] = { flight: selectedFlight, tickets, contact };
  saveState();
  $("confirmBox").innerHTML = `<h2>Reservation confirmed</h2><p class="muted">This is a demo reservation. No payment was taken.</p>${bookingCard(ref)}`;
  $("manageRef").value = ref;
  showStep(4);
  renderManifest();
  toast("Booking " + ref + " created");
}

function cancelBooking(ref) {
  const b = state.bookings[ref];
  const flight = getFlight(b.flight.id);
  const messages = [];
  let anyCancelled = false;
  b.tickets.forEach(t => {
    if (flight.statusOf(t.ticketId).status === "CANCELLED") return; // prevent duplicate cancellation
    const result = flight.cancel(t.ticketId);
    if (result.ok) anyCancelled = true;
    if (result.promoted) messages.push(`${result.promoted.name} (ticket ${result.promoted.ticketId}) moved from waiting list to seat ${result.promoted.seat}.`);
  });
  if (!anyCancelled) { $("manageError").textContent = "This booking is already cancelled."; return; }
  saveState();
  showManage(ref);
  renderManifest();
  toast("Booking cancelled. " + messages.join(" "));
}

function showManage(ref) {
  const b = state.bookings[ref];
  const flight = getFlight(b.flight.id);
  const active = b.tickets.some(t => flight.statusOf(t.ticketId).status !== "CANCELLED");
  $("manageResult").innerHTML = `<div class="card">${bookingCard(ref)}
    ${active ? `<div class="row-actions"><button class="btn btn-danger" id="cancelBtn">Cancel booking</button></div>` : ""}</div>`;
  if (active) $("cancelBtn").addEventListener("click", () => {
    if (confirm("Cancel all tickets in " + ref + "?")) cancelBooking(ref);
  });
}

function renderManifest() {
  const select = $("manifestFlight");
  const ids = [...new Set(Object.values(state.bookings).map(b => b.flight.id))];
  const current = select.value;
  if (ids.length === 0) {
    select.hidden = true;
    $("manifest").innerHTML = `<p class="muted">No bookings yet. Book a flight to see its seats here.</p>`;
    return;
  }
  select.hidden = false;
  select.innerHTML = ids.map(id => {
    const f = Object.values(state.bookings).find(b => b.flight.id === id).flight;
    return `<option value="${id}">${f.number} · ${f.from}→${f.to} · ${f.date}</option>`;
  }).join("");
  if (ids.includes(current)) select.value = current;
  const flight = getFlight(select.value);
  const seatsHtml = flight.seats.map((s, i) =>
    `<div class="seat ${s ? "taken" : ""}"><b>${i + 1}</b>${s ? escapeHtml(s.name.split(" ")[0]) : "Free"}</div>`).join("");
  const waiting = flight.waiting.toArray();
  $("manifest").innerHTML = `<div class="seat-map">${seatsHtml}</div>
    <strong>Waiting list (${waiting.length})</strong>
    ${waiting.length ? `<ol class="wait-list">${waiting.map(w => `<li>${escapeHtml(w.name)} · ticket ${w.ticketId}</li>`).join("")}</ol>` : `<p class="muted">Nobody waiting.</p>`}`;
}

function initMainSite() {
  loadState();

  // Mobile menu
  $("menuToggle").addEventListener("click", () => {
    const open = $("mainNav").classList.toggle("open");
    $("menuToggle").setAttribute("aria-expanded", open);
  });
  $("mainNav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("mainNav").classList.remove("open")));

  // Fill airport dropdowns
  const opts = AIRPORTS.map(a => `<option value="${a.code}">${a.city} (${a.code})</option>`).join("");
  $("from").innerHTML = opts; $("to").innerHTML = opts;
  $("from").value = "BOM"; $("to").value = "DEL";

  // Dates: min = today
  const today = new Date().toISOString().slice(0, 10);
  $("departDate").min = today; $("returnDate").min = today;
  $("departDate").value = today;
  $("departDate").addEventListener("change", () => { $("returnDate").min = $("departDate").value; });

  document.querySelectorAll("input[name=tripType]").forEach(r => r.addEventListener("change", () => {
    $("returnDate").disabled = document.querySelector("input[name=tripType]:checked").value !== "round";
  }));
  $("swapBtn").addEventListener("click", () => { const t = $("from").value; $("from").value = $("to").value; $("to").value = t; });

  // Search validation
  $("searchForm").addEventListener("submit", e => {
    e.preventDefault();
    const trip = document.querySelector("input[name=tripType]:checked").value;
    const from = $("from").value, to = $("to").value;
    const date = $("departDate").value, returnDate = $("returnDate").value;
    let err = "";
    if (from === to) err = "Departure and destination airports must be different.";
    else if (!date) err = "Please choose a departure date.";
    else if (date < today) err = "Departure date cannot be in the past.";
    else if (trip === "round" && !returnDate) err = "Please choose a return date.";
    else if (trip === "round" && returnDate < date) err = "Return date must be on or after the departure date.";
    $("searchError").textContent = err;
    if (err) return;
    search = { trip, from, to, date, returnDate, passengers: Number($("passengers").value), cabin: $("cabin").value };
    $("flow").hidden = false;
    renderResults(sampleFlights(from, to, date, search.cabin));
    showStep(1);
  });

  // Passenger form validation
  $("paxForm").addEventListener("submit", e => {
    e.preventDefault();
    const list = [];
    let err = "";
    for (let i = 0; i < search.passengers; i++) {
      const first = $("first" + i).value.trim(), last = $("last" + i).value.trim(), age = $("age" + i).value;
      if (!/^[A-Za-z][A-Za-z .'-]{0,29}$/.test(first) || !/^[A-Za-z][A-Za-z .'-]{0,29}$/.test(last)) { err = `Enter a valid first and last name for passenger ${i + 1} (letters only).`; break; }
      if (age === "" || age < 0 || age > 120) { err = `Enter a valid age for passenger ${i + 1}.`; break; }
      list.push({ name: `${first} ${last}`, age: Number(age) });
    }
    const email = $("email").value.trim(), phone = $("phone").value.trim();
    if (!err && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err = "Enter a valid email address.";
    if (!err && !/^[6-9]\d{9}$/.test(phone)) err = "Enter a valid 10-digit Indian mobile number.";
    $("paxError").textContent = err;
    if (err) return;
    passengerList = list; contact = { email, phone };
    renderReview();
    showStep(3);
  });

  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.back === "1") renderResults(sampleFlights(search.from, search.to, search.date, search.cabin));
    showStep(Number(b.dataset.back));
  }));
  $("confirmBtn").addEventListener("click", confirmBooking);
  $("newSearch").addEventListener("click", () => { $("flow").hidden = true; });

  // Manage booking
  $("manageForm").addEventListener("submit", e => {
    e.preventDefault();
    const ref = $("manageRef").value.trim().toUpperCase();
    $("manageError").textContent = "";
    if (!state.bookings[ref]) { $("manageResult").innerHTML = ""; $("manageError").textContent = "No booking found with that reference."; return; }
    showManage(ref);
  });
  $("manifestFlight").addEventListener("change", renderManifest);
  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Delete all demo bookings?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { nextTicketId: 101, flights: {}, bookings: {} };
    $("manageResult").innerHTML = ""; $("flow").hidden = true;
    renderManifest(); toast("Demo data reset");
  });
  renderManifest();

  // Flight status (sample)
  $("statusForm").addEventListener("submit", e => {
    e.preventDefault();
    const raw = $("statusNo").value.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^SQ\d{3}$/.test(raw)) { $("statusResult").innerHTML = `<p class="form-error">Enter a flight number like SQ 210.</p>`; return; }
    const n = Number(raw.slice(2));
    const statuses = [["On time", "ok"], ["On time", "ok"], ["Delayed 20 min", "wait"], ["Boarding", "ok"]];
    const [label, cls] = statuses[n % 4];
    $("statusResult").innerHTML = `<div class="card"><strong>SQ ${n}</strong> <span class="badge ${cls}">${label}</span><p class="muted">Sample status for demonstration.</p></div>`;
  });
}

if (document.getElementById("searchForm")) initMainSite();
