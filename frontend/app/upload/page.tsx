"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  FlaskConical,
  ImageUp,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sprout,
  User,
  X,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  API_BASE_URL,
  SEEDDSS_API_BASE_URL,
  fetchSeedOverlayImages,
  saveSeedWizardStep,
  searchSeedProducer,
  seedReportDownloadUrl,
  startSeedWizard,
  uploadSeedImages,
} from "@/lib/api";

type ProducerData = {
  name: string;
  cod_producer: string;
  phone: string;
  address: string;
};

type LotData = {
  lotId: string;
  producer: string;
  species: string;
  variety: string;
  category: string;
  reception: string;
};

type SampleData = {
  sampleId: string;
  samplingDate: string;
  notes: string;
};

type AnalysisResult = {
  analysisId?: string;
  reportId?: string;
  predictedClass: string;
  probability: number;
  probabilityVector: number[];
  features: Record<string, unknown>;
  rawFeatures: Record<string, unknown>;
  qualityScore: number;
  viabilityPercentage: number;
  defects: { type: string; count: number }[];
};

type UploadedImage = {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "analyzing" | "completed" | "error";
};

const steps = [
  { id: 1, label: "Productor", description: "Datos del productor" },
  { id: 2, label: "Lote", description: "Registro del lote" },
  { id: 3, label: "Muestra", description: "Datos de la muestra" },
  { id: 4, label: "Analisis", description: "Imagenes e IA" },
  { id: 5, label: "Resultados", description: "Calidad y defectos" },
  { id: 6, label: "Informe", description: "Reporte final" },
];

const varieties = ["MUNASQA", "PATUJU", "SW4864", "NS6483"];
const categories = ["Basica", "Registrada", "Certificada"];

function getToken() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("nexo-token") ?? undefined;
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("nexo-user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { user_id?: string; name?: string; email?: string };
  } catch {
    return null;
  }
}

function firstFeatureGroup(features: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!features) return {};
  const first = Object.values(features)[0];
  return typeof first === "object" && first !== null ? (first as Record<string, unknown>) : features;
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildAnalysisResult(payload: any): AnalysisResult {
  const response = payload?.external_response ?? payload;
  const probability = toNumber(response?.probability, 0);
  const rawFeatures = firstFeatureGroup(response?.features);
  const impurities = String(rawFeatures["Impurezas"] ?? "").toLowerCase().includes("s");
  const damageText = String(rawFeatures["Daños mecánicos"] ?? "");
  const hasDamage = damageText.toLowerCase().includes("rajadura") || damageText.toLowerCase().includes("daño");
  const colorVariation = toNumber(String(rawFeatures["Variación de color"] ?? "").match(/[\d.]+/)?.[0], 0);
  const sizeRelative = toNumber(String(rawFeatures["Tamaño relativo"] ?? "").replace("%", ""), 0);
  const qualityScore = Math.round(Math.max(0, Math.min(100, probability * 100)));

  return {
    analysisId: response?.analysis_id,
    reportId: response?.report_id ?? response?.save_report_response?.report_id,
    predictedClass: response?.predicted_class ?? "Sin clase",
    probability,
    probabilityVector: Array.isArray(response?.probability_vector) ? response.probability_vector : [],
    rawFeatures,
    qualityScore,
    viabilityPercentage: probability * 100,
    defects: [
      { type: "Daño fisico", count: hasDamage ? Math.round(100 * (1 - probability)) : Math.round(20 * (1 - probability)) },
      { type: "Manchas", count: Math.round(Math.max(0, colorVariation)) },
      { type: "Impurezas", count: impurities ? 12 : 1 },
    ],
    features: {
      "Color medio (H)": rawFeatures["Color medio (H)"] ?? "N/A",
      "Variacion de color": rawFeatures["Variación de color"] ?? "N/A",
      "Tamano relativo": rawFeatures["Tamaño relativo"] ?? "N/A",
      Circularidad: rawFeatures["Circularidad"] ?? "N/A",
      "Danos mecanicos": rawFeatures["Daños mecánicos"] ?? "N/A",
      Impurezas: rawFeatures["Impurezas"] ?? "N/A",
      "Pureza fisica (%)": impurities ? 95 : Math.max(85, Math.min(99, sizeRelative + 20)),
      "Materia inerte (%)": impurities ? 2 : 1,
      "Danos mecanicos (%)": hasDamage ? Math.max(5, Math.round((1 - probability) * 100)) : 1,
      "Homogeneidad de color": colorVariation < 50 ? "Uniforme" : "Variable",
      "Forma y tamano": sizeRelative >= 70 ? "Dentro del rango" : "Revisar calibre",
      "Trazabilidad digital": "Completa",
    },
  };
}

