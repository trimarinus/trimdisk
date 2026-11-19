/* Service Worker für die Trimmscheibe: Offline-Betrieb.
   - Beim ersten Öffnen (mit Internet) werden alle Dateien gespeichert.
   - Danach startet die App sofort aus dem Speicher, auch ohne Internet.
   - Ist Internet da, holt sie sich im Hintergrund die neueste Fassung (gilt beim nächsten Start).
   Nur wenn Dateien umbenannt/hinzugefügt werden: VERSION ändern, damit alte Speicher gelöscht werden. */
var VERSION = "trimdisk-2026-11-19-offline";
var MUST = ["./index.html"];  /* ohne diese Datei wird der Worker nicht installiert */
var NICE = ["./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

function store(cache, url) {
  return fetch(new Request(url, { cache: "reload" })).then(function (r) {
    if (!r || !r.ok) throw new Error("Fehler " + url);
    return cache.put(url, r);
  });
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(MUST.map(function (u) { return store(c, u); }))
      .then(function () { return Promise.all(NICE.map(function (u) { return store(c, u).catch(function () {}); })); });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Aus dem Speicher antworten, im Hintergrund aktualisieren */
function fromCache(key, request) {
  return caches.open(VERSION).then(function (c) {
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(request, { cache: "no-cache" }).then(function (r) {
        if (r && r.ok) c.put(key, r.clone());
        return r;
      }).catch(function () { return null; });
      if (hit) { return hit; }
      return net.then(function (r) { return r || Response.error(); });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    /* Jede Seitenöffnung (auch mit ?utm=… oder ohne index.html) liefert die gespeicherte App */
    e.respondWith(fromCache("./index.html", new Request("./index.html")));
    return;
  }
  e.respondWith(fromCache(req, req));
});
