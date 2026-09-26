"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type LocationErrorKind = "denied" | "unavailable" | "timeout" | "unsupported" | null;

const quickOptions: PositionOptions = { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 };
const watchOptions: PositionOptions = { enableHighAccuracy: false, maximumAge: 15_000, timeout: 30_000 };
const preciseOptions: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };

export function useLocation(enabled: boolean) {
  const [position, setPosition] = useState<LocationFix | null>(null);
  const [error, setError] = useState<LocationErrorKind>(null);
  const [attempt, setAttempt] = useState(0);
  const watchId = useRef<number | null>(null);
  const hasFix = useRef(false);

  const apply = useCallback((next: GeolocationPosition) => {
    hasFix.current = true;
    setPosition({
      latitude: next.coords.latitude,
      longitude: next.coords.longitude,
      accuracy: Number.isFinite(next.coords.accuracy) ? next.coords.accuracy : null,
      timestamp: next.timestamp,
    });
    setError(null);
  }, []);

  const fail = useCallback((failure: GeolocationPositionError) => {
    if (hasFix.current) return;
    if (failure.code === failure.PERMISSION_DENIED) setError("denied");
    else if (failure.code === failure.TIMEOUT) setError("timeout");
    else setError("unavailable");
  }, []);

  const clearWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
  }, []);

  const prime = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(apply, () => undefined, quickOptions);
  }, [apply]);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;
    const geo = navigator.geolocation;
    let stopped = false;
    const accept = (next: GeolocationPosition) => {
      if (!stopped) apply(next);
    };

    geo.getCurrentPosition(accept, () => undefined, quickOptions);
    geo.getCurrentPosition(accept, () => undefined, preciseOptions);
    const id = geo.watchPosition(
      accept,
      (failure) => {
        if (stopped || failure.code === failure.PERMISSION_DENIED) {
          if (!stopped && failure.code === failure.PERMISSION_DENIED) setError("denied");
          return;
        }
        if (hasFix.current) return;
        geo.getCurrentPosition(accept, (again) => {
          if (!stopped) fail(again);
        }, quickOptions);
      },
      watchOptions,
    );
    watchId.current = id;

    return () => {
      stopped = true;
      geo.clearWatch(id);
      if (watchId.current === id) watchId.current = null;
    };
  }, [apply, attempt, enabled, fail]);

  const unsupported = enabled && typeof navigator !== "undefined" && !navigator.geolocation;
  const resolvedError = unsupported ? "unsupported" : error;
  const loading = enabled && !position && !resolvedError;

  return {
    position,
    loading,
    error: resolvedError,
    sharing: enabled && !resolvedError,
    prime,
    retry: () => {
      hasFix.current = false;
      setError(null);
      setAttempt((value) => value + 1);
    },
    stop: clearWatch,
  };
}