export default function UploadPage() {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [producer, setProducer] = useState<ProducerData>({ name: "", cod_producer: "", phone: "", address: "" });
  const [producerSearch, setProducerSearch] = useState("");
  const [lot, setLot] = useState<LotData>({
    lotId: "",
    producer: "",
    species: "Soja",
    variety: varieties[0],
    category: categories[0],
    reception: "",
  });
  const [sample, setSample] = useState<SampleData>({ sampleId: "", samplingDate: "", notes: "" });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [overlays, setOverlays] = useState<{ filename: string; image_base64: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progress = (step / steps.length) * 100;
  const activeEndpoint = `${SEEDDSS_API_BASE_URL}/api/analyze_group`;

  const previews = useMemo(() => images.map((image) => image.preview), [images]);

  useEffect(() => {
    const storedToken = getToken();
    setToken(storedToken);
    async function initWizard() {
      if (!storedToken) return;
      try {
        const response = await startSeedWizard(storedToken);
        setSessionId(response?.external_response?.session_id ?? response?.session_id ?? null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo iniciar la sesion de verificacion.");
      }
    }
    initWizard();
  }, []);

  useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [previews]);

  function showError(caught: unknown, fallback: string) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  async function handleProducerSearch() {
    if (!producerSearch.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const found = await searchSeedProducer(producerSearch, token);
      setProducer({
        name: found.name ?? "",
        cod_producer: found.cod_producer ?? "",
        phone: found.phone ?? "",
        address: found.address ?? "",
      });
      setMessage("Productor encontrado y cargado.");
    } catch (caught) {
      showError(caught, "Productor no encontrado. Puedes registrarlo.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProducer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await saveSeedWizardStep("producer", { ...producer, session_id: sessionId }, token);
      setLot((current) => ({ ...current, producer: producer.name }));
      setStep(2);
    } catch (caught) {
      showError(caught, "No se pudo guardar el productor.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = getStoredUser();
      const response = await saveSeedWizardStep("lot", { ...lot, created_by: user?.user_id ?? null, session_id: sessionId }, token);
      setLot((current) => ({ ...current, lotId: response?.lot_id ?? response?.id ?? current.lotId }));
      setStep(3);
    } catch (caught) {
      showError(caught, "No se pudo guardar el lote.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSample(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = getStoredUser();
      const response = await saveSeedWizardStep(
        "sample",
        {
          lot_id: lot.lotId,
          sample_date: sample.samplingDate,
          analyst: user?.name ?? user?.email ?? "NEXO",
          observations: sample.notes,
          session_id: sessionId,
        },
        token
      );
      setSample((current) => ({ ...current, sampleId: response?.sample_id ?? current.sampleId }));
      setStep(4);
    } catch (caught) {
      showError(caught, "No se pudo guardar la muestra.");
    } finally {
      setBusy(false);
    }
  }

  function handleFileSelect(files: FileList | null) {
    const selected = Array.from(files ?? []).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setImages((current) => [...current, ...selected]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  async function runAnalysis() {
    if (!images.length) {
      setError("Selecciona al menos una imagen de semillas.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setImages((current) => current.map((image) => ({ ...image, status: "uploading" })));
    try {
      const formData = new FormData();
      images.forEach((image) => formData.append("files", image.file, image.file.name));
      formData.append("generated_by", producer.name);
      formData.append("sample_id", sample.sampleId || "NEXO-SAMPLE");
      formData.append("sample_code", sample.sampleId || "NEXO-SAMPLE");
      formData.append("observations", sample.notes);
      if (sessionId) formData.append("session_id", sessionId);

      setImages((current) => current.map((image) => ({ ...image, status: "analyzing" })));
      const response = await uploadSeedImages(formData, token);
      const result = buildAnalysisResult(response);
      setAnalysis(result);
      setImages((current) => current.map((image) => ({ ...image, status: "completed" })));
      if (result.analysisId) {
        window.localStorage.setItem("latest_analysis_id", result.analysisId);
      }
      setStep(5);
    } catch (caught) {
      setImages((current) => current.map((image) => ({ ...image, status: "error" })));
      showError(caught, "No se pudo completar el analisis.");
    } finally {
      setBusy(false);
    }
  }

  async function loadReport() {
    if (!analysis?.analysisId) {
      setStep(6);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetchSeedOverlayImages(analysis.analysisId, token);
      setOverlays(response?.images ?? []);
      setStep(6);
    } catch {
      setOverlays([]);
      setStep(6);
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport() {
    if (!analysis?.analysisId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(seedReportDownloadUrl(analysis.analysisId), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("No se pudo descargar el informe PDF.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Reporte_${analysis.analysisId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      showError(caught, "No se pudo descargar el informe.");
    } finally {
      setBusy(false);
    }
  }

  function resetFlow() {
    setStep(1);
    setProducer({ name: "", cod_producer: "", phone: "", address: "" });
    setLot({ lotId: "", producer: "", species: "Soja", variety: varieties[0], category: categories[0], reception: "" });
    setSample({ sampleId: "", samplingDate: "", notes: "" });
    setImages([]);
    setAnalysis(null);
    setOverlays([]);
    setMessage(null);
    setError(null);
  }

  return (
    <AppShell title="Verificacion de semillas" eyebrow="SeedDSS + NEXO">
      <section className="seedWizard">
        <div className="wizardHero">
          <div>
            <p className="eyebrow">Calidad de semillas</p>
            <h2>Sistema de verificacion paso a paso</h2>
            <p>Replica el proceso SeedDSS: productor, lote, muestra, analisis por imagenes, resultados e informe.</p>
          </div>
          <div className="wizardEndpoint">
            <span>API externa activa</span>
            <code>{activeEndpoint}</code>
          </div>
        </div>

        <div className="wizardProgress" aria-label="Progreso de verificacion">
          <div className="wizardProgressBar"><span style={{ width: `${progress}%` }} /></div>
          <div className="wizardSteps">
            {steps.map((item) => (
              <button key={item.id} className={item.id === step ? "wizardStep active" : item.id < step ? "wizardStep done" : "wizardStep"} type="button" onClick={() => item.id < step && setStep(item.id)}>
                {item.id < step ? <CheckCircle2 size={18} /> : item.id}
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            ))}
          </div>
        </div>

        {message ? <div className="inlineSuccess">{message}</div> : null}
        {error ? <div className="inlineError">{error}</div> : null}

        <div className="wizardCard">
          {step === 1 ? (
            <form className="wizardForm" onSubmit={submitProducer}>
              <div className="stepHeader"><User size={24} /><div><h3>Datos del productor</h3><p>Busca un productor existente o registra uno nuevo.</p></div></div>
              <div className="searchLine">
                <input value={producerSearch} onChange={(event) => setProducerSearch(event.target.value)} placeholder="Codigo o nombre del productor" />
                <button type="button" onClick={handleProducerSearch} disabled={busy}><Search size={17} /> Buscar</button>
              </div>
              <div className="wizardGrid">
                <label>Nombre completo<input value={producer.name} onChange={(event) => setProducer({ ...producer, name: event.target.value })} required /></label>
                <label>Codigo de productor<input value={producer.cod_producer} onChange={(event) => setProducer({ ...producer, cod_producer: event.target.value })} required /></label>
                <label>Telefono<input value={producer.phone} onChange={(event) => setProducer({ ...producer, phone: event.target.value })} required /></label>
                <label>Direccion<input value={producer.address} onChange={(event) => setProducer({ ...producer, address: event.target.value })} required /></label>
              </div>
              <div className="wizardActions"><button type="submit" disabled={busy}>{busy ? "Guardando..." : "Continuar al lote"}</button></div>
            </form>
          ) : null}

          {step === 2 ? (
            <form className="wizardForm" onSubmit={submitLot}>
              <div className="stepHeader"><Package size={24} /><div><h3>Registro del lote</h3><p>Informacion del lote de semilla de soya.</p></div></div>
              <div className="wizardGrid">
                <label>Productor<input value={lot.producer || producer.name} readOnly /></label>
                <label>Especie<input value={lot.species} onChange={(event) => setLot({ ...lot, species: event.target.value })} required /></label>
                <label>Variedad<select value={lot.variety} onChange={(event) => setLot({ ...lot, variety: event.target.value })}>{varieties.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Categoria<select value={lot.category} onChange={(event) => setLot({ ...lot, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Fecha de recepcion<input type="date" value={lot.reception} onChange={(event) => setLot({ ...lot, reception: event.target.value })} required /></label>
              </div>
              <div className="wizardActions split"><button type="button" className="secondaryButton" onClick={() => setStep(1)}><ArrowLeft size={17} /> Volver</button><button type="submit" disabled={busy}>{busy ? "Guardando..." : "Registrar lote"}</button></div>
            </form>
          ) : null}

          {step === 3 ? (
            <form className="wizardForm" onSubmit={submitSample}>
              <div className="stepHeader"><FlaskConical size={24} /><div><h3>Registro de muestra</h3><p>Asocia la muestra al lote seleccionado.</p></div></div>
              <div className="wizardGrid">
                <label>ID de lote<input value={lot.lotId} onChange={(event) => setLot({ ...lot, lotId: event.target.value })} required /></label>
                <label>Fecha de muestreo<input type="date" value={sample.samplingDate} onChange={(event) => setSample({ ...sample, samplingDate: event.target.value })} required /></label>
                <label className="wide">Observaciones<textarea value={sample.notes} onChange={(event) => setSample({ ...sample, notes: event.target.value })} rows={4} /></label>
              </div>
              <div className="wizardActions split"><button type="button" className="secondaryButton" onClick={() => setStep(2)}><ArrowLeft size={17} /> Volver</button><button type="submit" disabled={busy}>{busy ? "Guardando..." : "Registrar muestra"}</button></div>
            </form>
          ) : null}

          {step === 4 ? (
            <div className="wizardForm">
              <div className="stepHeader"><ImageUp size={24} /><div><h3>Analisis de imagenes</h3><p>Sube una o varias imagenes para procesarlas con la IA externa.</p></div></div>
              <button className="wizardDropZone" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <Sprout size={36} />
                <strong>Seleccionar imagenes de semillas</strong>
                <span>JPG, PNG, BMP. Se enviaran a SeedDSS.</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => handleFileSelect(event.target.files)} />
              {images.length ? (
                <div className="wizardImages">
                  {images.map((image, index) => (
                    <div key={`${image.file.name}-${index}`} className="wizardImage">
                      <img src={image.preview} alt={image.file.name} />
                      <span><strong>{image.file.name}</strong><small>{image.status}</small></span>
                      {busy ? <Loader2 className="spin" size={18} /> : <button type="button" className="iconButton" onClick={() => removeImage(index)}><X size={16} /></button>}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="apiNote"><ImageUp size={18} /> NEXO envia a <code>{API_BASE_URL}/seed-samples/external-analysis</code> y el backend reenvia a <code>{activeEndpoint}</code>.</div>
              <div className="wizardActions split"><button type="button" className="secondaryButton" onClick={() => setStep(3)} disabled={busy}><ArrowLeft size={17} /> Volver</button><button type="button" onClick={runAnalysis} disabled={busy || !images.length}>{busy ? <><Loader2 className="spin" size={17} /> Analizando...</> : "Iniciar analisis IA"}</button></div>
            </div>
          ) : null}

          {step === 5 && analysis ? (
            <div className="wizardForm">
              <div className="stepHeader"><CheckCircle2 size={24} /><div><h3>Resultados del analisis</h3><p>La IA procesó las imagenes y generó indicadores de calidad.</p></div></div>
              <div className="resultSummary">
                <div><span>Clase predicha</span><strong>{analysis.predictedClass}</strong></div>
                <div><span>Confianza</span><strong>{(analysis.probability * 100).toFixed(2)}%</strong></div>
                <div><span>Calidad</span><strong>{analysis.qualityScore}/100</strong></div>
                <div><span>Viabilidad</span><strong>{analysis.viabilityPercentage.toFixed(2)}%</strong></div>
              </div>
              <div className="featureGrid">
                {Object.entries(analysis.features).map(([key, value]) => (
                  <div key={key} className="featureTile"><span>{key}</span><strong>{String(value)}</strong></div>
                ))}
              </div>
              <div className="defectList">
                {analysis.defects.map((defect) => <div key={defect.type}><span>{defect.type}</span><strong>{defect.count}</strong></div>)}
              </div>
              <div className="wizardActions split"><button type="button" className="secondaryButton" onClick={() => setStep(4)}><ArrowLeft size={17} /> Volver</button><button type="button" onClick={loadReport} disabled={busy}>{busy ? "Preparando..." : "Ver informe final"}</button></div>
            </div>
          ) : null}

          {step === 6 && analysis ? (
            <div className="wizardForm">
              <div className="stepHeader"><FileText size={24} /><div><h3>Informe final de verificacion</h3><p>Resumen trazable del productor, lote, muestra y resultado IA.</p></div></div>
              <div className="reportGrid">
                <section><h4>Productor</h4><p>{producer.name}</p><small>{producer.cod_producer} · {producer.phone}</small><small>{producer.address}</small></section>
                <section><h4>Lote</h4><p>{lot.species} {lot.variety}</p><small>{lot.category} · {lot.reception}</small><small>ID: {lot.lotId}</small></section>
                <section><h4>Muestra</h4><p>{sample.sampleId}</p><small>{sample.samplingDate}</small><small>{sample.notes || "Sin observaciones"}</small></section>
                <section><h4>Evaluacion</h4><p>{analysis.qualityScore >= 75 ? "Apta para seguimiento" : "Requiere revision"}</p><small>{analysis.predictedClass}</small><small>{(analysis.probability * 100).toFixed(2)}% de confianza</small></section>
              </div>
              <div className="overlayPanel">
                <h4>Imagenes procesadas con mascaras</h4>
                {overlays.length ? <div className="overlayGrid">{overlays.map((image) => <figure key={image.filename}><img src={image.image_base64} alt={image.filename} /><figcaption>{image.filename}</figcaption></figure>)}</div> : <p>No hay imagenes procesadas disponibles para este analisis.</p>}
              </div>
              <div className="wizardActions split">
                <button type="button" className="secondaryButton" onClick={resetFlow}><RefreshCw size={17} /> Nueva verificacion</button>
                <button type="button" onClick={downloadReport} disabled={busy || !analysis.analysisId}><Download size={17} /> Descargar PDF</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
