"use client";

import { ArrowRight, CheckCircle2, ImageUp, Leaf, LockKeyhole, ScanSearch, ShieldCheck, Sprout, UploadCloud } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL, login, registerUser, uploadSeedImages } from "@/lib/api";

type Session = {
  email: string;
  token: string;
};

export function LandingApp() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [sampleCode, setSampleCode] = useState("");
  const [seedLotCode, setSeedLotCode] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serviceResponse, setServiceResponse] = useState<unknown>(null);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        url: URL.createObjectURL(file)
      })),
    [files]
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await login(loginEmail, loginPassword);
      setSession({ email: loginEmail, token: result.access_token });
      window.localStorage.setItem("nexo-token", result.access_token);
      setMessage("Sesion iniciada. Redirigiendo al dashboard.");
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesion.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await registerUser({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        phone: registerPhone || undefined,
      });
      setMessage("Usuario registrado. Ahora inicia sesión.");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterPhone("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar el usuario.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setServiceResponse(null);

    if (!files.length) {
      setError("Selecciona al menos una imagen de semillas.");
      setBusy(false);
      return;
    }

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      if (sampleCode) formData.append("sample_code", sampleCode);
      if (seedLotCode) formData.append("seed_lot_code", seedLotCode);

      const response = await uploadSeedImages(formData, session?.token);
      setServiceResponse(response);
      setMessage("Imagenes enviadas al backend. El backend las reenvio al servicio externo o aviso que falta configurarlo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron enviar las imagenes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#inicio" aria-label="NEXO inicio">
          <span>NX</span>
          <strong>NEXO</strong>
        </a>
        <div className="navLinks">
          <a href="#producto">Producto</a>
          <a href="#login">Login</a>
          <a href="#register">Registrar</a>
          <a href="#upload">Subir imagenes</a>
        </div>
      </nav>

      <section className="hero" id="inicio">
        <div className="heroMedia" aria-hidden="true">
          <div className="seedPhoto">
            <div className="photoToolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="seedGrid">
              {Array.from({ length: 34 }).map((_, index) => (
                <i key={index} style={{ "--r": `${(index * 17) % 28}deg`, "--s": `${18 + (index % 5) * 2}px` } as React.CSSProperties} />
              ))}
            </div>
            <div className="scanLine" />
          </div>
        </div>
        <div className="heroText">
          <p className="eyebrow">Inteligencia agricola para el arranque de campana</p>
          <h1>Analiza semillas desde una imagen y decide mejor antes de sembrar.</h1>
          <p>
            NEXO conecta el control visual de semillas con datos agronomicos para que productores y tecnicos tengan una primera lectura rapida de calidad, riesgo y trazabilidad.
          </p>
          <div className="heroActions">
            <a className="primaryLink" href="#upload">
              Probar subida
              <ArrowRight size={18} />
            </a>
            <a className="secondaryLink" href="#producto">Ver flujo</a>
          </div>
        </div>
      </section>

      <section className="section" id="producto">
        <div className="sectionHeader">
          <p className="eyebrow">MVP inicial</p>
          <h2>Un flujo claro para validar el servicio externo.</h2>
        </div>
        <div className="featureGrid">
          <Feature icon={<ImageUp />} title="Carga de imagenes" text="Selecciona una o varias fotos de semillas desde el navegador." />
          <Feature icon={<ScanSearch />} title="Envio al analisis" text="El frontend manda las imagenes a FastAPI y FastAPI las reenvia al proveedor externo." />
          <Feature icon={<ShieldCheck />} title="Claves protegidas" text="La API key del servicio externo vive en el backend, no en el navegador." />
        </div>
      </section>

      <section className="workspace">
        <section className="loginPanel" id="login">
          <div className="panelHeader">
            <LockKeyhole size={22} />
            <div>
              <h2>Login simple</h2>
              <p>Usa un usuario creado en el backend. Para pruebas puedes crearlo desde Swagger.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleLogin}>
            <label>
              Email
              <input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="usuario@nexo.app" required />
            </label>
            <label>
              Password
              <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="********" required />
            </label>
            <button type="submit" disabled={busy}>
              {session ? "Cambiar sesion" : "Entrar"}
            </button>
          </form>
          {session ? (
            <div className="sessionBox">
              <CheckCircle2 size={18} />
              Sesion activa: {session.email}
            </div>
          ) : null}
        </section>

        <section className="registerPanel" id="register">
          <div className="panelHeader">
            <Leaf size={22} />
            <div>
              <h2>Registrar usuario</h2>
              <p>Crea tu usuario para poder iniciar sesión y entrar al dashboard.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleRegister}>
            <label>
              Nombre completo
              <input value={registerName} onChange={(event) => setRegisterName(event.target.value)} placeholder="Nombre completo" required />
            </label>
            <label>
              Email
              <input type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="usuario@nexo.app" required />
            </label>
            <label>
              Password
              <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="********" required />
            </label>
            <label>
              Teléfono
              <input value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} placeholder="+549..." />
            </label>
            <button type="submit" disabled={busy}>
              Crear cuenta
            </button>
          </form>
        </section>

        <section className="uploadPanel" id="upload">
          <div className="panelHeader">
            <UploadCloud size={24} />
            <div>
              <h2>Subida de imagenes de semillas</h2>
              <p>Estas imagenes se mandan al endpoint del backend y luego al servicio externo configurado.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleUpload}>
            <div className="inlineFields">
              <label>
                Codigo de muestra
                <input value={sampleCode} onChange={(event) => setSampleCode(event.target.value)} placeholder="MUESTRA-001" />
              </label>
              <label>
                Lote de semilla
                <input value={seedLotCode} onChange={(event) => setSeedLotCode(event.target.value)} placeholder="LOTE-A12" />
              </label>
            </div>

            <label className="dropZone">
              <Sprout size={32} />
              <strong>Arrastra o selecciona imagenes</strong>
              <span>JPG, PNG o WEBP. Puedes seleccionar varias.</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
            </label>

            {previews.length ? (
              <div className="previewGrid">
                {previews.map((preview) => (
                  <article key={preview.url} className="previewCard">
                    <img src={preview.url} alt={preview.name} />
                    <div>
                      <strong>{preview.name}</strong>
                      <span>{preview.size}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <button type="submit" disabled={busy || !files.length}>
              Enviar al servicio externo
            </button>
          </form>

          <div className="apiNote">
            <Leaf size={18} />
            Endpoint: <code>{API_BASE_URL}/seed-samples/external-analysis</code>
          </div>
        </section>
      </section>

      {message || error ? (
        <div className={error ? "toast error" : "toast"}>
          {error ?? message}
        </div>
      ) : null}

      {serviceResponse ? (
        <section className="responseBox">
          <h2>Respuesta</h2>
          <pre>{JSON.stringify(serviceResponse, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="feature">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

