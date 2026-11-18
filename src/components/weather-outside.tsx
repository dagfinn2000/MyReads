"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  WEATHER_FRESH_MS,
  WEATHER_STALE_MS,
  codeFromForecast,
  forecastUrl,
  placeKey,
  weatherFromCode,
  type Weather,
  type WeatherPlace,
} from "@/lib/weather";

/**
 * Keeps the weather outside (lib/weather.ts) for the scenes and the reading
 * room, while Preferences > Weather outside is on and a place is set. The
 * root layout renders it then, and only then.
 *
 * The browser asks Open-Meteo for the weather at the place, keeps the
 * answer in this browser's storage so the next page (or a reload) has it at
 * once, and asks again every twenty minutes while the page is in view.
 * Whatever goes wrong (offline, the service down, storage refused) it fails
 * quietly: an answer up to two hours old is still used, and after that
 * nothing falls. It never asks while the tab is hidden.
 *
 * What it knows goes on <html> as `data-weather` ("rain" or "snow") and
 * `data-weather-amount`, for CSS, and to the background scene and the
 * reading room through useWeather.
 */

const STORAGE_KEY = "myreads-weather";

type Saved = { place: string; at: number; code: number };

export type WeatherState = {
  weather: Weather | null;
  /** The newest answer came back, or none has yet ("waiting"), or the
   *  last try failed. */
  status: "waiting" | "ok" | "failed";
};

const WAITING: WeatherState = { weather: null, status: "waiting" };
let state: WeatherState = WAITING;
const listeners = new Set<() => void>();

function set(next: WeatherState) {
  if (next.weather?.kind === state.weather?.kind && next.weather?.amount === state.weather?.amount && next.status === state.status) return;
  state = next;
  const root = document.documentElement;
  if (next.weather) {
    root.dataset.weather = next.weather.kind;
    root.dataset.weatherAmount = next.weather.amount;
  } else {
    delete root.dataset.weather;
    delete root.dataset.weatherAmount;
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The weather outside, or null while it's dry, off or not known. */
export function useWeather(): Weather | null {
  return useSyncExternalStore(subscribe, () => state.weather, () => null);
}

/** The weather and whether the last ask worked, for Preferences. */
export function useWeatherState(): WeatherState {
  return useSyncExternalStore(subscribe, () => state, () => WAITING);
}

function readSaved(): Saved | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (raw && typeof raw.place === "string" && typeof raw.at === "number" && typeof raw.code === "number") return raw;
  } catch {
    // Storage refused or garbled: as if nothing were saved.
  }
  return null;
}

function writeSaved(saved: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Without storage it still works for this page.
  }
}

export function WeatherOutside({ place }: { place: WeatherPlace }) {
  const key = placeKey(place);
  const { lat, lon } = place;

  useEffect(() => {
    let controller: AbortController | null = null;
    let lastAsked = 0;
    let live = true;

    const show = (saved: Saved | null, failed = false) => {
      if (!live) return;
      const usable = saved && saved.place === key && Date.now() - saved.at < WEATHER_STALE_MS;
      set({
        weather: usable ? weatherFromCode(saved.code) : null,
        status: failed ? "failed" : usable ? "ok" : "waiting",
      });
    };

    const ask = async () => {
      if (document.hidden || controller) return;
      const saved = readSaved();
      if (saved?.place === key && Date.now() - saved.at < WEATHER_FRESH_MS) {
        show(saved);
        return;
      }
      if (Date.now() - lastAsked < 60_000) return;
      lastAsked = Date.now();
      controller = new AbortController();
      const stop = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const res = await fetch(forecastUrl({ lat, lon }), {
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        const code = res.ok ? codeFromForecast(await res.json()) : null;
        if (code === null) throw new Error("No weather in the answer");
        const fresh = { place: key, at: Date.now(), code };
        writeSaved(fresh);
        show(fresh);
      } catch {
        // Quietly: what was known a little while ago will do.
        show(readSaved(), true);
      } finally {
        window.clearTimeout(stop);
        controller = null;
      }
    };

    // What this browser already knows shows at once.
    show(readSaved());
    void ask();
    // Checked every few minutes; it only asks once its answer is twenty
    // minutes old.
    const timer = window.setInterval(() => void ask(), 5 * 60_000);
    const onShow = () => {
      if (!document.hidden) void ask();
    };
    document.addEventListener("visibilitychange", onShow);
    // Another tab got a newer answer.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) show(readSaved());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("storage", onStorage);
      live = false;
      controller?.abort();
      // Turned off, or another place: nothing falls until it's known.
      set(WAITING);
    };
  }, [key, lat, lon]);

  return null;
}
