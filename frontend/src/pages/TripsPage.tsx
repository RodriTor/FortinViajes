import { ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ErrorAlert, Loading, SeatMeter, TripTicket } from "../components/ui";
import { dateLong, money, timeOnly } from "../format";
import { Link } from "../router";
import type { Trip } from "../types";

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

function Hero({ next, loading }: { next: Trip | null; loading: boolean }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <svg className="hero-art" viewBox="0 0 800 500" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
        <g fill="none" stroke="#cfe3f7" strokeOpacity=".13" strokeWidth="2">
          <circle cx="620" cy="430" r="150" /><circle cx="620" cy="430" r="6" fill="#cfe3f7" fillOpacity=".2" />
          <path d="M470 280v300M620 280v300M-40 330h380" /><rect x="300" y="360" width="340" height="160" />
        </g>
        <g fill="none" stroke="#fff" strokeOpacity=".07" strokeWidth="26" strokeLinejoin="miter">
          <path d="M-60 40l110 150 110-150" /><path d="M120 -20l110 150 110-150" /><path d="M300 40l110 150 110-150" />
        </g>
      </svg>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title">Al Fortín, viajamos juntos.</h1>
          <p>Reservá tu lugar en el micro de la peña, dejá la seña acordada y seguí tu pago sin planillas ni mensajes perdidos.</p>
          <div className="row">
            <button className="btn btn-light" onClick={() => scrollTo("viajes")}>Ver próximos viajes</button>
            <button className="btn btn-outline-light" onClick={() => scrollTo("como-funciona")}>Cómo funciona</button>
          </div>
        </div>
        {loading && <div className="skeleton hero-card" aria-hidden="true" />}
        {!loading && next && (
          <article className="hero-card" aria-label="Próximo viaje">
            <p className="hero-card-tag">{next.competition || "Próximo viaje"}</p>
            <h2>Vélez vs {next.rival}</h2>
            <p className="hero-when">{dateLong(next.departureDateTime)}</p>
            <dl className="hero-facts">
              <div><dt>Sale a las</dt><dd>{timeOnly(next.departureDateTime)} h</dd></div>
              {next.matchDateTime && <div><dt>Juegan</dt><dd>{timeOnly(next.matchDateTime)} h</dd></div>}
              <div><dt>Pasaje</dt><dd>{money(next.ticketPrice)}</dd></div>
            </dl>
            <p className="hero-where">{next.stadium} · sale de {next.meetingPoint || "punto a confirmar"}</p>
            <SeatMeter capacity={next.capacity} occupied={next.seatsOccupied} />
            <Link to={`/viaje/${next.id}`} className="btn btn-block">{next.status === "Abierto" ? "Reservar mi lugar" : "Ver el viaje"}</Link>
          </article>
        )}
      </div>
    </section>
  );
}

const HISTORY = [
  { year: "1910", title: "Nace el Fortín", text: "El Club Atlético Vélez Sarsfield se funda el 1 de enero en el barrio de Liniers, y desde entonces el barrio y el club van juntos." },
  { year: "1951", title: "La casa de Liniers", text: "Se inaugura el Estadio José Amalfitani, donde el Fortín hace de local y adonde viajan nuestros micros." },
  { year: "1994", title: "Campeón del mundo", text: "Vélez gana la Copa Libertadores y la Intercontinental, y la gente sale a recorrer el mundo detrás del equipo." }
];

export function TripsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);

  useEffect(() => {
    api<{ trips: Trip[] }>("GET", "/trips").then((r) => setTrips(r.trips)).catch((e) => setError(e.message));
  }, []);

  const upcoming = useMemo(() => (trips ?? []).filter((t) => t.status === "Abierto" || t.status === "Completo" || t.status === "En Viaje"), [trips]);
  const next = upcoming.find((t) => t.status === "Abierto") ?? upcoming[0] ?? null;
  const visible = useMemo(() => {
    const text = q.trim().toLowerCase();
    return upcoming
      .filter((t) => !text || t.rival.toLowerCase().includes(text) || t.stadium.toLowerCase().includes(text))
      .filter((t) => !onlyFree || t.status === "Abierto");
  }, [upcoming, q, onlyFree]);

  return (
    <>
      <Hero next={next} loading={!trips && !error} />

      <section id="viajes" className="section" aria-labelledby="viajes-title">
        <h2 id="viajes-title" className="section-title">Próximos viajes</h2>
        <div className="filters">
          <div className="field">
            <label htmlFor="q">Buscar por rival o estadio</label>
            <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. Belgrano" />
          </div>
          <label className="check"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Solo con lugares libres</label>
        </div>
        {error && <ErrorAlert>{error}</ErrorAlert>}
        {!trips && !error && <Loading rows={2} />}
        {trips && visible.length === 0 && (
          <div className="empty">
            <h3>{upcoming.length === 0 ? "Todavía no hay viajes publicados" : "No encontramos viajes con ese filtro"}</h3>
            <p>{upcoming.length === 0 ? "Cuando el organizador cargue el próximo partido, lo vas a ver acá." : "Probá con otro rival o quitá el filtro de lugares libres."}</p>
          </div>
        )}
        <div className="tickets">{visible.map((t) => <TripTicket key={t.id} trip={t} to={`/viaje/${t.id}`} />)}</div>
      </section>

      <section id="como-funciona" className="steps" aria-labelledby="steps-title">
        <div className="steps-intro">
          <h2 id="steps-title">Tu lugar en el micro, en tres pasos.</h2>
          <p>Sin grupos de WhatsApp desordenados ni planillas: el sistema cuida el cupo y te muestra cada peso.</p>
          <button className="btn" onClick={() => scrollTo("viajes")}>Elegir un viaje</button>
        </div>
        <ol className="steps-list">
          <li>
            <span className="step-n" aria-hidden="true">1</span>
            <div><h3>Elegí el partido</h3><p>Mirá fecha, punto de encuentro, precio y cuántos lugares quedan.</p></div>
            <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
          </li>
          <li>
            <span className="step-n" aria-hidden="true">2</span>
            <div><h3>Reservá tu lugar</h3><p>Cargá tus datos y los de tus acompañantes; el cupo queda tuyo al instante.</p></div>
            <Icon><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Icon>
          </li>
          <li>
            <span className="step-n" aria-hidden="true">3</span>
            <div><h3>Pagá y viajá con la peña</h3><p>Acordás la seña con el organizador y seguís tu estado de pago desde Mis viajes.</p></div>
            <Icon><path d="m5 12 4.5 4.5L19 7" /></Icon>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="hist-title">
        <h2 id="hist-title" className="section-title">El Fortín de Liniers</h2>
        <div className="history">
          {HISTORY.map((h, i) => (
            <article key={h.year} className="history-card" style={{ backgroundImage: `linear-gradient(180deg, rgba(10,42,92,.15) 0%, rgba(10,42,92,.92) 78%), url(/img/historia-${i + 1}.jpg)` }}>
              <span className="history-year">{h.year}</span>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="promises" aria-label="Por qué usar FortínViajes">
        <div>
          <Icon><path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></Icon>
          <div><strong>Cupo asegurado</strong><span>Nadie se pasa del micro, ni anotándose a la vez.</span></div>
        </div>
        <div>
          <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
          <div><strong>Pagos claros</strong><span>Seña, saldo y pendiente siempre a la vista.</span></div>
        </div>
        <div>
          <Icon><path d="M4 12h12M12 6l6 6-6 6" /></Icon>
          <div><strong>Cancelación justa</strong><span>Reintegro total si avisás con 24 horas o más.</span></div>
        </div>
      </section>
    </>
  );
}
