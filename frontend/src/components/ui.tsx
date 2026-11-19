import type { ReactNode } from "react";
import type { Trip } from "../types";
import { dayNumber, monthShort, money, timeOnly } from "../format";
import { Link } from "../router";

export const StatusBadge = ({ value }: { value: string }) => <span className={`badge badge-${value}`}>{value}</span>;

export function SeatMeter({ capacity, occupied }: { capacity: number; occupied: number }) {
  const free = Math.max(0, capacity - occupied);
  return (
    <div>
      <div className="seats" aria-hidden="true">
        {Array.from({ length: capacity }, (_, i) => <span key={i} className={`seat${i < occupied ? " taken" : ""}`} />)}
      </div>
      <div className={`seats-label${free > 0 && free <= 3 ? " low" : ""}`}>
        {free === 0 ? "Micro completo" : free === 1 ? "Queda 1 lugar" : `${free} lugares libres de ${capacity}`}
      </div>
    </div>
  );
}

export function TripTicket({ trip, to }: { trip: Trip; to: string }) {
  return (
    <Link to={to} className="ticket" aria-label={`Viaje contra ${trip.rival}`}>
      <div className="ticket-main">
        <StatusBadge value={trip.status} />
        <h2>vs {trip.rival}</h2>
        <p className="where">{trip.stadium}</p>
        <p className="where">Sale de {trip.meetingPoint || "punto a confirmar"}</p>
        <SeatMeter capacity={trip.capacity} occupied={trip.seatsOccupied} />
      </div>
      <div className="ticket-stub">
        <div className="stub-day">{dayNumber(trip.departureDateTime)}</div>
        <div className="stub-month">{monthShort(trip.departureDateTime)}</div>
        <div className="stub-time">{timeOnly(trip.departureDateTime)} h</div>
        <div className="stub-price">{money(trip.ticketPrice)}</div>
      </div>
    </Link>
  );
}

export const ErrorAlert = ({ children }: { children: ReactNode }) => <div className="alert alert-error" role="alert">{children}</div>;

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="tickets" aria-busy="true" aria-label="Cargando">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}</div>;
}
