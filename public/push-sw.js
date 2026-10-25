/*
 * MyReads' service worker, for reading reminders only (Preferences ›
 * Reading reminders; src/lib/reminders-run.ts sends them). It shows the
 * reminder the server pushes and opens Now reading when it's tapped. It
 * handles no page loads and caches nothing.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // Not one of ours: show the plain reminder rather than nothing, since a
    // push that shows nothing counts against the site in some browsers.
  }
  const url = typeof message.url === "string" && message.url.startsWith("/") ? message.url : "/reading";
  event.waitUntil(
    self.registration.showNotification(message.title || "Time to read", {
      body: message.body || "",
      icon: "/icons/icon-192.png",
      // One at a time: a new reminder replaces one still showing.
      tag: "reading-reminder",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/reading", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) await client.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// The push service moved this browser's subscription: subscribe again with
// the same key and tell the server the new address, so reminders keep
// coming.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const key = old && old.options && old.options.applicationServerKey;
      const fresh =
        event.newSubscription ||
        (key && (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })));
      if (!fresh) return;
      await fetch("/api/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ oldEndpoint: old ? old.endpoint : null, subscription: fresh.toJSON() }),
      });
    })(),
  );
});
