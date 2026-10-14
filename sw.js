// Офлайн-режим расписания.
// Страница: сначала сеть, причём всегда свежая (чтобы обновления приходили сразу), без сети или при медленной сети — сохранённая копия.
// Иконки и шрифты: из сохранённой копии, в фоне обновляются.
const CACHE = "raspisanie-v7";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        // no-cache: всегда спросить у сервера, не изменилась ли страница (иначе браузер до 10 минут берёт старую копию)
        const res = await withTimeout(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }), 3500);
        if (res.ok) cache.put("./index.html", res.clone());
        return res;
      } catch (err) {
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});
