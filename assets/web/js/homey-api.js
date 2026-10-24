// Minimal client for the Homey Web API.

export function createClient({ homeyUrl, token }) {
  const base = homeyUrl.trim().replace(/\/+$/, '');

  async function api(method, path, body) {
    const hasBody = body != null && method !== 'GET';
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const error = new Error(data?.error_description ?? data?.error ?? `${response.status} ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  return { base, origin: new URL(base).origin, token, api };
}
