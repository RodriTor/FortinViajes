import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorAlert, Loading, SeatMeter, StatusBadge } from "../components/ui";
import { dateTime, money, timeOnly } from "../format";
import { Link } from "../router";
import { useToast } from "../toast";
import type { Passenger, Trip } from "../types";

const EMPTY = { name: "", dni: "", phone: "", memberNumber: "" };

export function TripDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Passenger | null>(null);

  useEffect(() => {
    api<{ trip: Trip }>("GET", `/trips/${id}`).then((r) => setTrip(r.trip)).catch((e) => setLoadError(e.message));
  }, [id]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await api<{ passenger: Passenger; trip: Trip }>("POST", `/trips/${id}/passengers`, form);
      setTrip(r.trip); setDone(r.passenger); setForm(EMPTY);
      toast("Lugar reservado");
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  if (loadError) return <ErrorAlert>{loadError} <Link to="/">Volver a los viajes</Link></ErrorAlert>;
  if (!trip) return <Loading rows={1} />;

  const canBook = trip.status === "Abierto";
  return (
    <>
      <p><Link to="/">← Todos los viajes</Link></p>
      <div className="detail">
        <section className="panel" aria-labelledby="t">
          <StatusBadge value={trip.status} />
          <h1 id="t" style={{ marginTop: 8 }}>vs {trip.rival}</h1>
          <dl className="facts">
            {trip.competition && <><dt>Competición</dt><dd>{trip.competition}</dd></>}
            <dt>Salida del micro</dt><dd>{dateTime(trip.departureDateTime)}</dd>
            {trip.matchDateTime && <><dt>Parte del partido</dt><dd>{timeOnly(trip.matchDateTime)} h</dd></>}
            <dt>Punto de encuentro</dt><dd>{trip.meetingPoint || "A confirmar"}</dd>
            <dt>Estadio</dt><dd>{trip.stadium}</dd>
            <dt>Pasaje</dt><dd><strong>{money(trip.ticketPrice)}</strong></dd>
          </dl>
          <SeatMeter capacity={trip.capacity} occupied={trip.seatsOccupied} />
          <h3 style={{ marginTop: 20 }}>Cómo funciona</h3>
          <ul className="rules">
            <li>Podés anotarte hasta 3 horas antes de la salida.</li>
            <li>Podés reservar hasta 4 lugares por viaje (el tuyo y los de tus acompañantes).</li>
            <li>Tu lugar queda pendiente de pago: la seña se acuerda con el organizador.</li>
            <li>Si cancelás con 24 horas o más, se te devuelve lo abonado. Entre 24 y 6 horas antes, se retiene. Con menos de 6 horas, hablá con el organizador.</li>
          </ul>
        </section>

        <section className="panel" aria-labelledby="f">
          <h2 id="f">Reservá tu lugar</h2>
          {!user && (
            <>
              <p>Para anotarte necesitás una cuenta.</p>
              <Link to="/ingresar" className="btn">Ingresar o registrarme</Link>
            </>
          )}
          {user && !canBook && <div className="alert alert-warn">{trip.status === "Completo" ? "El micro está completo. Si alguien cancela, se libera un lugar." : `Este viaje está ${trip.status}: ya no admite reservas.`}</div>}
          {user && canBook && (
            <>
              {done && (
                <div className="alert alert-ok" role="status">
                  Reservaste el lugar de <strong>{done.name}</strong>. Quedó pendiente de pago: coordiná la seña con el organizador. Podés seguirlo en <Link to="/mis-viajes">Mis viajes</Link>.
                </div>
              )}
              <form onSubmit={submit} noValidate>
                {error && <ErrorAlert>{error}</ErrorAlert>}
                <p className="hint">Completá los datos de quien viaja. Para sumar un acompañante, volvé a enviar el formulario con sus datos.</p>
                <div className="field"><label htmlFor="n">Nombre y apellido</label><input id="n" value={form.name} onChange={set("name")} autoComplete="off" required /></div>
                <div className="field"><label htmlFor="d">DNI <span className="hint">(7 u 8 números, sin puntos)</span></label><input id="d" inputMode="numeric" value={form.dni} onChange={set("dni")} required /></div>
                <div className="grid-2">
                  <div className="field"><label htmlFor="p">Teléfono <span className="hint">(opcional)</span></label><input id="p" type="tel" value={form.phone} onChange={set("phone")} /></div>
                  <div className="field"><label htmlFor="m">N° de socio <span className="hint">(opcional)</span></label><input id="m" inputMode="numeric" value={form.memberNumber} onChange={set("memberNumber")} /></div>
                </div>
                <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Reservando…" : "Reservar lugar"}</button>
              </form>
            </>
          )}
          {user?.role === "ADMIN" && <p style={{ marginTop: 14 }}><Link to={`/panel/viaje/${trip.id}`}>Administrar este viaje</Link></p>}
        </section>
      </div>
    </>
  );
}
