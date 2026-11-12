"use client";

import { useEffect } from "react";

/**
 * On the sign-in and registration pages: tells the service worker to drop
 * the pages it saved (public/sw.js), which show the library of whoever was
 * signed in. Reaching these pages means nobody is, after signing out or a
 * session running out.
 */
export function ForgetSavedPages() {
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "forget" });
  }, []);
  return null;
}
