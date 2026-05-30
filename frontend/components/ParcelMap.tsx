"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type ParcelMapProps = {
  apiKey: string;
  initialCenter?: LatLng;
  onPolygonChange: (polygon: { geojson: any; center: LatLng; area_m2: number } | null) => void;
  purpose?: "plot" | "irrigation";
};

declare global {
  interface Window {
    google?: any;
  }
}

function areMapsLoaded() {
  return typeof window !== "undefined" && !!window.google?.maps?.importLibrary;
}

export function ParcelMap({ apiKey, initialCenter = { lat: -34.6037, lng: -58.3816 }, onPolygonChange, purpose = "plot" }: ParcelMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapClassRef = useRef<any>(null);
  const markerClassRef = useRef<any>(null);
  const polygonClassRef = useRef<any>(null);
  const sphericalRef = useRef<any>(null);
  const [status, setStatus] = useState("Cargando mapa...");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [areaMeters, setAreaMeters] = useState<number | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const instructions = useMemo(
    () => ({
      title: points.length
        ? purpose === "irrigation" ? "Edita la zona de riego" : "Edita tu parcela"
        : purpose === "irrigation" ? "Delimita la zona de riego" : "Marca los puntos de tu parcela",
      subtitle: points.length
        ? "Haz click sobre el mapa para agregar otro vertice. Usa Limpiar para empezar de nuevo."
        : "Haz click sobre el mapa para agregar vertices. Necesitas al menos 3 puntos.",
    }),
    [points.length, purpose]
  );

  useEffect(() => {
    let cancelled = false;

    if (!apiKey) {
      setStatus("Falta la clave de Google Maps. Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
      return;
    }

    if (!mapRef.current || mapInstance.current) return;

    const initializeMap = async () => {
      const google = window.google;
      if (!google?.maps?.importLibrary) return;

      try {
        const [mapsLibrary, geometryLibrary] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("geometry"),
        ]);
        const markerLibrary = await google.maps.importLibrary("marker").catch(() => null);

        if (cancelled || !mapRef.current || mapInstance.current) return;

        mapClassRef.current = mapsLibrary.Map;
        polygonClassRef.current = mapsLibrary.Polygon;
        markerClassRef.current = markerLibrary?.Marker ?? google.maps.Marker ?? null;
        sphericalRef.current = geometryLibrary.spherical ?? google.maps.geometry?.spherical ?? null;
      } catch (caught) {
        console.warn(caught);
        setStatus("No se pudo preparar Google Maps. Revisa que Maps JavaScript API este habilitada.");
        return;
      }

      mapInstance.current = new mapClassRef.current(mapRef.current!, {
        center: initialCenter,
        zoom: 13,
        mapTypeId: "hybrid",
        fullscreenControl: false,
      });

      mapInstance.current.addListener("click", (event: any) => {
        const latLng = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        addPoint(latLng);
      });

      setStatus(purpose === "irrigation" ? "Haz click en el mapa para delimitar la zona de riego." : "Haz click en el mapa para crear tu parcela.");
    };

    if (areMapsLoaded()) {
      void initializeMap();
      return () => {
        cancelled = true;
      };
    }

    const script = document.querySelector<HTMLScriptElement>('script[data-google-maps]')
      ?? document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]');

    if (!script) {
      setStatus("Cargando Google Maps...");
      return;
    }

    const handleLoad = () => setScriptLoaded(true);
    const handleError = () => setStatus("No se pudo cargar el mapa. Revisa tu API key de Google Maps.");

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [apiKey, initialCenter, scriptLoaded]);

  function addPoint(latLng: LatLng) {
    if (!mapInstance.current) return;
    if (markerClassRef.current) {
      const marker = new markerClassRef.current({ position: latLng, map: mapInstance.current });
      markersRef.current.push(marker);
    }
    setPoints((current) => {
      const next = [...current, latLng];
      drawPolygon(next);
      return next;
    });
  }

  function drawPolygon(latLngs: LatLng[]) {
    if (!window.google || !mapInstance.current) return;
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    if (latLngs.length < 3) {
      onPolygonChange(null);
      return;
    }

    if (!polygonClassRef.current || !sphericalRef.current) {
      setStatus("Google Maps todavia esta preparando las herramientas del mapa.");
      return;
    }

    polygonRef.current = new polygonClassRef.current({
      paths: latLngs,
      strokeColor: purpose === "irrigation" ? "#2563eb" : "#1f7a4d",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: purpose === "irrigation" ? "#2563eb" : "#1f7a4d",
      fillOpacity: purpose === "irrigation" ? 0.2 : 0.18,
      editable: false,
      map: mapInstance.current,
    });

    const path = polygonRef.current.getPath();
    const coordinates = latLngs.map((point) => [point.lng, point.lat]);
    if (coordinates.length && coordinates[0][0] !== coordinates[coordinates.length - 1][0]) {
      coordinates.push(coordinates[0]);
    }

    const center = calculateCentroid(latLngs);
    const area = sphericalRef.current.computeArea(path);
    setAreaMeters(area);

    onPolygonChange({
      geojson: {
        type: "Polygon",
        coordinates: [coordinates],
      },
      center,
      area_m2: area,
    });
  }

  function calculateCentroid(latLngs: LatLng[]): LatLng {
    const len = latLngs.length;
    if (!len) return initialCenter;
    const total = latLngs.reduce(
      (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: total.lat / len, lng: total.lng / len };
  }

  function clearDrawing() {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    setPoints([]);
    onPolygonChange(null);
    setStatus(purpose === "irrigation" ? "Mapa limpio. Haz click para delimitar una nueva zona de riego." : "Mapa limpio. Haz click para crear una nueva parcela.");
  }

  return (
    <div className="mapSection">
      <div className="mapPanel">
        <div className="mapToolbar">
          <div>
            <strong>{instructions.title}</strong>
            <p>{instructions.subtitle}</p>
          </div>
          <div className="mapActions">
            <button type="button" onClick={clearDrawing} disabled={!points.length}>
              Limpiar
            </button>
          </div>
        </div>
        <div ref={mapRef} className="mapCanvas" aria-label={purpose === "irrigation" ? "Mapa de Google para delimitar zona de riego" : "Mapa de Google para delimitar parcela"} />
        <div className="mapStatus">{status}</div>
      </div>
      <aside className="plotSummary">
        <h3>{purpose === "irrigation" ? "Resumen de zona de riego" : "Resumen de parcela"}</h3>
        <p>Vértices: {points.length}</p>
        <p>{points.length >= 3 ? `Área aproximada: ${Math.round(areaMeters ?? 0)} m²` : "Necesitas al menos 3 puntos."}</p>
        <p>Centro aproximado: {points.length ? `${points[0].lat.toFixed(5)}, ${points[0].lng.toFixed(5)}` : "-"}</p>
      </aside>
    </div>
  );
}
