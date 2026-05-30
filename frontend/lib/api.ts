export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type LoginResult = {
  access_token: string;
  token_type: string;
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

export type PlotCreateRequest = {
  producer_id: string;
  name: string;
  code?: string;
  area_m2?: number;
  centroid_latitude?: number;
  centroid_longitude?: number;
  polygon_geojson?: any;
};

export type WeatherSnapshotResponse = {
  forecast_date?: string;
  tmax_c?: number;
  tmin_c?: number;
  precipitation_mm?: number;
  wind_speed_ms?: number;
};

export async function login(email: string, password: string): Promise<LoginResult> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("No se pudo iniciar sesion. Revisa el usuario o crea uno desde Swagger.");
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

export async function fetchWeatherForLocation(latitude: number, longitude: number, token?: string): Promise<WeatherSnapshotResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/weather/fetch/open-meteo`, {
    method: "POST",
    headers,
    body: JSON.stringify({ latitude, longitude }),
  });

  const payloadJson = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payloadJson?.detail === "string" ? payloadJson.detail : "No se pudo consultar el clima.";
    throw new Error(detail);
  }
  return payloadJson as WeatherSnapshotResponse;
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

