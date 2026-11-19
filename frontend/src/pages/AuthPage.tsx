import { FormEvent, useState } from "react";
import { useAuth } from "../auth";
import { ErrorAlert } from "../components/ui";
import { navigate } from "../router";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="panel auth-card">
      <h1>{mode === "login" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}</h1>
      <p className="muted">{mode === "login" ? "Para anotarte en un viaje y ver tus lugares." : "Es gratis y te lleva un minuto."}</p>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "login"} className={`btn ${mode === "login" ? "" : "btn-ghost"}`} onClick={() => { setMode("login"); setError(""); }}>Ingresar</button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={`btn ${mode === "register" ? "" : "btn-ghost"}`} onClick={() => { setMode("register"); setError(""); }}>Registrarme</button>
      </div>
      <form onSubmit={submit} noValidate>
        {error && <ErrorAlert>{error}</ErrorAlert>}
        {mode === "register" && (
          <div className="field"><label htmlFor="name">Nombre y apellido</label><input id="name" autoComplete="name" value={form.name} onChange={set("name")} required /></div>
        )}
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required /></div>
        <div className="field">
          <label htmlFor="password">Contraseña {mode === "register" && <span className="hint">(mínimo 8 caracteres)</span>}</label>
          <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} required />
        </div>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Enviando…" : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>
      </form>
    </div>
  );
}
