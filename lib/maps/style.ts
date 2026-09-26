export function mapTiles(theme: "light" | "dark") {
  const custom =
    theme === "dark" ? process.env.NEXT_PUBLIC_MAP_TILE_DARK : process.env.NEXT_PUBLIC_MAP_TILE_LIGHT;
  if (custom) {
    return {
      url: custom,
      subdomains: "abc",
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }

  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}
