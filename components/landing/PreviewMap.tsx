"use client";

import { useEffect, useSyncExternalStore } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { mapTiles } from "@/lib/maps/style";
import { useTheme } from "@/hooks/useTheme";

const THIRU = { latitude: 12.9716, longitude: 77.5946, avatar: "/avatars/01.jpg" };

function thiruIcon() {
  return L.divIcon({
    className: "nm-pin",
    iconSize: [48, 72],
    iconAnchor: [24, 18],
    html: `<div class="nm-marker"><img class="nm-avatar" src="${THIRU.avatar}" alt="" /><span class="nm-label">Thiru</span></div>`,
  });
}

function FrameGroup() {
  const map = useMap();
  useEffect(() => {
    const place = () => {
      const bounds = L.latLngBounds([[THIRU.latitude, THIRU.longitude]]);
      const height = map.getSize().y;
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 36],
        paddingBottomRight: [40, Math.round(height * 0.46)],
        maxZoom: 13,
        animate: false,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export function PreviewMap() {
  const theme = useTheme();
  const tiles = mapTiles(theme);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <div className="nm-map nm-preview pointer-events-none relative h-full w-full overflow-hidden bg-[#e6e4df]">
      {ready ? (
        <MapContainer
          center={[12.9716, 77.5946]}
          zoom={13}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          touchZoom={false}
          attributionControl={false}
          className="z-0 h-full w-full"
        >
          <TileLayer key={tiles.url} attribution={tiles.attribution} url={tiles.url} maxZoom={tiles.maxZoom} />
          <FrameGroup />
          <Marker position={[THIRU.latitude, THIRU.longitude]} icon={thiruIcon()} />
        </MapContainer>
      ) : null}
    </div>
  );
}
