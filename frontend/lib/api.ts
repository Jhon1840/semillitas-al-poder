export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type LoginResult = {
  access_token: string;
  token_type: string;
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

