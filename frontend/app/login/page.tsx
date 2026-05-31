"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@nexo.app");
  const [password, setPassword] = useState("Nexo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await login(email, password);
      window.localStorage.setItem("nexo-token", result.access_token);
      window.localStorage.setItem("nexo-email", result.user?.name || result.user?.email || email);
      window.localStorage.setItem("nexo-auth-provider", result.provider || "seeddss");
      if (result.user) {
        window.localStorage.setItem("nexo-user", JSON.stringify(result.user));
      }
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authPanel">
        <Link className="backLink" href="/">
          <ArrowLeft size={18} /> Volver al inicio
        </Link>
        <div className="authHeader">
          <span><LockKeyhole size={24} /></span>
          <div>
            <p className="eyebrow">Acceso</p>
            <h1>Ingresa a NEXO</h1>
            <p>Usa tus credenciales para entrar al dashboard de NEXO.</p>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <div className="inlineError">{error}</div> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="authSwitch">
          No tienes cuenta? <Link href="/register">Crear cuenta</Link>
        </p>
      </section>
    </main>
  );
}
