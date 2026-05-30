"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudSnow, Droplets, MapPin, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ParcelMap } from "@/components/ParcelMap";
import { createPlot, fetchProducers, fetchWeatherForLocation } from "@/lib/api";

type Producer = {
  id: string;
  full_name: string;
  email?: string;
};

type WeatherInfo = {
  forecast_date: string;
  tmax_c: number | null;
  tmin_c: number | null;
  precipitation_mm: number | null;
  wind_speed_ms: number | null;
};

type ZoneMeta = {
  geojson: any;
  center: { lat: number; lng: number };
  area_m2: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [producerId, setProducerId] = useState("");
  const [plotName, setPlotName] = useState("");
  const [plotCode, setPlotCode] = useState("");
  const [polygonMeta, setPolygonMeta] = useState<ZoneMeta | null>(null);
  const [irrigationZone, setIrrigationZone] = useState<ZoneMeta | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("nexo-token") : null;
    if (!stored) {
      router.replace("/");
      return;
    }
    setToken(stored);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchProducers(token)
      .then((items) => {
        setProducers(items);
        if (!producerId && items.length) {
          setProducerId(items[0].id);
        }
      })
      .catch(() => {
        setError("No se pudieron cargar los productores. Asegúrate de tener al menos uno creado.");
      });
  }, [token]);

  const canSave = useMemo(
    () => Boolean(token && producerId && plotName.trim().length > 0 && irrigationZone?.geojson && irrigationZone.area_m2 > 0),
    [token, producerId, plotName, irrigationZone]
  );

  const canSelectIrrigationZone = useMemo(
    () => Boolean(polygonMeta?.geojson && polygonMeta.area_m2 > 0),
    [polygonMeta]
  );

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
          irrigation_method: "zona_delimitada",
          water_source_type: "por_definir",
        },
        token
      );
      setMessage(`Zona de riego guardada como parcela: ${plot.name}`);
      setWeather(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la parcela.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePolygonChange(payload: ZoneMeta | null) {
    setPolygonMeta(payload);
    setIrrigationZone(null);
    if (!payload || !token) return;
    setWeather(null);
    try {
      const snapshot = await fetchWeatherForLocation(payload.center.lat, payload.center.lng, token);
      setWeather({
        forecast_date: snapshot.forecast_date ?? new Date().toISOString().slice(0, 10),
        tmax_c: snapshot.tmax_c ? Number(snapshot.tmax_c) : null,
        tmin_c: snapshot.tmin_c ? Number(snapshot.tmin_c) : null,
        precipitation_mm: snapshot.precipitation_mm ? Number(snapshot.precipitation_mm) : null,
        wind_speed_ms: snapshot.wind_speed_ms ? Number(snapshot.wind_speed_ms) : null,
      });
    } catch (caught) {
      console.warn(caught);
    }
  }

  function handleSelectIrrigationZone() {
    if (!polygonMeta) return;
    setIrrigationZone(polygonMeta);
    setMessage("Zona seleccionada para riego. Ahora puedes guardarla como parcela.");
    setError(null);
  }

  return (
    <AppShell title="Selecciona la parcela para riego" eyebrow="Dashboard de riego">
      <div className="dashboardGrid">
        <section className="dashboardPanel">
          <div className="panelHeader">
            <MapPin size={24} />
            <div>
              <h2>Zona de riego en el mapa</h2>
              <p>Marca al menos 3 puntos para delimitar el poligono que se usara como parcela seleccionada para riego.</p>
            </div>
          </div>

          <ParcelMap apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} purpose="irrigation" onPolygonChange={handlePolygonChange} />
        </section>

        <section className="dashboardPanel sidebarPanel">
          <div className="panelHeader">
            <Droplets size={24} />
            <div>
              <h2>Parcela seleccionada para riego</h2>
              <p>Primero delimita la zona, luego confirmala como zona activa de riego.</p>
            </div>
          </div>

          <label>
            Parcela
            <input value={plotName} onChange={(event) => setPlotName(event.target.value)} placeholder="Huerta 1" />
          </label>

          <label>
            Código
            <input value={plotCode} onChange={(event) => setPlotCode(event.target.value)} placeholder="PLOT-001" />
          </label>

          <label>
            Productor
            <select value={producerId} onChange={(event) => setProducerId(event.target.value)}>
              {producers.length ? (
                producers.map((producer) => (
                  <option key={producer.id} value={producer.id}>
                    {producer.full_name} {producer.email ? `(${producer.email})` : ""}
                  </option>
                ))
              ) : (
                <option value="">No hay productores</option>
              )}
            </select>
          </label>

          <div className="infoCard">
            <p><strong>Estado:</strong> {irrigationZone ? "Zona seleccionada para riego" : polygonMeta ? "Zona delimitada, pendiente de seleccionar" : "Sin zona delimitada"}</p>
            <p><strong>Vertices:</strong> {polygonMeta ? polygonMeta.geojson.coordinates[0].length - 1 : 0}</p>
            <p><strong>Area aprox:</strong> {polygonMeta ? `${Math.round(polygonMeta.area_m2)} m2` : "-"}</p>
            <p><strong>Centro:</strong> {polygonMeta ? `${polygonMeta.center.lat.toFixed(5)}, ${polygonMeta.center.lng.toFixed(5)}` : "-"}</p>
          </div>

          {weather ? (
            <div className="weatherCard">
              <CloudSnow size={20} />
              <h3>Clima estimado</h3>
              <p><strong>Fecha:</strong> {weather.forecast_date}</p>
              <p><strong>Máx:</strong> {weather.tmax_c ?? "-"} °C</p>
              <p><strong>Mín:</strong> {weather.tmin_c ?? "-"} °C</p>
              <p><strong>Lluvia:</strong> {weather.precipitation_mm ?? "-"} mm</p>
              <p><strong>Viento:</strong> {weather.wind_speed_ms ?? "-"} m/s</p>
            </div>
          ) : null}

          {message ? <div className="toast">{message}</div> : null}
          {error ? <div className="toast error">{error}</div> : null}

          <button type="button" className="secondaryButton irrigationSelectButton" onClick={handleSelectIrrigationZone} disabled={!canSelectIrrigationZone}>
            <Droplets size={18} /> Seleccionar zona para riego
          </button>

          <button type="button" className="primaryButton" onClick={handleSavePlot} disabled={!canSave || busy}>
            <Save size={18} /> Guardar parcela de riego
          </button>

          <div className="apiNote">
            API mapas: Google Maps. Clima: Open-Meteo via backend.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
