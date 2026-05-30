"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudSnow, MapPin, Save, Trash2 } from "lucide-react";
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

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [producerId, setProducerId] = useState("");
  const [plotName, setPlotName] = useState("");
  const [plotCode, setPlotCode] = useState("");
  const [polygonMeta, setPolygonMeta] = useState<{ geojson: any; center: { lat: number; lng: number }; area_m2: number } | null>(null);
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
    () => Boolean(token && producerId && plotName.trim().length > 0 && polygonMeta?.geojson && polygonMeta.area_m2 > 0),
    [token, producerId, plotName, polygonMeta]
  );

  async function handleSavePlot() {
    if (!canSave || !polygonMeta || !token) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const plot = await createPlot(
        {
          producer_id: producerId,
          name: plotName,
          code: plotCode || undefined,
          polygon_geojson: polygonMeta.geojson,
          centroid_latitude: polygonMeta.center.lat,
          centroid_longitude: polygonMeta.center.lng,
          area_m2: polygonMeta.area_m2,
        },
        token
      );
      setMessage(`Parcela creada: ${plot.name}`);
      setWeather(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la parcela.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePolygonChange(payload: { geojson: any; center: { lat: number; lng: number }; area_m2: number } | null) {
    setPolygonMeta(payload);
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

  return (
    <main className="dashboardPage">
      <div className="dashboardHeader">
        <button className="linkButton" type="button" onClick={() => router.push("/")}> 
          <ArrowLeft size={18} /> Volver
        </button>
        <div>
          <p className="eyebrow">Dashboard de parcelas</p>
          <h1>Delimita tu parcela en el mapa</h1>
        </div>
      </div>

      <div className="dashboardGrid">
        <section className="dashboardPanel">
          <div className="panelHeader">
            <MapPin size={24} />
            <div>
              <h2>Mapa de Google</h2>
              <p>Marca los puntos para crear el perímetro de tu parcela.</p>
            </div>
          </div>

          <ParcelMap apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} onPolygonChange={handlePolygonChange} />
        </section>

        <section className="dashboardPanel sidebarPanel">
          <div className="panelHeader">
            <CloudSnow size={24} />
            <div>
              <h2>Datos de parcela</h2>
              <p>Completa nombre y productor para guardar en el backend.</p>
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
            <p><strong>Vértices:</strong> {polygonMeta ? polygonMeta.geojson.coordinates[0].length - 1 : 0}</p>
            <p><strong>Área aprox:</strong> {polygonMeta ? `${Math.round(polygonMeta.area_m2)} m²` : "-"}</p>
            <p><strong>Centro:</strong> {polygonMeta ? `${polygonMeta.center.lat.toFixed(5)}, ${polygonMeta.center.lng.toFixed(5)}` : "-"}</p>
          </div>

          {weather ? (
            <div className="weatherCard">
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

          <button type="button" className="primaryButton" onClick={handleSavePlot} disabled={!canSave || busy}>
            <Save size={18} /> Guardar parcela
          </button>

          <button type="button" className="secondaryButton" onClick={() => router.push("/")}>
            <Trash2 size={18} /> Cancelar
          </button>

          <div className="apiNote">
            API mapas: Google Maps. Clima: Open-Meteo via backend.
          </div>
        </section>
      </div>
    </main>
  );
}
