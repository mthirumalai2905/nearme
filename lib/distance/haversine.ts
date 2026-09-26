const EARTH_RADIUS_M = 6_371_000;

export function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(latitude2 - latitude1);
  const dLng = toRad(longitude2 - longitude1);
  const lat1 = toRad(latitude1);
  const lat2 = toRad(latitude2);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function geographicCenter(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    const latitude = (point.latitude * Math.PI) / 180;
    const longitude = (point.longitude * Math.PI) / 180;
    x += Math.cos(latitude) * Math.cos(longitude);
    y += Math.cos(latitude) * Math.sin(longitude);
    z += Math.sin(latitude);
  }
  const total = points.length;
  x /= total;
  y /= total;
  z /= total;
  return {
    latitude: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI,
    longitude: (Math.atan2(y, x) * 180) / Math.PI,
  };
}

export function maxPairwiseDistance(points: Array<{ latitude: number; longitude: number }>) {
  let max = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      max = Math.max(
        max,
        calculateDistance(
          points[i].latitude,
          points[i].longitude,
          points[j].latitude,
          points[j].longitude,
        ),
      );
    }
  }
  return max;
}
