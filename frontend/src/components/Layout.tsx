import { ReactNode, useEffect, useState } from "react";
import { onSlowRequest } from "../api";
import { useAuth } from "../auth";
import { Link, navigate, useRoute } from "../router";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const route = useRoute();
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequest(setSlow), []);
  const cur = (match: boolean) => (match ? "page" : undefined);

  return (
    <>
      <a href="#contenido" className="sr-only">Ir al contenido</a>
      <header className="topbar">
        <div className="wrap">
          <Link to="/" className="brand">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff" /><path d="M6 9h20v10H6z" fill="#0a2a5c" /><rect x="9" y="11" width="5" height="4" fill="#cfe3f7" /><rect x="16" y="11" width="7" height="4" fill="#cfe3f7" /><circle cx="11" cy="23" r="2.6" fill="#0a2a5c" /><circle cx="21" cy="23" r="2.6" fill="#0a2a5c" /></svg>
            FortínViajes
          </Link>
          <nav className="nav" aria-label="Principal">
            <Link to="/" aria-current={cur(route === "/" || route.startsWith("/viaje/"))}>Viajes</Link>
            {user && <Link to="/mis-viajes" aria-current={cur(route === "/mis-viajes")}>Mis viajes</Link>}
            {user?.role === "ADMIN" && <Link to="/panel" aria-current={cur(route.startsWith("/panel"))}>Panel del organizador</Link>}
          </nav>
          <div className="session">
            {user ? (
              <>
                <span>{user.name}{user.role === "ADMIN" ? " (organizador)" : ""}</span>
                <button className="btn btn-ghost" onClick={() => { logout(); navigate("/"); }}>Salir</button>
              </>
            ) : (
              <Link to="/ingresar" className="btn btn-ghost">Ingresar</Link>
            )}
          </div>
        </div>
      </header>
      {slow && <div className="slow-banner" role="status">El servidor se está despertando. La primera carga puede tardar hasta un minuto.</div>}
      <main id="contenido" className="wrap">{children}</main>
      <footer className="site wrap">FortínViajes · Traslados organizados por peñas de Vélez. Los pagos se acuerdan con el organizador.</footer>
    </>
  );
}
