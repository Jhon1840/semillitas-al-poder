"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudSun, Droplets, MapPin, Save, Sprout } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ParcelMap } from "@/components/ParcelMap";
import { Plot, Producer, WeatherSnapshotResponse, createPlot, fetchPlots, fetchProducers, fetchWeatherForLocation } from "@/lib/api";

type ZoneMeta = {
  geojson: any;
  center: { lat: number; lng: number };
  area_m2: number;
};

type PlotMode = "existing" | "new";
type CropStage = "inicial" | "desarrollo" | "media" | "final";

const cropStages: Record<CropStage, { label: string; kc: number }> = {
  inicial: { label: "Inicial / emergencia", kc: 0.35 },
  desarrollo: { label: "Desarrollo vegetativo", kc: 0.75 },
  media: { label: "Media temporada", kc: 1.15 },
  final: { label: "Final / maduracion", kc: 0.55 },
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function plotToZone(plot: Plot): ZoneMeta | null {
  const lat = toNumber(plot.centroid_latitude, NaN);
  const lng = toNumber(plot.centroid_longitude, NaN);
  const area = toNumber(plot.area_m2, 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || area <= 0) return null;
  return {
    geojson: plot.polygon_geojson ?? null,
    center: { lat, lng },
    area_m2: area,
  };
}

function calculateEt0(weather: WeatherSnapshotResponse | null) {
  if (!weather) return 0;
  const tmax = toNumber(weather.tmax_c, 28);
  const tmin = toNumber(weather.tmin_c, 18);
  const tmean = toNumber(weather.tmean_c, (tmax + tmin) / 2);
  const wind = toNumber(weather.wind_speed_ms, 1.5);
  const humidity = toNumber(weather.humidity_percent, 60);
  const solar = toNumber(weather.solar_radiation_estimate, 0);

  if (solar > 0) {
    const radiationComponent = 0.408 * 0.72 * solar;
    const climateFactor = 1 + Math.max(-0.12, Math.min(0.18, (wind - 2) * 0.04 - (humidity - 60) * 0.002));
    return Math.max(0, radiationComponent * climateFactor);
  }

  const temperatureRange = Math.max(0.1, tmax - tmin);
  const extraterrestrialRadiationEstimate = 16;
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(temperatureRange) * extraterrestrialRadiationEstimate);
}

