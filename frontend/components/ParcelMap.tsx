"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type ParcelMapProps = {
  apiKey: string;
  initialCenter?: LatLng;
  onPolygonChange: (polygon: { geojson: any; center: LatLng; area_m2: number } | null) => void;
  purpose?: "plot" | "irrigation";
  allowDrawing?: boolean;
  selectedLabel?: string;
  selectedAreaM2?: number | null;
};

declare global {
  interface Window {
    google?: any;
  }
}

function areMapsLoaded() {
  return typeof window !== "undefined" && !!window.google?.maps?.importLibrary;
}

export function ParcelMap({
  apiKey,
  initialCenter = { lat: -34.6037, lng: -58.3816 },
  onPolygonChange,
  purpose = "plot",
  allowDrawing = true,
  selectedLabel,
  selectedAreaM2,
}: ParcelMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const previewRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pathListenersRef = useRef<any[]>([]);
  const mapClassRef = useRef<any>(null);
  const markerClassRef = useRef<any>(null);
  const polygonClassRef = useRef<any>(null);
  const polylineClassRef = useRef<any>(null);
  const sphericalRef = useRef<any>(null);
  const drawingEnabledRef = useRef(false);
  const allowDrawingRef = useRef(allowDrawing);
  const pointsRef = useRef<LatLng[]>([]);
  const [status, setStatus] = useState("Cargando mapa...");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [areaMeters, setAreaMeters] = useState<number | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawingCompleted, setDrawingCompleted] = useState(false);

  useEffect(() => {
    allowDrawingRef.current = allowDrawing;
  }, [allowDrawing]);

  useEffect(() => {
    drawingEnabledRef.current = drawingEnabled;
    if (mapInstance.current) {
      mapInstance.current.setOptions({
        draggableCursor: drawingEnabled ? "crosshair" : undefined,
      });
    }
  }, [drawingEnabled]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

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
        polylineClassRef.current = mapsLibrary.Polyline ?? google.maps.Polyline ?? null;
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
        streetViewControl: false,
        mapTypeControl: false,
      });

      mapInstance.current.addListener("click", (event: any) => {
        if (!drawingEnabledRef.current) {
          setStatus(allowDrawingRef.current ? "Pulsa Dibujar zona antes de marcar puntos en el mapa." : "Modo lectura activo. Cambia a Registrar nueva para dibujar.");
          return;
        }
        const latLng = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        addPoint(latLng);
      });

      mapInstance.current.addListener("mousemove", (event: any) => {
        if (!drawingEnabledRef.current || !event.latLng) return;
        const cursorPoint = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        drawPreview([...pointsRef.current, cursorPoint]);
      });

      setStatus(purpose === "irrigation" ? "Mapa listo. Pulsa Dibujar zona para comenzar." : "Mapa listo. Pulsa Dibujar parcela para comenzar.");
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
  }, [allowDrawing, apiKey, initialCenter, scriptLoaded]);

  useEffect(() => {
    if (!mapInstance.current) return;
    mapInstance.current.panTo(initialCenter);
  }, [initialCenter]);

  function addPoint(latLng: LatLng) {
    if (!mapInstance.current) return;
    if (drawingCompleted) {
      setDrawingCompleted(false);
    }
    if (markerClassRef.current) {
      const marker = new markerClassRef.current({
        position: latLng,
        map: mapInstance.current,
        label: String(pointsRef.current.length + 1),
      });
      markersRef.current.push(marker);
    }
    setPoints((current) => {
      const next = [...current, latLng];
      drawCommittedShape(next, false);
      setStatus(next.length < 3 ? `Punto ${next.length} agregado. Faltan ${3 - next.length} para cerrar el area.` : `${next.length} vertices marcados. Sigue delimitando o finaliza con OK.`);
      return next;
    });
  }

  function clearPreview() {
    if (previewRef.current) {
      previewRef.current.setMap(null);
      previewRef.current = null;
    }
  }

  function clearPathListeners() {
    pathListenersRef.current.forEach((listener) => listener.remove?.());
    pathListenersRef.current = [];
  }

  function drawPreview(latLngs: LatLng[]) {
    if (!window.google || !mapInstance.current) return;
    clearPreview();

    if (latLngs.length < 2) return;

    if (latLngs.length < 3) {
      if (!polylineClassRef.current) return;
      previewRef.current = new polylineClassRef.current({
        path: latLngs,
        strokeColor: purpose === "irrigation" ? "#2563eb" : "#1f7a4d",
        strokeOpacity: 0.85,
        strokeWeight: 3,
        clickable: false,
        icons: [{
          icon: {
            path: "M 0,-1 0,1",
            strokeOpacity: 1,
            scale: 3,
          },
          offset: "0",
          repeat: "12px",
        }],
        map: mapInstance.current,
      });
      return;
    }

    if (!polygonClassRef.current) return;
    previewRef.current = new polygonClassRef.current({
      paths: latLngs,
      strokeColor: purpose === "irrigation" ? "#2563eb" : "#1f7a4d",
      strokeOpacity: 0.72,
      strokeWeight: 2,
      fillColor: purpose === "irrigation" ? "#2563eb" : "#1f7a4d",
      fillOpacity: 0.12,
      clickable: false,
      map: mapInstance.current,
    });
  }

  function drawCommittedShape(latLngs: LatLng[], editable = false) {
    if (!window.google || !mapInstance.current) return;
    clearPreview();
    if (polygonRef.current) {
      clearPathListeners();
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    if (latLngs.length < 3) {
      setAreaMeters(null);
      onPolygonChange(null);
      if (latLngs.length >= 2 && polylineClassRef.current) {
        polygonRef.current = new polylineClassRef.current({
          path: latLngs,
          strokeColor: purpose === "irrigation" ? "#2563eb" : "#1f7a4d",
          strokeOpacity: 0.95,
          strokeWeight: 3,
          clickable: false,
          map: mapInstance.current,
        });
      }
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
      clickable: false,
      editable,
      map: mapInstance.current,
    });

    syncPolygonResult(latLngs, polygonRef.current.getPath());

    if (editable) {
      const path = polygonRef.current.getPath();
      const refreshFromEditablePath = () => {
        const nextPoints: LatLng[] = path.getArray().map((point: any) => ({ lat: point.lat(), lng: point.lng() }));
        pointsRef.current = nextPoints;
        setPoints(nextPoints);
        syncPolygonResult(nextPoints, path);
      };
      pathListenersRef.current = [
        path.addListener("insert_at", refreshFromEditablePath),
        path.addListener("set_at", refreshFromEditablePath),
        path.addListener("remove_at", refreshFromEditablePath),
      ];
    }
  }

  function syncPolygonResult(latLngs: LatLng[], path: any) {
    if (!sphericalRef.current) return;
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
    clearPreview();
    clearPathListeners();
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    setPoints([]);
    setAreaMeters(null);
    setDrawingEnabled(false);
    setDrawingCompleted(false);
    onPolygonChange(null);
    setStatus(purpose === "irrigation" ? "Mapa limpio. Pulsa Dibujar zona para empezar otra vez." : "Mapa limpio. Pulsa Dibujar parcela para empezar otra vez.");
  }

  function startDrawing() {
    if (!allowDrawing) {
      setStatus("Selecciona Registrar nueva para habilitar el dibujo.");
      return;
    }
    if (!mapInstance.current) {
      setStatus("El mapa todavia esta cargando.");
      return;
    }
    if (drawingCompleted) {
      clearDrawing();
    }
    setDrawingEnabled(true);
    setDrawingCompleted(false);
    setStatus("Dibujo activo.");
  }

  function cancelDrawing() {
    setDrawingEnabled(false);
    clearPreview();
    setStatus(points.length ? "Dibujo pausado." : "Dibujo cancelado.");
  }

  function finishDrawing() {
    if (points.length < 3) {
      setStatus("Necesitas al menos 3 puntos para finalizar la zona.");
      return;
    }
    drawCommittedShape(points, true);
    setDrawingEnabled(false);
    setDrawingCompleted(true);
    setStatus(`Zona finalizada con ${points.length} vertices.`);
  }

  function undoLastPoint() {
    if (!points.length) return;
    const marker = markersRef.current.pop();
    marker?.setMap(null);
    setPoints((current) => {
      const next = current.slice(0, -1);
      drawCommittedShape(next, false);
      setStatus(next.length ? `Ultimo punto eliminado. Puntos actuales: ${next.length}.` : "Sin puntos. Pulsa sobre el mapa para marcar el primer vertice.");
      return next;
    });
  }

  return (
    <div className="mapSection">
      <div className="mapPanel">
        <div ref={mapRef} className={drawingEnabled ? "mapCanvas drawingMode" : "mapCanvas"} aria-label={purpose === "irrigation" ? "Mapa de Google para delimitar zona de riego" : "Mapa de Google para delimitar parcela"} />

        <div className="mapToolStack">
          <div className="mapIconBar" aria-label="Herramientas de mapa">
            <button type="button" className={drawingEnabled ? "active" : ""} onClick={drawingEnabled ? finishDrawing : startDrawing} disabled={!allowDrawing || (drawingEnabled && points.length < 3)} title={drawingEnabled ? "Finalizar dibujo" : "Dibujar parcela"}>
              {drawingEnabled ? "OK" : "✚"}
            </button>
            <button type="button" onClick={cancelDrawing} disabled={!drawingEnabled} title="Pausar dibujo">
              ✋
            </button>
            <button type="button" onClick={undoLastPoint} disabled={!points.length || !drawingEnabled} title="Deshacer ultimo punto">
              ↶
            </button>
            <button type="button" onClick={clearDrawing} disabled={!points.length} title="Limpiar dibujo">
              ×
            </button>
          </div>
          <div className={drawingEnabled ? "mapDrawCounter active" : drawingCompleted ? "mapDrawCounter done" : "mapDrawCounter"}>
            {drawingCompleted ? "Finalizado" : drawingEnabled ? "Dibujando" : allowDrawing ? "Listo" : "Lectura"} · {points.length} pts
          </div>
        </div>
        <div className="mapCoordinates">
          {selectedLabel ? selectedLabel : `${initialCenter.lat.toFixed(4)}, ${initialCenter.lng.toFixed(4)}`}
          {selectedAreaM2 ? ` • ${Math.round(selectedAreaM2).toLocaleString("es-BO")} m2` : ""}
          {status ? ` • ${status}` : ""}
        </div>
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
