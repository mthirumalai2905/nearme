"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MeetPath } from "@/lib/meeting/plan";
import { mapTiles } from "@/lib/maps/style";
import { cn } from "@/lib/utils/cn";

export type MapPerson = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  avatar: string;
  isSelf: boolean;
  paused: boolean;
};

export type MapPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type LiveMapHandle = {
  fitEveryone: () => void;
  focusSelf: () => void;
  focus: (id: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type MarkerState = {
  marker: L.Marker;
  element: HTMLButtonElement;
  frame: number;
  longitude: number;
  latitude: number;
};

const STREET_ZOOM = 18;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function viewPadding(sheetHeight: number) {
  const wide = window.innerWidth >= 768;
  return {
    padLeft: wide ? 380 : 28,
    padRight: 72,
    padTop: 96,
    padBottom: wide ? 36 : Math.max(sheetHeight, 180),
  };
}

function moveMarker(state: MarkerState, longitude: number, latitude: number) {
  window.cancelAnimationFrame(state.frame);
  const fromLng = state.longitude;
  const fromLat = state.latitude;
  const distance = Math.hypot(longitude - fromLng, latitude - fromLat);
  if (prefersReducedMotion() || distance < 0.00001) {
    state.longitude = longitude;
    state.latitude = latitude;
    state.marker.setLatLng([latitude, longitude]);
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / 700);
    const eased = progress * progress * (3 - 2 * progress);
    const lng = fromLng + (longitude - fromLng) * eased;
    const lat = fromLat + (latitude - fromLat) * eased;
    state.longitude = lng;
    state.latitude = lat;
    state.marker.setLatLng([lat, lng]);
    if (progress < 1) state.frame = window.requestAnimationFrame(step);
  };
  state.frame = window.requestAnimationFrame(step);
}

function pinIcon(element: HTMLElement) {
  return L.divIcon({
    className: "nm-pin",
    html: element,
    iconSize: [48, 72],
    iconAnchor: [24, 18],
  });
}

export function LiveMap({
  people,
  selectedId,
  place,
  routes,
  theme,
  sheetHeight,
  mapRef,
  onSelect,
}: {
  people: MapPerson[];
  selectedId: string | null;
  place: MapPlace | null;
  routes: MeetPath[];
  theme: "light" | "dark";
  sheetHeight: number;
  mapRef: RefObject<LiveMapHandle | null>;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markers = useRef(new globalThis.Map<string, MarkerState>());
  const placeMarker = useRef<L.Marker | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const peopleRef = useRef(people);
  const placeRef = useRef(place);
  const sheetRef = useRef(sheetHeight);
  const fitted = useRef("");
  const tileUrl = useRef("");
  const tileLayer = useRef<L.TileLayer | null>(null);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    peopleRef.current = people;
    placeRef.current = place;
    sheetRef.current = sheetHeight;
    onSelectRef.current = onSelect;
  });

  function fit(points: Array<{ longitude: number; latitude: number }>) {
    const map = mapInstance.current;
    if (!map || points.length === 0 || map.getSize().y < 80) return;
    const { padLeft, padRight, padTop, padBottom } = viewPadding(sheetRef.current);
    if (points.length === 1) {
      const zoom = STREET_ZOOM;
      const offset = L.point((padLeft - padRight) / 2, (padTop - padBottom) / 2);
      const projected = map.project([points[0].latitude, points[0].longitude], zoom);
      map.setView(map.unproject(projected.subtract(offset), zoom), zoom, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((point) => L.latLng(point.latitude, point.longitude)));
    map.fitBounds(bounds, {
      paddingTopLeft: L.point(padLeft, padTop),
      paddingBottomRight: L.point(padRight, padBottom),
      maxZoom: STREET_ZOOM,
      animate: true,
    });
  }

  function sync() {
    const map = mapInstance.current;
    if (!map || !ready.current) return;
    const seen = new Set<string>();
    for (const person of peopleRef.current) {
      seen.add(person.id);
      let state = markers.current.get(person.id);
      if (!state) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "nm-marker";
        L.DomEvent.disableClickPropagation(element);
        element.addEventListener("click", () => onSelectRef.current(person.id));
        const marker = L.marker([person.latitude, person.longitude], {
          icon: pinIcon(element),
          keyboard: false,
          zIndexOffset: person.isSelf ? 1000 : 0,
        }).addTo(map);
        state = { marker, element, frame: 0, longitude: person.longitude, latitude: person.latitude };
        markers.current.set(person.id, state);
      }
      elementContent(state.element, person, person.id === selectedId);
      moveMarker(state, person.longitude, person.latitude);
    }
    for (const [id, state] of markers.current) {
      if (seen.has(id)) continue;
      window.cancelAnimationFrame(state.frame);
      state.marker.remove();
      markers.current.delete(id);
    }

    const ids = peopleRef.current
      .map((person) => person.id)
      .sort()
      .join("|");
    const frameKey = `${ids}:${sheetRef.current > 240 ? "tall" : "short"}`;
    if (ids && frameKey !== fitted.current) {
      fitted.current = frameKey;
      fit(peopleRef.current);
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 2,
      maxZoom: 19,
    });
    map.setView([20, 0], 2);
    mapInstance.current = map;
    ready.current = true;
    window.requestAnimationFrame(() => map.invalidateSize());
    let sized = false;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!sized && map.getSize().y > 80) {
        sized = true;
        fitted.current = "";
        sync();
      }
    });
    observer.observe(container);
    const markerMap = markers.current;
    sync();
    return () => {
      observer.disconnect();
      markerMap.forEach((state) => {
        window.cancelAnimationFrame(state.frame);
        state.marker.remove();
      });
      markerMap.clear();
      placeMarker.current?.remove();
      placeMarker.current = null;
      routeLayer.current?.remove();
      routeLayer.current = null;
      map.remove();
      mapInstance.current = null;
      tileLayer.current = null;
      tileUrl.current = "";
      ready.current = false;
      fitted.current = "";
    };
    // The map is created once. Tiles, markers, and the camera update in later effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const tiles = mapTiles(theme);
    if (tileLayer.current && tileUrl.current === tiles.url) return;
    const previous = tileLayer.current;
    tileUrl.current = tiles.url;
    let loaded = 0;
    const layer = L.tileLayer(tiles.url, {
      attribution: tiles.attribution,
      subdomains: tiles.subdomains,
      maxZoom: tiles.maxZoom,
    });
    layer.on("tileload", () => {
      loaded += 1;
      if (loaded === 1) setFailed(false);
    });
    layer.on("tileerror", () => {
      if (loaded === 0) setFailed(true);
    });
    layer.addTo(map);
    tileLayer.current = layer;
    previous?.remove();
  }, [theme]);

  useEffect(() => {
    sync();
    // Marker sync reads the latest people through refs after the map is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, selectedId, theme, sheetHeight > 240]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !ready.current) return;
    placeMarker.current?.remove();
    placeMarker.current = null;
    if (!place) {
      routeLayer.current?.remove();
      routeLayer.current = null;
      return;
    }
    const element = document.createElement("div");
    element.className = "nm-place";
    const dot = document.createElement("span");
    dot.className = "nm-place-dot";
    dot.textContent = "•";
    const label = document.createElement("span");
    label.className = "nm-label";
    label.textContent = place.name;
    element.append(dot, label);
    placeMarker.current = L.marker([place.latitude, place.longitude], {
      icon: pinIcon(element),
      interactive: false,
      keyboard: false,
    }).addTo(map);
    routeLayer.current?.remove();
    const layer = L.layerGroup().addTo(map);
    routeLayer.current = layer;
    const samples: Array<{ latitude: number; longitude: number }> = [];
    for (const path of routes) {
      if (path.line.length < 2) continue;
      L.polyline(
        path.line.map(([latitude, longitude]) => [latitude, longitude] as [number, number]),
        { color: "#0071e3", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" },
      ).addTo(layer);
      for (let index = 0; index < path.line.length; index += 8) {
        samples.push({ latitude: path.line[index][0], longitude: path.line[index][1] });
      }
    }
    fit([...peopleRef.current, place, ...samples]);
  }, [place, routes]);

  useEffect(() => {
    mapRef.current = {
      fitEveryone: () => fit([...(placeRef.current ? [placeRef.current] : []), ...peopleRef.current]),
      focusSelf: () => {
        const self = peopleRef.current.find((person) => person.isSelf);
        if (self) fit([self]);
      },
      focus: (id: string) => {
        const person = peopleRef.current.find((item) => item.id === id);
        if (person) fit([person]);
      },
      zoomIn: () => mapInstance.current?.zoomIn(1),
      zoomOut: () => mapInstance.current?.zoomOut(1),
    };
  });

  return (
    <div className="absolute inset-0 z-0">
      <div
        className="h-full w-full"
        ref={containerRef}
        role="application"
        aria-label="Live map of everyone in this session"
      />
      {failed ? (
        <p className="absolute inset-x-5 top-24 z-10 text-[15px] text-muted">
          The map couldn’t load. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}

function elementContent(element: HTMLButtonElement, person: MapPerson, selected: boolean) {
  element.className = cn("nm-marker", person.isSelf && "is-self", selected && "is-selected", person.paused && "is-paused");
  element.setAttribute("aria-label", person.isSelf ? `${person.name}, you` : person.name);
  element.replaceChildren();
  const avatarWrap = document.createElement("span");
  avatarWrap.className = "relative grid h-9 w-9 place-items-center";
  if (person.isSelf) {
    const pulse = document.createElement("span");
    pulse.className = "nm-pulse";
    avatarWrap.append(pulse);
  }
  const avatar = document.createElement("img");
  avatar.className = "nm-avatar";
  avatar.src = person.avatar;
  avatar.alt = "";
  avatarWrap.append(avatar);
  const label = document.createElement("span");
  label.className = "nm-label";
  label.textContent = person.name;
  element.append(avatarWrap, label);
}