function buildIrrigationCalculation(params: {
  zone: ZoneMeta | null;
  weather: WeatherSnapshotResponse | null;
  cropStage: CropStage;
  seedPurity: number;
  seedVigor: number;
  weeklyPumpHours: number;
  pumpFlowLps: number;
}) {
  const baseKc = cropStages[params.cropStage].kc;
  const seedQuality = (params.seedPurity + params.seedVigor) / 2;
  const seedFactor = Math.max(0.92, Math.min(1.08, 1 + (seedQuality - 85) / 1000));
  const kcAdjusted = baseKc * seedFactor;
  const et0 = calculateEt0(params.weather);
  const etc = kcAdjusted * et0;
  const effectiveRain = Math.max(0, toNumber(params.weather?.precipitation_mm, 0) * 0.8);
  const waterDeficitMm = Math.max(0, etc - effectiveRain);
  const area = params.zone?.area_m2 ?? 0;
  const optimizedDailyLiters = waterDeficitMm * area;
  const optimizedWeeklyLiters = optimizedDailyLiters * 7;
  const traditionalWeeklyLiters = params.weeklyPumpHours * 3600 * params.pumpFlowLps;
  const savingPercent = traditionalWeeklyLiters > 0
    ? Math.max(0, Math.min(100, ((traditionalWeeklyLiters - optimizedWeeklyLiters) / traditionalWeeklyLiters) * 100))
    : 0;

  return {
    baseKc,
    seedFactor,
    kcAdjusted,
    et0,
    etc,
    effectiveRain,
    waterDeficitMm,
    optimizedDailyLiters,
    optimizedWeeklyLiters,
    traditionalWeeklyLiters,
    savingPercent,
    seedQuality,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [producerId, setProducerId] = useState("");
  const [plotMode, setPlotMode] = useState<PlotMode>("existing");
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [plotName, setPlotName] = useState("");
  const [plotCode, setPlotCode] = useState("");
  const [polygonMeta, setPolygonMeta] = useState<ZoneMeta | null>(null);
  const [irrigationZone, setIrrigationZone] = useState<ZoneMeta | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshotResponse | null>(null);
  const [cropStage, setCropStage] = useState<CropStage>("inicial");
  const [seedPurity, setSeedPurity] = useState(98);
  const [seedVigor, setSeedVigor] = useState(94);
  const [weeklyPumpHours, setWeeklyPumpHours] = useState(12);
  const [pumpFlowLps, setPumpFlowLps] = useState(50);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("nexo-token") : null;
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchProducers(token), fetchPlots(token)])
      .then(([producerItems, plotItems]) => {
        setProducers(producerItems);
        setPlots(plotItems);
        const firstProducer = producerItems[0]?.id ?? "";
        setProducerId((current) => current || firstProducer);
        const firstPlot = plotItems.find((plot) => plot.producer_id === (producerId || firstProducer)) ?? plotItems[0];
        if (firstPlot) setSelectedPlotId((current) => current || firstPlot.id);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "No se pudieron cargar los datos iniciales.");
      });
  }, [token]);

  const producerPlots = useMemo(
    () => plots.filter((plot) => !producerId || plot.producer_id === producerId),
    [plots, producerId]
  );

  const selectedPlot = useMemo(
    () => producerPlots.find((plot) => plot.id === selectedPlotId) ?? null,
    [producerPlots, selectedPlotId]
  );

  const selectedZone = plotMode === "existing" && selectedPlot ? plotToZone(selectedPlot) : irrigationZone;
  const canSelectIrrigationZone = Boolean(polygonMeta?.geojson && polygonMeta.area_m2 > 0);
  const canSave = Boolean(token && producerId && plotName.trim().length > 0 && irrigationZone?.geojson && irrigationZone.area_m2 > 0);
  const calculation = buildIrrigationCalculation({
    zone: selectedZone,
    weather,
    cropStage,
    seedPurity,
    seedVigor,
    weeklyPumpHours,
    pumpFlowLps,
  });

  useEffect(() => {
    if (!producerPlots.length) {
      setSelectedPlotId("");
      return;
    }
    if (!producerPlots.some((plot) => plot.id === selectedPlotId)) {
      setSelectedPlotId(producerPlots[0].id);
    }
  }, [producerPlots, selectedPlotId]);

  useEffect(() => {
    const zone = plotMode === "existing" && selectedPlot ? plotToZone(selectedPlot) : irrigationZone;
    if (!zone || !token) return;
    setWeather(null);
    fetchWeatherForLocation(zone.center.lat, zone.center.lng, token, selectedPlot?.id)
      .then((snapshot) => setWeather(snapshot))
      .catch(() => setError("No se pudo consultar el clima para la parcela seleccionada."));
  }, [plotMode, selectedPlot?.id, irrigationZone, token]);

  async function handleSavePlot() {
    if (!canSave || !irrigationZone || !token) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const plot = await createPlot(
        {
          producer_id: producerId,
          name: plotName,
          code: plotCode || undefined,
          polygon_geojson: irrigationZone.geojson,
          centroid_latitude: irrigationZone.center.lat,
          centroid_longitude: irrigationZone.center.lng,
          area_m2: irrigationZone.area_m2,
          area_ha: irrigationZone.area_m2 / 10000,
          irrigation_method: "zona_delimitada",
          water_source_type: "por_definir",
        },
        token
      );
      setPlots((current) => [...current, plot]);
      setSelectedPlotId(plot.id);
      setPlotMode("existing");
      setMessage(`Parcela registrada y seleccionada: ${plot.name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la parcela.");
    } finally {
      setBusy(false);
    }
  }

  function handlePolygonChange(payload: ZoneMeta | null) {
    setPolygonMeta(payload);
    setIrrigationZone(null);
  }

  function handleSelectIrrigationZone() {
    if (!polygonMeta) return;
    setIrrigationZone(polygonMeta);
    setMessage("Zona nueva seleccionada para riego. Puedes calcular y guardar la parcela.");
    setError(null);
  }

  return (
    <AppShell title="Riego inteligente por parcela" eyebrow="Dashboard de riego" variant="map">
      <div className="mapDashboardShell">
        <section className="mapDashboardCanvas">
          <ParcelMap
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
            purpose="irrigation"
            allowDrawing={plotMode === "new"}
            initialCenter={selectedZone?.center ?? { lat: -34.6037, lng: -58.3816 }}
            selectedAreaM2={selectedZone?.area_m2 ?? polygonMeta?.area_m2 ?? null}
            selectedLabel={plotMode === "existing" ? selectedPlot?.name : plotName || "Nueva parcela"}
            onPolygonChange={handlePolygonChange}
          />
        </section>

        <aside className="mapRightPanel">
          <div className="rightPanelHeader">
            <h2>Datos de Riego</h2>
            <p>Gestion de recursos hidricos</p>
          </div>

          <div className="rightPanelScroll">
            <section className="rightPanelSection">
              <h3>Flujo de parcela</h3>
              <div className="modeSwitch compact">
                <button type="button" className={plotMode === "existing" ? "active" : ""} onClick={() => setPlotMode("existing")}>
                  Existente
                </button>
                <button type="button" className={plotMode === "new" ? "active" : ""} onClick={() => setPlotMode("new")}>
                  Nueva
                </button>
              </div>

              <label>
                Cliente
                <select value={producerId} onChange={(event) => setProducerId(event.target.value)}>
                  {producers.map((producer) => (
                    <option key={producer.id} value={producer.id}>{producer.full_name}</option>
                  ))}
                </select>
              </label>

              {plotMode === "existing" ? (
                <>
                  <label>
                    Parcela registrada
                    <select value={selectedPlotId} onChange={(event) => setSelectedPlotId(event.target.value)}>
                      {producerPlots.length ? (
                        producerPlots.map((plot) => (
                          <option key={plot.id} value={plot.id}>
                            {plot.name} {plot.code ? `(${plot.code})` : ""}
                          </option>
                        ))
                      ) : (
                        <option value="">Sin parcelas registradas</option>
                      )}
                    </select>
                  </label>
                  <div className="selectionCard">
                    <span><MapPin size={18} /></span>
                    <div>
                      <strong>{selectedPlot?.name ?? "Sin parcela"}</strong>
                      <p>{selectedZone ? `${Math.round(selectedZone.area_m2).toLocaleString("es-BO")} m2` : "Falta geometria de parcela"}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="selectionCard">
                    <span><MapPin size={18} /></span>
                    <div>
                      <strong>{irrigationZone ? "Zona lista para riego" : polygonMeta ? "Delimitacion pendiente" : "Dibuja la parcela"}</strong>
                      <p>{polygonMeta ? `${Math.round(polygonMeta.area_m2).toLocaleString("es-BO")} m2 estimados` : "Usa el boton + sobre el mapa."}</p>
                    </div>
                  </div>

                  <label>
                    Nombre de parcela
                    <input value={plotName} onChange={(event) => setPlotName(event.target.value)} placeholder="Sector Norte A1" />
                  </label>
                  <label>
                    Codigo de referencia
                    <input value={plotCode} onChange={(event) => setPlotCode(event.target.value)} placeholder="NEXO-2026-X" />
                  </label>
                  <button type="button" className="secondaryButton irrigationSelectButton" onClick={handleSelectIrrigationZone} disabled={!canSelectIrrigationZone}>
                    <Droplets size={18} /> Usar zona
                  </button>
                  <button type="button" className="primaryButton" onClick={handleSavePlot} disabled={!canSave || busy}>
                    <Save size={18} /> {busy ? "Guardando..." : "Guardar parcela"}
                  </button>
                </>
              )}
            </section>

            <section className="rightPanelSection">
              <h3>Clima en tiempo real</h3>
              <div className="weatherMiniGrid">
                <article>
                  <CloudSun size={18} />
                  <strong>{weather?.tmax_c ?? "-"} C</strong>
                  <span>Temp</span>
                </article>
                <article>
                  <Droplets size={18} />
                  <strong>{calculation.effectiveRain.toFixed(1)} mm</strong>
                  <span>Lluvia ef.</span>
                </article>
                <article>
                  <Sprout size={18} />
                  <strong>{weather?.wind_speed_ms ?? "-"} m/s</strong>
                  <span>Viento</span>
                </article>
              </div>
            </section>

            <section className="rightPanelSection">
              <h3>Parametros FAO-56</h3>
              <div className="calcInputGrid panelGrid">
                <label>
                  Etapa soya
                  <select value={cropStage} onChange={(event) => setCropStage(event.target.value as CropStage)}>
                    {Object.entries(cropStages).map(([key, stage]) => (
                      <option key={key} value={key}>{stage.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Pureza (%)
                  <input type="number" min="0" max="100" value={seedPurity} onChange={(event) => setSeedPurity(toNumber(event.target.value, 0))} />
                </label>
                <label>
                  Vigor (%)
                  <input type="number" min="0" max="100" value={seedVigor} onChange={(event) => setSeedVigor(toNumber(event.target.value, 0))} />
                </label>
                <label>
                  Horas / semana
                  <input type="number" min="0" value={weeklyPumpHours} onChange={(event) => setWeeklyPumpHours(toNumber(event.target.value, 0))} />
                </label>
                <label>
                  Caudal L/s
                  <input type="number" min="0" value={pumpFlowLps} onChange={(event) => setPumpFlowLps(toNumber(event.target.value, 0))} />
                </label>
              </div>
            </section>

            <section className="rightPanelSection">
              <div className="formulaCard compact">
                <h3>ETc = Kc x ET0</h3>
                <p><strong>ET0</strong><span>{calculation.et0.toFixed(2)} mm/dia</span></p>
                <p><strong>Kc ajustado</strong><span>{calculation.kcAdjusted.toFixed(2)}</span></p>
                <p><strong>ETc</strong><span>{calculation.etc.toFixed(2)} mm/dia</span></p>
                <p><strong>Lamina neta</strong><span>{calculation.waterDeficitMm.toFixed(2)} mm/dia</span></p>
              </div>
            </section>

            <section className="rightPanelSection">
              <div className="savingCard">
                <Sprout size={22} />
                <h3>{calculation.savingPercent.toFixed(0)}% ahorro de agua</h3>
                <p><span>Tradicional</span><strong>{(calculation.traditionalWeeklyLiters / 1000).toFixed(1)} m3/semana</strong></p>
                <p><span>NEXO</span><strong>{(calculation.optimizedWeeklyLiters / 1000).toFixed(1)} m3/semana</strong></p>
                <strong>{(calculation.optimizedDailyLiters / 1000).toFixed(1)} m3 recomendados hoy</strong>
              </div>
            </section>

            {message ? <div className="inlineSuccess">{message}</div> : null}
            {error ? <div className="inlineError">{error}</div> : null}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
