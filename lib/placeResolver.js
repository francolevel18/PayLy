const placeCacheKey = "payly.placeCache";
const cacheTtl = 6 * 60 * 60 * 1000;

export async function resolveNearbyPlace(location) {
  if (!location?.latitude || !location?.longitude) {
    return null;
  }

  const key = getLocationKey(location);
  const cached = loadPlaceCache()[key];
  if (cached && Date.now() - cached.savedAt < cacheTtl) {
    return cached.place;
  }

  try {
    const response = await fetch("/api/places/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude
      })
    });
    const result = await response.json();
    const place = normalizePlace(result.place);
    savePlaceCache(key, place);
    return place;
  } catch {
    return null;
  }
}

function normalizePlace(place) {
  if (!place || typeof place !== "object" || !place.name) {
    return null;
  }

  return {
    id: typeof place.id === "string" ? place.id : "",
    name: String(place.name),
    address: typeof place.address === "string" ? place.address : "",
    primaryType: typeof place.primaryType === "string" ? place.primaryType : "",
    category: typeof place.category === "string" ? place.category : "other",
    latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude) : null,
    longitude: Number.isFinite(Number(place.longitude)) ? Number(place.longitude) : null
  };
}

function getLocationKey(location) {
  return `${roundForCache(location.latitude)},${roundForCache(location.longitude)}`;
}

function roundForCache(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function loadPlaceCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(placeCacheKey)) || {};
  } catch {
    return {};
  }
}

function savePlaceCache(key, place) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const cache = loadPlaceCache();
    cache[key] = { place, savedAt: Date.now() };
    window.localStorage.setItem(placeCacheKey, JSON.stringify(cache));
  } catch {
    // localStorage can fail in private mode or when quota is full.
  }
}
