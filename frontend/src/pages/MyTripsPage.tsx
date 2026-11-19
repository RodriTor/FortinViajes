import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorAlert, Loading, StatusBadge } from "../components/ui";
import { dateTime, money } from "../format";
import { Link } from "../router";
import { useToast } from "../toast";
import type { MyPassenger } from "../types";

export function MyTripsPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<MyPassenger[] | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ passengers: MyPassenger[] }>("GET", "/passengers/mine").then((r) => setItems(r.passengers)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function cancel(p: MyPassenger) {
    setBusy(true);
    try {
      const r = await api<{ refund: number; retained: number }>("PATCH", `/trips/${p.trip.id}/passengers/${p.id}/cancel`);
      toast(r.refund > 0 ? `Lugar cancelado. Se te devuelven ${money(r.refund)}.` : r.retained > 0 ? `Lugar cancelado. Se retienen ${money(r.retained)}.` : "Lugar cancelado.");
      setConfirming(null); load();
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  }

  if (loading) return <Loading rows={1} />;
  if (!user) return <div className="empty"><h3>Ingresá para ver tus viajes</h3><p><Link to="/ingresar" className="btn">Ingresar</Link></p></div>;

  return (
    <>
      <h1>Mis viajes</h1>
      <p className="muted">Los lugares que anotaste vos, para vos o para tus acompañantes.</p>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {!items && !error && <Loading rows={2} />}
      {items && items.length === 0 && <div className="empty"><h3>Todavía no reservaste ningún lugar</h3><p><Link to="/" className="btn">Ver viajes</Link></p></div>}
      {items?.map((p) => {
        const cancelled = p.status === "CANCELADO";
        return (
          <article key={p.id} className={`my-item${cancelled ? " is-cancelled" : ""}`}>
            <div className="row row-between">
              <div>
                <h2 style={{ marginBottom: 2 }}>{p.name} · vs {p.trip.rival}</h2>
                <p className="muted" style={{ margin: 0 }}>{dateTime(p.trip.departureDateTime)} · sale de {p.trip.meetingPoint || "punto a confirmar"}</p>
              </div>
              <div className="row"><StatusBadge value={cancelled ? "CANCELADO" : p.trip.status} />{!cancelled && <StatusBadge value={p.paymentStatus} />}</div>
            </div>
            {cancelled ? (
              <p style={{ margin: "10px 0 0" }}>
                {p.refundAmount > 0 && <>Se te devuelven <strong>{money(p.refundAmount)}</strong>. </>}
                {p.retainedAmount > 0 && <>Se retuvieron <strong>{money(p.retainedAmount)}</strong> por cancelar fuera de plazo. </>}
                {p.refundAmount === 0 && p.retainedAmount === 0 && "Cancelado sin movimientos de dinero."}
              </p>
            ) : (
              <p style={{ margin: "10px 0 0" }}>Pasaje {money(p.trip.ticketPrice)} · abonado <strong>{money(p.amountPaid)}</strong></p>
            )}
            {!cancelled && p.cancellation && (
              confirming === p.id ? (
                <div className="confirm-box" role="alertdialog" aria-label="Confirmar cancelación">
                  {p.cancellation.allowed ? (
                    <p>
                      {p.cancellation.refund > 0 ? <>Si cancelás ahora se te devuelven <strong>{money(p.cancellation.refund)}</strong>.</> : p.cancellation.retained > 0 ? <>Faltan menos de 24 horas: si cancelás ahora <strong>se retienen {money(p.cancellation.retained)}</strong> y no se devuelven.</> : <>No abonaste nada, así que no hay dinero en juego.</>}
                      {" "}El lugar queda libre para otra persona.
                    </p>
                  ) : <p>{p.cancellation.reason}</p>}
                  <div className="row">
                    {p.cancellation.allowed && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => cancel(p)}>{busy ? "Cancelando…" : "Sí, cancelar lugar"}</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>Volver</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}><button className="btn btn-ghost btn-sm" onClick={() => setConfirming(p.id)}>Cancelar lugar</button></div>
              )
            )}
          </article>
        );
      })}
    </>
  );
}
