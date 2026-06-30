export type RouteStopInput = {
  id: string;
  address: string | null | undefined;
  label?: string | null;
  plannedTime?: string | null;
  deliveryDate?: string | Date | null;
};

export type GeoPoint = {
  lat: number;
  lng: number;
  formattedAddress?: string;
};

function cleanAddress(address: string | null | undefined) {
  return String(address || "").trim();
}

export function googleMapsSearchUrl(address: string | null | undefined) {
  const clean = cleanAddress(address);

  if (!clean) return "#";

  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(clean);
}

export function googleMapsRouteUrl(stops: RouteStopInput[]) {
  const addresses = stops
    .map((stop) => cleanAddress(stop.address))
    .filter(Boolean);

  if (addresses.length === 0) return "#";

  if (addresses.length === 1) {
    return googleMapsSearchUrl(addresses[0]);
  }

  const destination = addresses[addresses.length - 1];
  const waypoints = addresses.slice(0, -1);

  return (
    "https://www.google.com/maps/dir/?api=1" +
    "&destination=" + encodeURIComponent(destination) +
    "&waypoints=" + encodeURIComponent(waypoints.join("|"))
  );
}

export function cleanPhoneNumber(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

export function phoneUrl(value: string | null | undefined) {
  const phone = cleanPhoneNumber(value);
  return phone ? `tel:${phone}` : "#";
}

export function whatsappUrl(value: string | null | undefined, text: string) {
  const phone = cleanPhoneNumber(value).replace("+", "");

  if (!phone) return "#";

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function sortStopsByTime(stops: RouteStopInput[]) {
  return [...stops].sort((a, b) => {
    const timeA = String(a.plannedTime || "99:99");
    const timeB = String(b.plannedTime || "99:99");

    return timeA.localeCompare(timeB);
  });
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?address=" +
    encodeURIComponent(address) +
    "&key=" +
    encodeURIComponent(apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  const result = data?.results?.[0];

  if (!result?.geometry?.location) {
    return null;
  }

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

function distanceKm(a: GeoPoint, b: GeoPoint) {
  const earthRadiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export async function optimizeStopsBasic(stops: RouteStopInput[]) {
  const withAddress = stops.filter((stop) => cleanAddress(stop.address));

  if (withAddress.length <= 2) {
    return sortStopsByTime(withAddress);
  }

  const geocoded = [];

  for (const stop of withAddress) {
    const geo = await geocodeAddress(String(stop.address));

    geocoded.push({
      stop,
      geo,
    });
  }

  const allHaveGeo = geocoded.every((entry) => entry.geo);

  if (!allHaveGeo) {
    return sortStopsByTime(withAddress);
  }

  const byTime = sortStopsByTime(withAddress);
  const first = byTime[0];

  const startEntry = geocoded.find((entry) => entry.stop.id === first.id);
  const remaining = geocoded.filter((entry) => entry.stop.id !== first.id);

  const optimized = [first];
  let currentGeo = startEntry?.geo;

  while (remaining.length > 0 && currentGeo) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const entry = remaining[i];

      if (!entry.geo) continue;

      const distance = distanceKm(currentGeo, entry.geo);

      const plannedTimePenalty =
        String(entry.stop.plannedTime || "99:99") < String(optimized[optimized.length - 1]?.plannedTime || "00:00")
          ? 9999
          : 0;

      const score = distance + plannedTimePenalty;

      if (score < bestDistance) {
        bestDistance = score;
        bestIndex = i;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    optimized.push(next.stop);
    currentGeo = next.geo;
  }

  return optimized;
}
