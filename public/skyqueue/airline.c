/*
 * SkyQueue - Airline Reservation System Using Queue in C
 * -------------------------------------------------------
 * - Confirmed seats: fixed capacity of 5 (MAX_SEATS)
 * - Waiting list: a FIFO queue built with a singly linked list
 * - When a confirmed passenger cancels, the FIRST waiting passenger
 *   (front of the queue) is promoted into the freed seat.
 *
 * Compile:  gcc airline.c -o airline
 * Run:      ./airline        (Windows: airline.exe)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_SEATS 5
#define NAME_LEN 50

/* One passenger node of the linked list */
typedef struct Passenger {
    int ticketId;
    char name[NAME_LEN];
    struct Passenger *next;
} Passenger;

/* Confirmed seats: seat[i] is NULL when seat i+1 is empty */
Passenger *seats[MAX_SEATS] = {NULL};

/* Waiting-list queue pointers */
Passenger *front = NULL, *rear = NULL;
int waitingCount = 0;
int nextTicketId = 101;

Passenger *createPassenger(const char *name) {
    Passenger *p = (Passenger *)malloc(sizeof(Passenger));
    if (p == NULL) { printf("Memory error!\n"); exit(1); }
    p->ticketId = nextTicketId++;
    strncpy(p->name, name, NAME_LEN - 1);
    p->name[NAME_LEN - 1] = '\0';
    p->next = NULL;
    return p;
}

/* ENQUEUE - add passenger at rear. O(1) */
void enqueue(Passenger *p) {
    if (rear == NULL) front = rear = p;
    else { rear->next = p; rear = p; }
    waitingCount++;
}

/* DEQUEUE - remove passenger from front. O(1) */
Passenger *dequeue(void) {
    if (front == NULL) return NULL;
    Passenger *p = front;
    front = front->next;
    if (front == NULL) rear = NULL;
    p->next = NULL;
    waitingCount--;
    return p;
}

int findFreeSeat(void) {            /* O(n), n = MAX_SEATS */
    for (int i = 0; i < MAX_SEATS; i++)
        if (seats[i] == NULL) return i;
    return -1;
}

void bookTicket(const char *name) {
    Passenger *p = createPassenger(name);
    int seat = findFreeSeat();
    if (seat != -1) {
        seats[seat] = p;
        printf("Confirmed! Ticket %d, %s -> Seat %d\n", p->ticketId, p->name, seat + 1);
    } else {
        enqueue(p);
        printf("Flight full. Ticket %d, %s added to waiting list (position %d)\n",
               p->ticketId, p->name, waitingCount);
    }
}

/* Remove a waiting passenger by ticket id. O(w) */
int removeFromWaiting(int ticketId) {
    Passenger *cur = front, *prev = NULL;
    while (cur != NULL && cur->ticketId != ticketId) { prev = cur; cur = cur->next; }
    if (cur == NULL) return 0;
    if (prev == NULL) front = cur->next; else prev->next = cur->next;
    if (cur == rear) rear = prev;
    free(cur);
    waitingCount--;
    return 1;
}

/* Cancel: O(n) seat search + O(1) promotion, or O(w) waiting-list removal */
void cancelTicket(int ticketId) {
    for (int i = 0; i < MAX_SEATS; i++) {
        if (seats[i] != NULL && seats[i]->ticketId == ticketId) {
            printf("Ticket %d (%s) cancelled. Seat %d is free.\n", ticketId, seats[i]->name, i + 1);
            free(seats[i]);
            seats[i] = NULL;
            Passenger *promoted = dequeue();
            if (promoted != NULL) {
                seats[i] = promoted;
                printf("Promoted: Ticket %d, %s -> Seat %d\n", promoted->ticketId, promoted->name, i + 1);
            }
            return;
        }
    }
    if (removeFromWaiting(ticketId)) printf("Waiting ticket %d cancelled.\n", ticketId);
    else printf("Error: ticket %d not found (or already cancelled).\n", ticketId);
}

void displayAll(void) {             /* O(n + w) */
    printf("\n--- Confirmed (%d seats) ---\n", MAX_SEATS);
    for (int i = 0; i < MAX_SEATS; i++) {
        if (seats[i]) printf("Seat %d: Ticket %d - %s\n", i + 1, seats[i]->ticketId, seats[i]->name);
        else printf("Seat %d: [empty]\n", i + 1);
    }
    printf("--- Waiting list (%d) ---\n", waitingCount);
    int pos = 1;
    for (Passenger *p = front; p; p = p->next)
        printf("%d. Ticket %d - %s\n", pos++, p->ticketId, p->name);
    if (waitingCount == 0) printf("[empty]\n");
}

int main(void) {
    int choice, id;
    char name[NAME_LEN];
    while (1) {
        printf("\n=== SkyQueue Reservation ===\n1. Book\n2. Cancel\n3. Display\n4. Exit\nChoice: ");
        if (scanf("%d", &choice) != 1) break;
        switch (choice) {
            case 1:
                printf("Passenger name: ");
                scanf(" %49[^\n]", name);
                bookTicket(name);
                break;
            case 2:
                printf("Ticket ID: ");
                if (scanf("%d", &id) == 1) cancelTicket(id);
                break;
            case 3: displayAll(); break;
            case 4: printf("Goodbye!\n"); return 0;
            default: printf("Invalid choice.\n");
        }
    }
    return 0;
}

/*
 * Sample output (capacity 5):
 *  Book Asha, Ravi, Meera, John, Priya -> Tickets 101-105, Seats 1-5
 *  Book Karan -> Ticket 106, waiting position 1
 *  Book Neha  -> Ticket 107, waiting position 2
 *  Cancel 102 -> Seat 2 free; Promoted: Ticket 106, Karan -> Seat 2
 *  Cancel 102 -> Error: ticket 102 not found (or already cancelled).
 */
