import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorAlert, Loading, StatusBadge } from "../components/ui";
import { dateTime, money } from "../format";
import { Link } from "../router";
import { useToast } from "../toast";
import type { Trip } from "../types";

const EMPTY = { rival: "", stadium: "Estadio José Amalfitani", departureDateTime: "", meetingPoint: "", ticketPrice: "", capacity: "" };

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading rows={1} />;
  if (!user) return <div className="empty"><h3>Ingresá para continuar</h3><p><Link to="/ingresar" className="btn">Ingresar</Link></p></div>;
  if (user.role !== "ADMIN") return <div className="empty"><h3>Esta sección es solo para organizadores</h3><p><Link to="/">Volver a los viajes</Link></p></div>;
  return <>{children}</>;
}

export function AdminPage() {
  const toast = useToast();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ trips: Trip[] }>("GET", "/trips").then((r) => setTrips(r.trips)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function create(e: FormEvent) {
    e.preventDefault();
    setFormError(""); setBusy(true);
    try {
      await api("POST", "/trips", {
        rival: form.rival, stadium: form.stadium, departureDateTime: form.departureDateTime, meetingPoint: form.meetingPoint,
        ticketPrice: form.ticketPrice === "" ? undefined : Number(form.ticketPrice),
        capacity: form.capacity === "" ? undefined : Number(form.capacity)
      });
      setForm(EMPTY); toast("Viaje creado"); load();
    } catch (err: any) { setFormError(err.message); } finally { setBusy(false); }
  }

  return (
    <AdminGuard>
      <h1>Panel del organizador</h1>
      <section className="panel" aria-labelledby="nv">
        <h2 id="nv">Nuevo viaje</h2>
        <form onSubmit={create} noValidate>
          {formError && <ErrorAlert>{formError}</ErrorAlert>}
          <div className="grid-2">
            <div className="field"><label htmlFor="r">Rival</label><input id="r" value={form.rival} onChange={set("rival")} required /></div>
            <div className="field"><label htmlFor="e">Estadio</label><input id="e" value={form.stadium} onChange={set("stadium")} required /></div>
            <div className="field"><label htmlFor="f">Fecha y hora de salida <span className="hint">(horario argentino)</span></label><input id="f" type="datetime-local" value={form.departureDateTime} onChange={set("departureDateTime")} required /></div>
            <div className="field"><label htmlFor="pe">Punto de encuentro <span className="hint">(opcional)</span></label><input id="pe" value={form.meetingPoint} onChange={set("meetingPoint")} /></div>
            <div className="field"><label htmlFor="pr">Precio del pasaje (ARS)</label><input id="pr" type="number" min="0" inputMode="numeric" value={form.ticketPrice} onChange={set("ticketPrice")} required /></div>
            <div className="field"><label htmlFor="c">Capacidad del micro <span className="hint">(1 a 100)</span></label><input id="c" type="number" min="1" max="100" inputMode="numeric" value={form.capacity} onChange={set("capacity")} required /></div>
          </div>
          <button className="btn" disabled={busy}>{busy ? "Creando…" : "Crear viaje"}</button>
        </form>
      </section>

      <h2>Todos los viajes</h2>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {!trips && !error && <Loading rows={1} />}
      {trips && trips.length === 0 && <div className="empty"><h3>Todavía no creaste viajes</h3><p>Cargá el primero con el formulario de arriba.</p></div>}
      {trips && trips.length > 0 && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Partido</th><th>Salida</th><th>Cupos</th><th>Pasaje</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td><strong>vs {t.rival}</strong><br /><span className="muted">{t.stadium}</span></td>
                  <td>{dateTime(t.departureDateTime)}</td>
                  <td>{t.seatsOccupied} / {t.capacity}</td>
                  <td>{money(t.ticketPrice)}</td>
                  <td><StatusBadge value={t.status} /></td>
                  <td><Link to={`/panel/viaje/${t.id}`} className="btn btn-ghost btn-sm">Administrar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminGuard>
  );
}
