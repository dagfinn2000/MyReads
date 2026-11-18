"use client";

import { useState, useSyncExternalStore } from "react";
import { LocateFixed, Search } from "lucide-react";
import { useWeatherState } from "@/components/weather-outside";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PLACE_NAME_MAX,
  describeWeather,
  geocodeUrl,
  placeFromPosition,
  placesFromGeocode,
  type WeatherPlace,
  type WeatherSetting,
} from "@/lib/weather";

/**
 * Preferences > Appearance > Weather outside (lib/weather.ts): on or off,
 * and the place the weather is for. The place comes from the device
 * ("Use where I am", which the browser asks the reader about first) or from
 * a town typed in and looked up. Turning it on with no place yet asks the
 * device straight away, since that is what the reader just chose.
 *
 * Where the device is can only be asked on a secure page (https, or this
 * computer); on a plain http address on the home network the button isn't
 * offered and a town has to be typed.
 */

type Patch = { weather?: WeatherSetting; weatherPlace?: WeatherPlace | null };

const canLocate = () =>
  typeof window !== "undefined" && window.isSecureContext && "geolocation" in navigator;
const never = () => () => {};

export function WeatherSettings({
  value,
  place,
  onChange,
}: {
  value: WeatherSetting;
  place: WeatherPlace | null;
  onChange: (patch: Patch) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<WeatherPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const { weather, status } = useWeatherState();
  // Known only in the browser, so the server's render leaves the button out.
  const locatable = useSyncExternalStore(never, canLocate, () => false);

  function locate() {
    if (!canLocate()) return;
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = placeFromPosition(pos.coords.latitude, pos.coords.longitude);
        if (here) onChange({ weatherPlace: here });
      },
      (err) => {
        setLocating(false);
        setNote(
          err.code === err.PERMISSION_DENIED
            ? "Your browser didn’t share where you are. Type a town instead, or allow location for this site."
            : "Couldn’t tell where you are just now. Type a town instead.",
        );
      },
      // A town's weather needs no more than a rough idea, and a recent one.
      { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 20_000 },
    );
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNote(null);
    try {
      const res = await fetch(geocodeUrl(query), { credentials: "omit", referrerPolicy: "no-referrer" });
      const places = res.ok ? placesFromGeocode(await res.json()) : [];
      setFound(places);
      if (!res.ok) setNote("Couldn’t look that up just now. Try again in a moment.");
    } catch {
      setFound(null);
      setNote("Couldn’t reach the weather service to look that up. Try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  const now =
    status === "ok"
      ? `${describeWeather(weather)} there now.`
      : status === "failed"
        ? "Couldn’t reach the weather service just now. It tries again every twenty minutes."
        : "Asking for the weather…";

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
        <div>
          <p className="text-sm font-medium">Weather outside</p>
          <p className="text-xs text-muted-foreground">
            While it’s raining or snowing where you are, it rains or snows on Rain, Snow, Sky, stars, aurora,
            ripples, the scene themes and round the reading room.
          </p>
        </div>
        <Select
          value={value}
          onValueChange={(v) => {
            const on = v === "on";
            onChange({ weather: on ? "on" : "off" });
            if (on && !place) locate();
          }}
        >
          <SelectTrigger className="w-full sm:w-72" aria-label="Weather outside">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="on">Match the weather where I am</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value === "on" && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:ml-[15rem]">
          {place ? (
            <p>
              <span className="font-medium">{place.name}</span>
              {place.name === "Where you are" && (
                <span className="text-muted-foreground">
                  {" "}
                  ({Math.abs(place.lat)}° {place.lat >= 0 ? "N" : "S"}, {Math.abs(place.lon)}° {place.lon >= 0 ? "E" : "W"})
                </span>
              )}
              <span className="block text-xs text-muted-foreground" aria-live="polite">
                {now}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              {locating ? "Asking your browser where you are…" : "Choose where the weather is for."}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {locatable && (
              <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
                <LocateFixed data-slot="icon" />
                Use where I am
              </Button>
            )}
            <form onSubmit={search} className="flex min-w-0 flex-1 items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={PLACE_NAME_MAX}
                placeholder={locatable ? "Or type a town" : "Type a town"}
                aria-label="Town"
                className="h-8 min-w-0 flex-1 sm:max-w-56"
              />
              <Button type="submit" variant="outline" size="sm" disabled={searching || !query.trim()}>
                <Search data-slot="icon" />
                Find
              </Button>
            </form>
          </div>
          {found && (
            <ul className="grid gap-1" aria-label="Towns found">
              {found.length === 0 && <li className="text-muted-foreground">No town by that name.</li>}
              {found.map((p) => (
                <li key={p.name}>
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => {
                      onChange({ weatherPlace: p });
                      setFound(null);
                      setQuery("");
                    }}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {note && <p className="text-xs text-amber-700 dark:text-amber-300">{note}</p>}
          <p className="text-xs text-muted-foreground">
            This browser asks{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Open-Meteo
            </a>{" "}
            for the weather there, rounded to about 10 km, every twenty minutes while MyReads is open. Nothing
            else is sent, and the place is kept with your preferences.
          </p>
        </div>
      )}
    </div>
  );
}
