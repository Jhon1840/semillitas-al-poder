"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";

import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await registerUser({ name, email, password, phone: phone || undefined });
      setMessage("Cuenta creada. Te llevamos al login.");
      window.setTimeout(() => router.push("/login"), 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la cuenta.");
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
          <span><UserPlus size={24} /></span>
          <div>
            <p className="eyebrow">Nueva cuenta</p>
            <h1>Crea tu acceso</h1>
            <p>Registra un usuario para probar el flujo privado de NEXO.</p>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Nombre completo
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label>
            Telefono
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          {error ? <div className="inlineError">{error}</div> : null}
          {message ? <div className="inlineSuccess">{message}</div> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <p className="authSwitch">
          Ya tienes cuenta? <Link href="/login">Ingresar</Link>
        </p>
      </section>
    </main>
  );
}
