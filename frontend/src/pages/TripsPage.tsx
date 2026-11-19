import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ErrorAlert, Loading, TripTicket } from "../components/ui";
import type { Trip } from "../types";

export function TripsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);

  useEffect(() => {
    api<{ trips: Trip[] }>("GET", "/trips").then((r) => setTrips(r.trips)).catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (trips ?? [])
      .filter((t) => t.status === "Abierto" || t.status === "Completo" || t.status === "En Viaje")
      .filter((t) => !text || t.rival.toLowerCase().includes(text) || t.stadium.toLowerCase().includes(text))
      .filter((t) => !onlyFree || t.status === "Abierto");
  }, [trips, q, onlyFree]);

  return (
    <>
      <div className="intro">
        <div>
          <h1>Viajes a la cancha</h1>
          <p>Elegí el partido, reservá tu lugar en el micro y coordiná la seña con el organizador.</p>
        </div>
      </div>
      <div className="filters">
        <div className="field">
          <label htmlFor="q">Buscar por rival o estadio</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. San Lorenzo" />
        </div>
        <label className="check"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Solo con lugares libres</label>
      </div>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {!trips && !error && <Loading />}
      {trips && visible.length === 0 && (
        <div className="empty">
          <h3>{trips.length === 0 ? "Todavía no hay viajes publicados" : "No encontramos viajes con ese filtro"}</h3>
          <p>{trips.length === 0 ? "Cuando el organizador cargue el próximo partido, lo vas a ver acá." : "Probá con otro rival o quitá el filtro de lugares libres."}</p>
        </div>
      )}
      <div className="tickets">{visible.map((t) => <TripTicket key={t.id} trip={t} to={`/viaje/${t.id}`} />)}</div>
    </>
  );
}
