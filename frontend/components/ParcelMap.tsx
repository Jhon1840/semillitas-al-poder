"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type ParcelMapProps = {
  apiKey: string;
  initialCenter?: LatLng;
  onPolygonChange: (polygon: { geojson: any; center: LatLng; area_m2: number } | null) => void;
};

declare global {
  interface Window {
    google?: any;
  }
}

function areMapsLoaded() {
  return typeof window !== "undefined" && !!window.google?.maps;
}

export function ParcelMap({ apiKey, initialCenter = { lat: -34.6037, lng: -58.3816 }, onPolygonChange }: ParcelMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState("Cargando mapa...");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [areaMeters, setAreaMeters] = useState<number | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const instructions = useMemo(
    () => ({
      title: points.length ? "Edita tu parcela" : "Marca los puntos de tu parcela",
      subtitle: points.length
        ? "Haz click sobre el mapa para agregar otro vértice. Pulsa Guardar parcela cuando termines."
        : "Haz click sobre el mapa para agregar vértices. Necesitas al menos 3 puntos.",
    }),
    [points.length]
  );

  useEffect(() => {
    if (!apiKey) {
      setStatus("Falta la clave de Google Maps. Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
      return;
    }

    if (!mapRef.current || mapInstance.current) return;

    const initializeMap = () => {
      const google = window.google;
      mapInstance.current = new google.maps.Map(mapRef.current!, {
        center: initialCenter,
        zoom: 13,
        mapTypeId: "hybrid",
        fullscreenControl: false,
      });

      mapInstance.current.addListener("click", (event: any) => {
        const latLng = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        addPoint(latLng);
      });

      setStatus("Haz click en el mapa para crear tu parcela.");
    };

    if (areMapsLoaded()) {
      initializeMap();
      return;
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
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [apiKey, initialCenter, scriptLoaded]);

  function addPoint(latLng: LatLng) {
    if (!mapInstance.current) return;
    const google = window.google;
    const marker = new google.maps.Marker({ position: latLng, map: mapInstance.current });
    markersRef.current.push(marker);
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

    if (latLngs.length < 2) {
      onPolygonChange(null);
      return;
    }

    const google = window.google;
    polygonRef.current = new google.maps.Polygon({
      paths: latLngs,
      strokeColor: "#1f7a4d",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      fillColor: "#1f7a4d",
      fillOpacity: 0.18,
      editable: false,
      map: mapInstance.current,
    });

    const path = polygonRef.current.getPath();
    const coordinates = latLngs.map((point) => [point.lng, point.lat]);
    if (coordinates.length && coordinates[0][0] !== coordinates[coordinates.length - 1][0]) {
      coordinates.push(coordinates[0]);
    }

    const center = calculateCentroid(latLngs);
    const area = google.maps.geometry.spherical.computeArea(path);
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
    setStatus("Mapa limpio. Haz click para crear una nueva parcela.");
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
        <div ref={mapRef} className="mapCanvas" aria-label="Mapa de Google para delimitar parcela" />
        <div className="mapStatus">{status}</div>
      </div>
      <aside className="plotSummary">
        <h3>Resumen de parcela</h3>
        <p>Vértices: {points.length}</p>
        <p>{points.length >= 3 ? `Área aproximada: ${Math.round(areaMeters ?? 0)} m²` : "Necesitas al menos 3 puntos."}</p>
        <p>Centro aproximado: {points.length ? `${points[0].lat.toFixed(5)}, ${points[0].lng.toFixed(5)}` : "-"}</p>
      </aside>
    </div>
  );
}
