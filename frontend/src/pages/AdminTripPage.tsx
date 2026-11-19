import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ErrorAlert, Loading, SeatMeter, StatusBadge } from "../components/ui";
import { dateTime, money } from "../format";
import { Link } from "../router";
import { useToast } from "../toast";
import type { Passenger, PaymentStatus, Summary, Trip } from "../types";
import { AdminGuard } from "./AdminPage";

const EMPTY = { name: "", dni: "", phone: "", memberNumber: "", paymentStatus: "Pendiente" as PaymentStatus, depositAmount: "" };

function PaymentCell({ p, tripId, onChanged }: { p: Passenger; tripId: string; onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<PaymentStatus>(p.paymentStatus);
  const [deposit, setDeposit] = useState(p.depositAmount ? String(p.depositAmount) : "");
  const [busy, setBusy] = useState(false);
  const dirty = status !== p.paymentStatus || (status === "Señado" && deposit !== (p.depositAmount ? String(p.depositAmount) : ""));

  async function save() {
    setBusy(true);
    try {
      await api("PATCH", `/trips/${tripId}/passengers/${p.id}/payment`, { paymentStatus: status, ...(status === "Señado" && deposit !== "" ? { depositAmount: Number(deposit) } : {}) });
      toast("Pago actualizado"); onChanged();
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  }

  return (
    <div className="inline-pay">
      <select aria-label={`Estado de pago de ${p.name}`} value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
        <option>Pendiente</option><option>Señado</option><option>Pagado</option>
      </select>
      {status === "Señado" && <input aria-label={`Monto de la seña de ${p.name}`} type="number" min="1" placeholder="50% por defecto" value={deposit} onChange={(e) => setDeposit(e.target.value)} />}
      {dirty && <button className="btn btn-sm" disabled={busy} onClick={save}>Guardar</button>}
    </div>
  );
}

export function AdminTripPage({ id }: { id: string }) {
  const toast = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [passengers, setPassengers] = useState<Passenger[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, s, p] = await Promise.all([
        api<{ trip: Trip }>("GET", `/trips/${id}`),
        api<{ summary: Summary }>("GET", `/trips/${id}/summary`),
        api<{ passengers: Passenger[] }>("GET", `/trips/${id}/passengers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)
      ]);
      setTrip(t.trip); setSummary(s.summary); setPassengers(p.passengers); setError("");
    } catch (e: any) { setError(e.message); }
  }, [id, q]);
  // La búsqueda se consulta al servidor (RN13) con una pequeña espera mientras se escribe.
  useEffect(() => { const h = setTimeout(load, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function add(e: FormEvent) {
    e.preventDefault();
    setFormError(""); setBusy(true);
    try {
      await api("POST", `/trips/${id}/passengers`, {
        name: form.name, dni: form.dni, phone: form.phone, memberNumber: form.memberNumber, paymentStatus: form.paymentStatus,
        ...(form.paymentStatus === "Señado" && form.depositAmount !== "" ? { depositAmount: Number(form.depositAmount) } : {})
      });
      setForm(EMPTY); toast("Pasajero anotado"); load();
    } catch (err: any) { setFormError(err.message); } finally { setBusy(false); }
  }

  async function cancelPassenger(p: Passenger) {
    try {
      const r = await api<{ refund: number }>("PATCH", `/trips/${id}/passengers/${p.id}/cancel`);
      toast(r.refund > 0 ? `Lugar cancelado. Corresponde reintegrar ${money(r.refund)}.` : "Lugar cancelado"); load();
    } catch (e: any) { toast(e.message, "error"); }
  }

  async function changeStatus(status: string) {
    try { await api("PATCH", `/trips/${id}/status`, { status }); toast(`Viaje: ${status}`); setConfirmStatus(null); load(); }
    catch (e: any) { toast(e.message, "error"); setConfirmStatus(null); }
  }

  return (
    <AdminGuard>
      <p><Link to="/panel">← Panel del organizador</Link></p>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {!trip && !error && <Loading rows={1} />}
      {trip && summary && (
        <>
          <div className="row row-between">
            <div>
              <h1>vs {trip.rival}</h1>
              <p className="muted">{dateTime(trip.departureDateTime)} · {trip.stadium} · sale de {trip.meetingPoint || "punto a confirmar"} · pasaje {money(trip.ticketPrice)}</p>
            </div>
            <StatusBadge value={trip.status} />
          </div>

          <div className="stats">
            <div className="stat"><strong>{summary.seatsOccupied} / {trip.capacity}</strong><span>Lugares ocupados</span></div>
            <div className="stat"><strong>{money(summary.totalPaid)}</strong><span>Recaudado</span></div>
            <div className="stat"><strong>{money(summary.totalPending)}</strong><span>Pendiente de cobro</span></div>
            <div className="stat"><strong>{money(summary.totalRetained)}</strong><span>Retenido por cancelaciones</span></div>
            <div className="stat"><strong>{money(summary.totalRefunded)}</strong><span>A reintegrar</span></div>
          </div>
          <div style={{ marginBottom: 20 }}><SeatMeter capacity={trip.capacity} occupied={trip.seatsOccupied} /></div>

          {(trip.status === "Abierto" || trip.status === "Completo" || trip.status === "En Viaje") && (
            <section className="panel" aria-labelledby="est">
              <h2 id="est">Estado del viaje</h2>
              <div className="row">
                {trip.status !== "En Viaje" && <button className="btn btn-ghost" onClick={() => setConfirmStatus("En Viaje")}>Iniciar viaje</button>}
                {trip.status === "En Viaje" && <button className="btn btn-ghost" onClick={() => setConfirmStatus("Finalizado")}>Finalizar viaje</button>}
                {trip.status !== "En Viaje" && <button className="btn btn-danger" onClick={() => setConfirmStatus("Cancelado")}>Cancelar viaje</button>}
              </div>
              {confirmStatus && (
                <div className="confirm-box" role="alertdialog">
                  <p>{confirmStatus === "Cancelado" ? "Se cancelan todos los lugares y se reintegra lo abonado. No se puede deshacer." : confirmStatus === "En Viaje" ? "Con el viaje en curso ya no se pueden agregar ni cancelar pasajeros." : "El viaje se cierra de forma definitiva."}</p>
                  <div className="row">
                    <button className={`btn btn-sm ${confirmStatus === "Cancelado" ? "btn-danger" : ""}`} onClick={() => changeStatus(confirmStatus)}>Confirmar: {confirmStatus}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmStatus(null)}>Volver</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {(trip.status === "Abierto") && (
            <section className="panel" aria-labelledby="ap">
              <h2 id="ap">Anotar un pasajero</h2>
              <form onSubmit={add} noValidate>
                {formError && <ErrorAlert>{formError}</ErrorAlert>}
                <div className="grid-2">
                  <div className="field"><label htmlFor="an">Nombre y apellido</label><input id="an" value={form.name} onChange={set("name")} required /></div>
                  <div className="field"><label htmlFor="ad">DNI</label><input id="ad" inputMode="numeric" value={form.dni} onChange={set("dni")} required /></div>
                  <div className="field"><label htmlFor="at">Teléfono</label><input id="at" type="tel" value={form.phone} onChange={set("phone")} /></div>
                  <div className="field"><label htmlFor="am">N° de socio</label><input id="am" inputMode="numeric" value={form.memberNumber} onChange={set("memberNumber")} /></div>
                  <div className="field"><label htmlFor="ae">Estado de pago</label>
                    <select id="ae" value={form.paymentStatus} onChange={set("paymentStatus")}><option>Pendiente</option><option>Señado</option><option>Pagado</option></select></div>
                  {form.paymentStatus === "Señado" && <div className="field"><label htmlFor="as">Monto de la seña <span className="hint">(vacío = 50%)</span></label><input id="as" type="number" min="1" value={form.depositAmount} onChange={set("depositAmount")} /></div>}
                </div>
                <button className="btn" disabled={busy}>{busy ? "Anotando…" : "Anotar pasajero"}</button>
              </form>
            </section>
          )}

          <h2>Pasajeros</h2>
          <div className="filters"><div className="field"><label htmlFor="bq">Buscar por nombre, DNI o socio</label><input id="bq" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          {passengers && passengers.length === 0 && <div className="empty"><h3>{q ? "Nadie coincide con esa búsqueda" : "Todavía no hay pasajeros"}</h3></div>}
          {passengers && passengers.length > 0 && (
            <div className="panel table-wrap">
              <table>
                <thead><tr><th>Pasajero</th><th>DNI</th><th>Socio</th><th>Teléfono</th><th>Pago</th><th>Abonado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {passengers.map((p) => (
                    <tr key={p.id} className={p.status === "CANCELADO" ? "is-cancelled" : ""}>
                      <td><strong>{p.name}</strong>{p.addedByOrganizer && <><br /><span className="muted">Cargado por organizador</span></>}</td>
                      <td>{p.dni}</td><td>{p.memberNumber || "—"}</td><td>{p.phone || "—"}</td>
                      <td>{p.status === "CANCELADO" ? <StatusBadge value="CANCELADO" /> : (trip.status === "Cancelado" ? <StatusBadge value={p.paymentStatus} /> : <PaymentCell key={`${p.id}-${p.paymentStatus}-${p.depositAmount}`} p={p} tripId={id} onChanged={load} />)}</td>
                      <td>{p.status === "CANCELADO" ? (p.refundAmount > 0 ? `Reintegro ${money(p.refundAmount)}` : p.retainedAmount > 0 ? `Retenido ${money(p.retainedAmount)}` : "—") : money(p.amountPaid)}</td>
                      <td>{p.status === "ACTIVO" && (trip.status === "Abierto" || trip.status === "Completo") && <button className="btn btn-ghost btn-sm" onClick={() => cancelPassenger(p)}>Cancelar lugar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminGuard>
  );
}
