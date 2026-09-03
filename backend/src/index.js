/**
 * AR Exporter — Cloudflare Worker
 *
 * Rotas:
 *   POST   /upload                  — Recebe USDZ, salva no R2, registra no D1
 *   GET    /file/:id                — Serve o arquivo e registra o scan
 *   DELETE /file/:id                — Remove o arquivo (autenticado por device_id ou token Pro)
 *   POST   /validate-token          — Verifica se um token Pro é válido
 *   GET    /analytics/:id           — Contagem de scans (Pro only)
 *   POST   /admin/add-token         — Adiciona token Pro (protegido por ADMIN_SECRET)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_FREE_FILES = 3;
const FREE_EXPIRY_DAYS = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function expiryTs() {
  return nowSec() + FREE_EXPIRY_DAYS * 86400;
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// Roteador
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === "POST" && path === "/upload")
        return await handleUpload(request, env);

      if (method === "GET" && path.startsWith("/file/"))
        return await handleServe(request, env, path.split("/")[2]);

      if (method === "DELETE" && path.startsWith("/file/"))
        return await handleDelete(request, env, path.split("/")[2]);

      if (method === "POST" && path === "/validate-token")
        return await handleValidateToken(request, env);

      if (method === "GET" && path.startsWith("/analytics/"))
        return await handleAnalytics(request, env, path.split("/")[2]);

      if (method === "POST" && path === "/admin/add-token")
        return await handleAdminAddToken(request, env);

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Internal server error" }, 500);
    }
  },

  // Limpeza diária dos arquivos expirados
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanupExpired(env));
  },
};

// ---------------------------------------------------------------------------
// POST /upload
// ---------------------------------------------------------------------------

async function handleUpload(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  const file = form.get("file");
  const deviceId = form.get("device_id");
  const proToken = form.get("pro_token");

  if (!file || !deviceId) {
    return json({ error: "Campos obrigatórios: file, device_id" }, 400);
  }

  // Validar token Pro
  let isPro = false;
  if (proToken) {
    const row = await env.DB.prepare(
      "SELECT token FROM tokens WHERE token = ?"
    )
      .bind(proToken)
      .first();
    isPro = !!row;
  }

  // Checar limite do plano gratuito
  if (!isPro) {
    const { count } = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM files WHERE device_id = ? AND (expires_at IS NULL OR expires_at > ?)"
    )
      .bind(deviceId, nowSec())
      .first();

    if (count >= MAX_FREE_FILES) {
      return json(
        {
          error: "limit_reached",
          message: `Limite de ${MAX_FREE_FILES} exports atingido. Apague um arquivo ou assine o Plano Pro.`,
        },
        429
      );
    }
  }

  const fileId = randomId();
  const filename = file.name || "model.usdz";
  const buffer = await file.arrayBuffer();

  // Salvar no R2
  await env.STORAGE.put(fileId, buffer, {
    httpMetadata: { contentType: "model/vnd.usdz+zip" },
    customMetadata: { filename },
  });

  const now = nowSec();
  const expiresAt = isPro ? null : expiryTs();

  // Registrar no D1
  await env.DB.prepare(
    "INSERT INTO files (id, device_id, filename, size, created_at, expires_at, is_pro) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(fileId, deviceId, filename, buffer.byteLength, now, expiresAt, isPro ? 1 : 0)
    .run();

  const origin = new URL(request.url).origin;
  const fileUrl = `${origin}/file/${fileId}`;

  return json({
    url: fileUrl,
    file_id: fileId,
    expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    size: buffer.byteLength,
    filename,
  });
}

// ---------------------------------------------------------------------------
// GET /file/:id
// ---------------------------------------------------------------------------

async function handleServe(request, env, fileId) {
  if (!fileId) return json({ error: "ID inválido" }, 400);

  const record = await env.DB.prepare("SELECT * FROM files WHERE id = ?")
    .bind(fileId)
    .first();

  if (!record) return json({ error: "Arquivo não encontrado" }, 404);

  const now = nowSec();
  if (record.expires_at && record.expires_at < now) {
    // Limpar arquivo expirado
    await env.STORAGE.delete(fileId);
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();
    return json(
      {
        error: "expired",
        message:
          "Este arquivo expirou. Faça upgrade para o Plano Pro e exporte novamente.",
      },
      410
    );
  }

  // Registrar scan
  await env.DB.prepare(
    "INSERT INTO scans (file_id, scanned_at, user_agent) VALUES (?, ?, ?)"
  )
    .bind(fileId, now, request.headers.get("User-Agent") || "")
    .run();

  const object = await env.STORAGE.get(fileId);
  if (!object) return json({ error: "Arquivo não encontrado no storage" }, 404);

  return new Response(object.body, {
    headers: {
      ...CORS,
      "Content-Type": "model/vnd.usdz+zip",
      "Content-Disposition": `inline; filename="${record.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /file/:id
// ---------------------------------------------------------------------------

async function handleDelete(request, env, fileId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const { device_id, pro_token } = body;

  const record = await env.DB.prepare("SELECT * FROM files WHERE id = ?")
    .bind(fileId)
    .first();

  if (!record) return json({ error: "Arquivo não encontrado" }, 404);

  // Autorização: device_id próprio OU token Pro válido
  let authorized = record.device_id === device_id;
  if (!authorized && pro_token) {
    const tok = await env.DB.prepare(
      "SELECT token FROM tokens WHERE token = ?"
    )
      .bind(pro_token)
      .first();
    authorized = !!tok;
  }

  if (!authorized) return json({ error: "Não autorizado" }, 401);

  await env.STORAGE.delete(fileId);
  await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();
  await env.DB.prepare("DELETE FROM scans WHERE file_id = ?").bind(fileId).run();

  return json({ success: true });
}

// ---------------------------------------------------------------------------
// POST /validate-token
// ---------------------------------------------------------------------------

async function handleValidateToken(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ valid: false });
  }

  const { token } = body;
  if (!token) return json({ valid: false });

  const row = await env.DB.prepare("SELECT token FROM tokens WHERE token = ?")
    .bind(token)
    .first();

  return json({ valid: !!row });
}

// ---------------------------------------------------------------------------
// GET /analytics/:file_id
// ---------------------------------------------------------------------------

async function handleAnalytics(request, env, fileId) {
  const auth = request.headers.get("Authorization") || "";
  const proToken = auth.replace("Bearer ", "").trim();

  if (!proToken) return json({ error: "Token Pro obrigatório" }, 401);

  const tok = await env.DB.prepare("SELECT token FROM tokens WHERE token = ?")
    .bind(proToken)
    .first();
  if (!tok) return json({ error: "Token inválido" }, 401);

  const { scan_count } = await env.DB.prepare(
    "SELECT COUNT(*) AS scan_count FROM scans WHERE file_id = ?"
  )
    .bind(fileId)
    .first();

  return json({ file_id: fileId, scan_count });
}

// ---------------------------------------------------------------------------
// POST /admin/add-token   (use ADMIN_SECRET no header X-Admin-Secret)
// ---------------------------------------------------------------------------

async function handleAdminAddToken(request, env) {
  const secret = request.headers.get("X-Admin-Secret");
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "Não autorizado" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const token = body.token || crypto.randomUUID();
  const label = body.label || "";

  await env.DB.prepare(
    "INSERT OR IGNORE INTO tokens (token, created_at, label) VALUES (?, ?, ?)"
  )
    .bind(token, nowSec(), label)
    .run();

  return json({ token, label });
}

// ---------------------------------------------------------------------------
// Limpeza de arquivos expirados (scheduled)
// ---------------------------------------------------------------------------

async function cleanupExpired(env) {
  const now = nowSec();
  const { results } = await env.DB.prepare(
    "SELECT id FROM files WHERE expires_at IS NOT NULL AND expires_at < ?"
  )
    .bind(now)
    .all();

  for (const row of results) {
    await env.STORAGE.delete(row.id);
    await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(row.id).run();
    await env.DB.prepare("DELETE FROM scans WHERE file_id = ?").bind(row.id).run();
  }

  console.log(`Cleanup: ${results.length} arquivo(s) expirado(s) removido(s).`);
}
