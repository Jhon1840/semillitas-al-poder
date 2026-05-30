"use client";

import { FormEvent, useMemo, useState } from "react";
import { ImageUp, Leaf, Sprout, UploadCloud } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { API_BASE_URL, uploadSeedImages } from "@/lib/api";

export default function UploadPage() {
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
        url: URL.createObjectURL(file),
      })),
    [files]
  );

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

      const response = await uploadSeedImages(formData, window.localStorage.getItem("nexo-token") ?? undefined);
      setServiceResponse(response);
      setMessage("Imagenes enviadas correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron enviar las imagenes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Subida de imagenes" eyebrow="Analisis de semillas">
      <section className="uploadScreen">
        <div className="dashboardPanel uploadWorkPanel">
          <div className="panelHeader">
            <UploadCloud size={24} />
            <div>
              <h2>Enviar imagenes al servicio externo</h2>
              <p>Selecciona una o varias fotos de semillas para validar el flujo de analisis.</p>
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
              <Sprout size={34} />
              <strong>Arrastra o selecciona imagenes</strong>
              <span>JPG, PNG o WEBP. Puedes seleccionar varias.</span>
              <input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
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

            {message ? <div className="inlineSuccess">{message}</div> : null}
            {error ? <div className="inlineError">{error}</div> : null}

            <button type="submit" disabled={busy || !files.length}>
              <ImageUp size={18} /> {busy ? "Enviando..." : "Enviar al servicio externo"}
            </button>
          </form>

          <div className="apiNote">
            <Leaf size={18} />
            Endpoint: <code>{API_BASE_URL}/seed-samples/external-analysis</code>
          </div>
        </div>

        {serviceResponse ? (
          <section className="responseBox uploadResponse">
            <h2>Respuesta</h2>
            <pre>{JSON.stringify(serviceResponse, null, 2)}</pre>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
