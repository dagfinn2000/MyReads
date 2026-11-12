/*
 * The reading reminders' service worker before MyReads worked offline.
 * Browsers that turned reminders on then still have it; now it's the
 * whole of sw.js, and the app moves them over to sw.js on their next
 * visit (components/offline-provider.tsx).
 */
importScripts("/sw.js");
