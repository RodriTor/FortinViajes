export type Role = "USER" | "ADMIN";
export type TripStatus = "Abierto" | "Completo" | "En Viaje" | "Finalizado" | "Cancelado";
export type PaymentStatus = "Pendiente" | "Señado" | "Pagado";

export interface User { id: string; name: string; email: string; role: Role }

export interface Trip {
  id: string; rival: string; stadium: string; departureDateTime: string; meetingPoint: string;
  ticketPrice: number; capacity: number; status: TripStatus; seatsOccupied: number; seatsAvailable: number;
}

export interface Passenger {
  id: string; tripId: string; name: string; dni: string; phone: string; memberNumber: string;
  paymentStatus: PaymentStatus; depositAmount: number | null; amountPaid: number;
  status: "ACTIVO" | "CANCELADO"; refundAmount: number; retainedAmount: number;
  cancelledAt: string | null; createdAt: string; addedByOrganizer: boolean;
}

export type CancellationPreview =
  | { allowed: true; refund: number; retained: number }
  | { allowed: false; reason: string };

export interface MyPassenger extends Passenger {
  trip: { id: string; rival: string; stadium: string; departureDateTime: string; meetingPoint: string; ticketPrice: number; status: TripStatus };
  cancellation: CancellationPreview | null;
}

export interface Summary {
  seatsOccupied: number; seatsAvailable: number; totalPaid: number; totalPending: number;
  totalRetained: number; totalRefunded: number; isFull: boolean; byPaymentStatus: Record<PaymentStatus, number>;
}
