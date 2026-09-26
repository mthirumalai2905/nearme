"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type LocationErrorKind = "denied" | "unavailable" | "timeout" | "unsupported" | null;

export function useLocation(enabled: boolean) {
  const [position, setPosition] = useState<LocationFix | null>(null);
  const [error, setError] = useState<LocationErrorKind>(null);
  const [attempt, setAttempt] = useState(0);
  const watchId = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (next) => {
        setPosition({
          latitude: next.coords.latitude,
          longitude: next.coords.longitude,
          accuracy: Number.isFinite(next.coords.accuracy) ? next.coords.accuracy : null,
          timestamp: next.timestamp,
        });
        setError(null);
      },
      (failure) => {
        if (failure.code === failure.PERMISSION_DENIED) setError("denied");
        else if (failure.code === failure.TIMEOUT) setError("timeout");
        else setError("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    watchId.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      if (watchId.current === id) watchId.current = null;
    };
  }, [attempt, enabled]);

  const unsupported = enabled && typeof navigator !== "undefined" && !navigator.geolocation;
  const resolvedError = unsupported ? "unsupported" : error;
  const loading = enabled && !position && !resolvedError;

  return {
    position,
    loading,
    error: resolvedError,
    sharing: enabled && !resolvedError,
    retry: () => {
      setError(null);
      setAttempt((value) => value + 1);
    },
    stop: clearWatch,
  };
}
