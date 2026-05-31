export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const SEEDDSS_API_BASE_URL =
  process.env.NEXT_PUBLIC_SEEDDSS_API_URL ?? "http://10.10.35.127:8000";

export type LoginResult = {
  access_token: string;
  token_type: string;
  provider?: string;
  user?: {
    email?: string;
    name?: string;
    role_name?: string;
  };
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type Producer = {
  id: string;
  full_name: string;
  email?: string;
};

export type Plot = {
  id: string;
  producer_id: string;
  name: string;
  code?: string | null;
  area_m2?: number | string | null;
  area_ha?: number | string | null;
  centroid_latitude?: number | string | null;
  centroid_longitude?: number | string | null;
  polygon_geojson?: any;
  soil_type?: string | null;
  water_source_type?: string | null;
  irrigation_method?: string | null;
  status?: string;
};

export type PlotCreateRequest = {
  producer_id: string;
  name: string;
  code?: string;
  area_m2?: number;
  area_ha?: number;
  centroid_latitude?: number;
  centroid_longitude?: number;
  polygon_geojson?: any;
  irrigation_method?: string;
  water_source_type?: string;
};

export type WeatherSnapshotResponse = {
  id?: string;
  provider?: string;
  forecast_date?: string;
  tmax_c?: number;
  tmin_c?: number;
  tmean_c?: number;
  precipitation_mm?: number;
  humidity_percent?: number;
  solar_radiation_estimate?: number;
  uv_index?: number;
  wind_speed_ms?: number;
};

export type AgentChatMessage = {
  role: "user" | "assistant" | "model";
  content: string;
};

export type AgentChatResponse = {
  answer: string;
  model: string;
  context_used: boolean;
};

function authHeaders(token?: string, json = true): HeadersInit {
  const headers: HeadersInit = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/seeddss-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const payloadJson = await response.json().catch(() => null);
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo iniciar sesion en SeedDSS.";
    throw new Error(detail);
  }

  return response.json() as Promise<LoginResult>;
}

export async function registerUser(payload: RegisterPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payloadJson = await response.json().catch(() => null);
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo registrar el usuario.";
    throw new Error(detail);
  }
}

export async function fetchProducers(token?: string): Promise<Producer[]> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/producers`, { headers });
  if (!response.ok) {
    throw new Error("No se pudieron cargar los productores.");
  }
  return response.json() as Promise<Producer[]>;
}

export async function fetchPlots(token?: string): Promise<Plot[]> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/plots`, { headers });
  if (!response.ok) {
    throw new Error("No se pudieron cargar las parcelas.");
  }
  return response.json() as Promise<Plot[]>;
}

export async function createPlot(payload: PlotCreateRequest, token?: string): Promise<any> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/plots`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const payloadJson = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo crear la parcela.";
    throw new Error(detail);
  }
  return payloadJson;
}

export async function fetchWeatherForLocation(latitude: number, longitude: number, token?: string, plotId?: string): Promise<WeatherSnapshotResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/weather/fetch/open-meteo`, {
    method: "POST",
    headers,
    body: JSON.stringify({ latitude, longitude, plot_id: plotId }),
  });

  const payloadJson = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo consultar el clima.";
    throw new Error(detail);
  }
  return payloadJson as WeatherSnapshotResponse;
}

export async function fetchAgentRuntimeContext(token?: string): Promise<Record<string, unknown>> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/agent/runtime-context`, { headers });
  const payloadJson = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo cargar el contexto del asistente.";
    throw new Error(detail);
  }
  return payloadJson as Record<string, unknown>;
}

export async function sendAgentChatMessage(
  message: string,
  history: AgentChatMessage[],
  context?: Record<string, unknown>,
  token?: string
): Promise<AgentChatResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/agent/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, history, context }),
  });

  const payloadJson = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo consultar el asistente.";
    throw new Error(detail);
  }
  return payloadJson as AgentChatResponse;
}

export async function uploadSeedImages(formData: FormData, token?: string): Promise<unknown> {
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/seed-samples/external-analysis`, {
    method: "POST",
    headers,
    body: formData
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail : "No se pudieron enviar las imagenes.";
    throw new Error(detail);
  }

  return payload;
}

export async function startSeedWizard(token?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/seed-samples/wizard/start`, {
    method: "POST",
    headers: authHeaders(token, false),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.detail === "string" ? payload.detail : "No se pudo iniciar el wizard SeedDSS.");
  }
  return payload;
}

export async function searchSeedProducer(codOrName: string, token?: string): Promise<any> {
  const params = new URLSearchParams({ cod_or_name: codOrName });
  const response = await fetch(`${API_BASE_URL}/seed-samples/wizard/producer?${params}`, {
    headers: authHeaders(token, false),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.detail === "string" ? payload.detail : "Productor no encontrado.");
  }
  return payload;
}

export async function saveSeedWizardStep(path: "producer" | "lot" | "sample" | "report", payload: Record<string, unknown>, token?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/seed-samples/wizard/${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof result?.detail === "string" ? result.detail : `No se pudo guardar ${path}.`);
  }
  return result;
}

export async function fetchSeedOverlayImages(analysisId: string, token?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/seed-samples/wizard/overlay-images/${analysisId}`, {
    headers: authHeaders(token, false),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.detail === "string" ? payload.detail : "No se pudieron cargar las imagenes procesadas.");
  }
  return payload;
}

export function seedReportDownloadUrl(analysisId: string): string {
  return `${API_BASE_URL}/seed-samples/wizard/download-report/${analysisId}`;
}

