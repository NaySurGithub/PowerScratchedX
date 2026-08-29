const BASE = import.meta.env.VITE_API_URL || '';

export async function health() {
  const res = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function build(project) {
  const res = await fetch(`${BASE}/api/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (res.ok) {
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return { ok: true, blob, filename: match ? match[1] : `${project.name}.jar` };
  }
  let body;
  try {
    body = await res.json();
  } catch {
    body = { error: `HTTP ${res.status}` };
  }
  return { ok: false, status: res.status, ...body };
}
