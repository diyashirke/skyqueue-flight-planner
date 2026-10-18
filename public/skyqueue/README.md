# SkyQueue — Airline Reservation System Using Queue in C

A first-year B.Tech AI & DS micro project. A professional-looking airline booking website, backed by a queue (linked list) reservation simulation.

## Files
| File | Purpose |
|---|---|
| `airline.c` | Original DSA program (queue + linked list), runs in a terminal |
| `index.html` | Airline website: search, booking, manage booking, status, help |
| `queue.html` | "How Our Reservation Queue Works" — explanation + interactive demo |
| `style.css` | All styling (responsive) |
| `script.js` | JavaScript version of the C logic + website behaviour |
| `images/` | Hero and destination photos |

## Run the C program
```
gcc airline.c -o airline
./airline          # Windows: airline.exe
```

## Open the website
Double-click `index.html` (or open it in any browser). No server needed. Bookings are saved in the browser's localStorage; use **Reset demo data** in Manage Booking to clear them.

## How the queue works
- Each flight has **5 confirmed seats** (`MAX_SEATS = 5`, same in C and JS).
- Ticket IDs start at **101** and increase by 1.
- Seat free → passenger confirmed in the first free seat.
- Seats full → passenger **enqueued** at the rear of the waiting list.
- Confirmed passenger cancels → front of the waiting list is **dequeued** and gets that seat (FIFO).
- Cancelling an already-cancelled ticket shows an error.

## Complexity
| Operation | Time |
|---|---|
| Enqueue / Dequeue | O(1) |
| Book | O(n), n = 5 seats |
| Cancel | O(n + w), w = waiting passengers |
| Display | O(n + w) |
Space: O(n + w).

## Sample output (5 seats)
```
Book Asha, Ravi, Meera, John, Priya -> Tickets 101-105, Seats 1-5
Book Karan -> Ticket 106, waiting position 1
Book Neha  -> Ticket 107, waiting position 2
Cancel 102 -> Seat 2 free; Promoted: Ticket 106, Karan -> Seat 2
Cancel 102 -> Error: ticket 102 not found (or already cancelled).
```

## Important note
The browser does **not** run `airline.c`. `script.js` re-implements the same logic in JavaScript. Connecting the website to the real C program would need a backend server (e.g. compiling the C program and calling it from a web server), which is not part of this project.

All flights, fares, statuses and baggage rules are **demonstration data**. No payments are taken.
