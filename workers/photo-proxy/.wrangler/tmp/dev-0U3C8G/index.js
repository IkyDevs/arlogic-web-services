var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var TELEGRAM_API = "https://api.telegram.org";
var CACHE_TTL = 604800;
var DEFAULT_ALLOWED_ORIGINS = [
  "https://arlogic-web-services.vercel.app",
  "https://arlogic.com",
  "https://www.arlogic.com",
  "http://localhost:3000",
  "http://localhost:3001"
];
function getAllowedOrigins(env) {
  const override = env?.ALLOWED_ORIGINS;
  if (!override) return new Set(DEFAULT_ALLOWED_ORIGINS);
  return new Set(override.split(",").map((o) => o.trim()).filter(Boolean));
}
__name(getAllowedOrigins, "getAllowedOrigins");
function isOriginAllowed(origin, allowed) {
  if (!origin) return false;
  for (const a of allowed) {
    if (a.startsWith("*.")) {
      if (origin.endsWith(a.slice(1))) return true;
      continue;
    }
    if (origin === a) return true;
  }
  return false;
}
__name(isOriginAllowed, "isOriginAllowed");
var rlStore = /* @__PURE__ */ new Map();
async function rateLimit(ip, max, windowSec) {
  const now = Date.now();
  const windowMs = windowSec * 1e3;
  const hits = (rlStore.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retryAfter = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1e3));
    return { ok: false, retryAfter };
  }
  hits.push(now);
  rlStore.set(ip, hits);
  return { ok: true, retryAfter: 0 };
}
__name(rateLimit, "rateLimit");
async function handleUpload(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const allowed = getAllowedOrigins(env);
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin ? origin : "https://arlogic-web-services.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (origin && !isOriginAllowed(origin, allowed)) {
    return new Response(JSON.stringify({ error: "Origin tidak diizinkan" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const rateMax = Number(env.RATE_LIMIT_MAX || 30);
  const rateWindowSec = Number(env.RATE_LIMIT_WINDOW_SEC || 60);
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
  {
    const rl = await rateLimit(ip, rateMax, rateWindowSec);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Terlalu banyak permintaan. Coba lagi beberapa saat." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) }
      });
    }
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const formData = await request.formData();
    const files = [];
    const caption = formData.get("caption") || "";
    const channelType = formData.get("type") || "layanan";
    const providedChatId = formData.get("chat_id") || "";
    for (const [key, value] of formData.entries()) {
      if (key === "files" && typeof value === "object" && value !== null) {
        files.push(value);
      }
    }
    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const MAX_FILES = 20;
    const MAX_IMG_BYTES = 15 * 1024 * 1024;
    const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
    const IMAGE_EXT = /^.*\.(jpg|jpeg|png|webp|heic|heif|avif)$/i;
    const VIDEO_EXT = /^.*\.(mp4|mov|webm|3gp|3gpp|avi)$/i;
    const isVideo = /* @__PURE__ */ __name((f) => f.type.startsWith("video/") || VIDEO_EXT.test(f.name), "isVideo");
    const isImage = /* @__PURE__ */ __name((f) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name), "isImage");
    if (files.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Maksimal ${MAX_FILES} file per upload` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    for (const f of files) {
      const maxBytes = isVideo(f) ? MAX_VIDEO_BYTES : MAX_IMG_BYTES;
      if (f.size > maxBytes) {
        return new Response(JSON.stringify({ error: `"${f.name}" terlalu besar (max ${isVideo(f) ? "50MB" : "15MB"})` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (!isVideo(f) && !isImage(f)) {
        return new Response(JSON.stringify({ error: `"${f.name}" bukan format gambar/video yang didukung` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    const envMap = {
      attendance: env.TELEGRAM_CHANNEL_ATTENDANCE,
      service: env.TELEGRAM_CHANNEL_SERVICE,
      layanan: env.TELEGRAM_CHANNEL_LAYANAN,
      inventory: env.TELEGRAM_CHANNEL_INVENTORY,
      kaspin: env.TELEGRAM_CHANNEL_KASPIN,
      teknisi_update: env.TELEGRAM_CHANNEL_TEKNISI_UPDATE,
      qc_update: env.TELEGRAM_CHANNEL_QC_UPDATE,
      closing: env.TELEGRAM_CHANNEL_LAYANAN
    };
    const chatId = providedChatId || envMap[channelType] || DEFAULT_CHANNELS[channelType] || "@arlogic_layanan";
    const botUrl = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}`;
    const workerBase = request.url.replace(/\/upload$/, "");
    const results = [];
    if (files.length === 1) {
      const f = files[0];
      if (isVideo(f)) {
        const videoForm = new FormData();
        videoForm.append("chat_id", chatId);
        videoForm.append("video", f, f.name);
        if (caption) videoForm.append("caption", caption);
        videoForm.append("parse_mode", "HTML");
        const res = await fetch(`${botUrl}/sendVideo`, { method: "POST", body: videoForm });
        const data = await res.json();
        if (!data.ok) {
          return new Response(JSON.stringify({ error: data.description || "Telegram API error" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const msg = data.result;
        const fileId = msg.video?.file_id || "";
        results.push({
          file_id: fileId,
          url: `${workerBase}/photos/${fileId}`,
          chat_id: String(msg.chat.id),
          message_id: msg.message_id
        });
      } else {
        const photoForm = new FormData();
        photoForm.append("chat_id", chatId);
        photoForm.append("photo", f, f.name);
        if (caption) photoForm.append("caption", caption);
        photoForm.append("parse_mode", "HTML");
        const res = await fetch(`${botUrl}/sendPhoto`, { method: "POST", body: photoForm });
        const data = await res.json();
        if (!data.ok) {
          return new Response(JSON.stringify({ error: data.description || "Telegram API error" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const msg = data.result;
        const fileId = msg.photo?.[msg.photo.length - 1]?.file_id || "";
        results.push({
          file_id: fileId,
          url: `${workerBase}/photos/${fileId}`,
          chat_id: String(msg.chat.id),
          message_id: msg.message_id
        });
      }
    } else {
      const ALBUM_MAX = 10;
      const chunks = [];
      for (let i = 0; i < files.length; i += ALBUM_MAX) {
        chunks.push(files.slice(i, i + ALBUM_MAX));
      }
      const workerUrl = /* @__PURE__ */ __name((fileId) => `${workerBase}/photos/${fileId}`, "workerUrl");
      for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        const media = chunk.map((f, idx) => ({
          type: isVideo(f) ? "video" : "photo",
          media: `attach://file_${idx}`,
          ...c === 0 && idx === 0 && caption ? { caption } : {}
        }));
        const mediaForm = new FormData();
        mediaForm.append("chat_id", chatId);
        mediaForm.append("media", JSON.stringify(media));
        chunk.forEach((f, idx) => mediaForm.append(`file_${idx}`, f, f.name));
        const res = await fetch(`${botUrl}/sendMediaGroup`, { method: "POST", body: mediaForm });
        const data = await res.json();
        if (data.ok) {
          for (const msg of data.result || []) {
            const mediaArr = msg.photo;
            const fileId = mediaArr ? mediaArr[mediaArr.length - 1]?.file_id || "" : msg.video?.file_id || "";
            results.push({
              file_id: fileId,
              url: workerUrl(fileId),
              chat_id: String(msg.chat.id),
              message_id: msg.message_id
            });
          }
          continue;
        }
        for (const f of chunk) {
          const single = new FormData();
          single.append("chat_id", chatId);
          single.append(isVideo(f) ? "video" : "photo", f, f.name);
          if (f === chunk[0] && caption) single.append("caption", caption);
          single.append("parse_mode", "HTML");
          const singleRes = await fetch(
            isVideo(f) ? `${botUrl}/sendVideo` : `${botUrl}/sendPhoto`,
            { method: "POST", body: single }
          );
          const singleData = await singleRes.json();
          if (!singleData.ok) continue;
          const msg = singleData.result;
          const mediaArr = msg.photo || msg.video;
          const fileId = mediaArr?.[mediaArr.length - 1]?.file_id || "";
          results.push({
            file_id: fileId,
            url: workerUrl(fileId),
            chat_id: String(msg.chat.id),
            message_id: msg.message_id
          });
        }
      }
    }
    return new Response(JSON.stringify({
      success: true,
      urls: results.map((r) => r.url),
      file_ids: results.map((r) => r.file_id),
      messages: results.map((r) => ({ chat_id: r.chat_id, message_id: r.message_id })),
      count: results.length,
      storage: "cloudflare-worker"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Upload failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleUpload, "handleUpload");
var DEFAULT_CHANNELS = {
  attendance: "@jbr_absensi",
  service: "@jbr_praService",
  layanan: "@jbr_transaksi",
  inventory: "@jbr_inventory",
  kaspin: "@arlogic_storage",
  teknisi_update: "@jbr_update_teknisi",
  qc_update: "@jbr_qc_update",
  closing: "@arlogic_storage",
  customer: "@db_customer"
};
async function handlePhotoProxy(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/photos\/(.+)$/);
  if (!match) return new Response("Not Found", { status: 404 });
  const fileId = match[1];
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("Missing token", { status: 500 });
  const cache = caches.default;
  const cacheKey = `https://photos.cache/${fileId}`;
  const hasRange = request.headers.has("Range");
  if (!hasRange) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }
  const getFile = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId })
  });
  const fileData = await getFile.json();
  if (!fileData.ok || !fileData.result?.file_path) {
    return new Response("Not found", { status: 404 });
  }
  const fileRes = await fetch(`${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`);
  if (!fileRes.ok) return new Response("Failed to fetch", { status: 502 });
  const buffer = await fileRes.arrayBuffer();
  const filePath = (fileData.result.file_path || "").toLowerCase();
  const mimeFromExt = /\.mp4$/i.test(filePath) ? "video/mp4" : /\.(mov|qt)$/i.test(filePath) ? "video/quicktime" : /\.webm$/i.test(filePath) ? "video/webm" : /\.(3gp|3gpp)$/i.test(filePath) ? "video/3gpp" : /\.png$/i.test(filePath) ? "image/png" : /\.webp$/i.test(filePath) ? "image/webp" : /\.heic$/i.test(filePath) ? "image/heic" : /\.gif$/i.test(filePath) ? "image/gif" : "";
  const contentType = mimeFromExt || fileRes.headers.get("content-type") || "image/jpeg";
  const total = buffer.byteLength;
  const baseHeaders = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": `public, max-age=${CACHE_TTL}`,
    "Access-Control-Allow-Origin": "*"
  };
  if (hasRange) {
    const rangeHeader = request.headers.get("Range") || "";
    const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      let start = m[1] === "" ? 0 : parseInt(m[1], 10);
      let end = m[2] === "" ? total - 1 : parseInt(m[2], 10);
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, "Content-Range": `bytes */${total}` }
        });
      }
      const slice = buffer.slice(start, end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(slice.byteLength)
        }
      });
    }
  }
  const response = new Response(buffer, {
    headers: {
      ...baseHeaders,
      "Content-Length": String(total)
    }
  });
  try {
    await cache.put(cacheKey, response.clone());
  } catch {
  }
  return response;
}
__name(handlePhotoProxy, "handlePhotoProxy");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (request.method === "POST" && (url.pathname === "/upload" || url.pathname === "/upload/")) {
      return handleUpload(request, env);
    }
    if (request.method === "GET" && url.pathname.startsWith("/photos/")) {
      return handlePhotoProxy(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
};

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-fdi9wR/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-fdi9wR/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
