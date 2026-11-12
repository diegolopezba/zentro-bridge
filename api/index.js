const SUPABASE_URL = "https://fipdpcitsjpqivljrktj.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGRwY2l0c2pwcWl2bGpya3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTQwMTgsImV4cCI6MjA4MTQ5MDAxOH0.TYe0v-Ue60Cc7AuXKmMCp91kwTwXrgiK_EyNtfOcOKg";
const APP_SITE = "https://www.zentro.today";
const DEFAULT_IMAGE = "https://www.zentro.today/og-image.png";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz"
    }).format(d);
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "go.zentro.today"}`);
  const path = url.pathname;
  const search = url.search || "";
  const redirectTo = `${APP_SITE}${path}${search}`;

  // 1. Perfiles (@username o /user/:id) con foto y nombre dinámicos
  if (/^\/@[^/]+\/?$/.test(path) || /^\/user\/[^/]+\/?$/.test(path)) {
    const endpoint = new URL(`${SUPABASE_URL}/functions/v1/profile-preview`);
    const byUsername = path.startsWith("/@");
    try {
      const identity = decodeURIComponent(
        byUsername ? path.slice(2).replace(/\/$/, "") : path.split("/")[2]
      );
      endpoint.searchParams.set(byUsername ? "username" : "id", identity);
      const preview = await fetch(endpoint, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        signal: AbortSignal.timeout(8000),
      });
      if (preview.ok) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, s-maxage=300");
        return res.status(200).send(await preview.text());
      }
    } catch (e) {
      // Si falla la consulta o no existe el perfil, continúa con la redirección genérica
    }
  }

  let title = "Zentro";
  let description = "Descubre y únete a los mejores eventos de vida social.";
  let image = DEFAULT_IMAGE;

  // 2. Extraer slug de /e/:slug o /event/:id
  const eventMatch = path.match(/^\/(?:e|event)\/([^/?#]+)/);
  if (eventMatch) {
    const identifier = decodeURIComponent(eventMatch[1]);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const filter = isUuid ? `id=eq.${identifier}` : `share_slug=eq.${identifier}`;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/events?${filter}&select=id,title,description,image_url,location_name,start_datetime&deleted_at=is.null&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      );
      const events = await response.json();
      if (events && events[0]) {
        const ev = events[0];
        title = ev.title ? `${ev.title} · Zentro` : "Evento en Zentro";
        
        const when = formatDate(ev.start_datetime);
        const place = ev.location_name ? ev.location_name.split(",")[0].trim() : "";
        const parts = [place, when].filter(Boolean);
        description = parts.length ? parts.join(" · ") : (ev.description || description);

        if (ev.image_url) {
          image = ev.image_url;
        }
      }
    } catch (e) {
      // Si falla la consulta, usa los valores por defecto
    }
  }

  // Si la imagen es de Supabase Storage, optimizamos el tamaño para WhatsApp (1200x630)
  if (image.includes("/storage/v1/object/public/")) {
    image = image.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=1200&height=630&resize=cover&quality=80";
  }

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeRedirect = escapeHtml(redirectTo);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />

  <meta property="og:site_name" content="Zentro" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(url.href)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />

  <meta http-equiv="refresh" content="0;url=${safeRedirect}" />
  <script>window.location.replace(${JSON.stringify(redirectTo)});</script>
  <style>
    body { background: #000; color: #fff; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    a { color: #fff; text-decoration: underline; }
  </style>
</head>
<body>
  <p>Abriendo Zentro... <a href="${safeRedirect}">Haz clic aquí si no redirige</a></p>
</body>
</html>`;

  return res.status(200).send(html);
}
