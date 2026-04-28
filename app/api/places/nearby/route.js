import { NextResponse } from "next/server";

const googlePlaceTypesByCategory = {
  food: ["restaurant", "cafe", "bakery", "meal_takeaway"],
  health: ["pharmacy", "doctor", "dentist", "hospital"],
  home: ["hardware_store", "home_goods_store", "laundry"],
  leisure: ["movie_theater", "bar", "gym", "shopping_mall"],
  market: ["supermarket", "grocery_store", "convenience_store"],
  services: ["car_repair", "hair_care", "accounting"],
  transport: ["gas_station", "parking", "transit_station"]
};

const osmTypesByCategory = {
  food: ["bar", "biergarten", "cafe", "fast_food", "food_court", "ice_cream", "pub", "restaurant"],
  health: ["clinic", "dentist", "doctors", "hospital", "pharmacy"],
  home: ["hardware", "houseware", "laundry", "mobile_phone"],
  leisure: ["cinema", "fitness_centre", "mall", "nightclub", "sports_centre"],
  market: ["bakery", "butcher", "convenience", "greengrocer", "kiosk", "supermarket"],
  services: ["bank", "beauty", "car_repair", "hairdresser", "lawyer"],
  transport: ["fuel", "parking", "taxi"]
};

const categoryByGoogleType = new Map(
  Object.entries(googlePlaceTypesByCategory).flatMap(([category, types]) => types.map((type) => [type, category]))
);
const categoryByOsmType = new Map(
  Object.entries(osmTypesByCategory).flatMap(([category, types]) => types.map((type) => [type, category]))
);
const includedGoogleTypes = [...new Set(Object.values(googlePlaceTypesByCategory).flat())];

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Coordenadas invalidas" }, { status: 400 });
  }

  const osmPlace = await resolveWithOpenStreetMap(latitude, longitude);
  if (osmPlace) {
    return NextResponse.json({ place: osmPlace, provider: "osm" });
  }

  const googlePlace = await resolveWithGoogle(latitude, longitude);
  return NextResponse.json({ place: googlePlace, provider: googlePlace ? "google" : "none" });
}

async function resolveWithOpenStreetMap(latitude, longitude) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("accept-language", "es-AR,es");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": getOsmUserAgent(),
        Referer: "https://payly.local"
      }
    });

    if (!response.ok) {
      return null;
    }

    return normalizeOsmPlace(await response.json());
  } catch {
    return null;
  }
}

async function resolveWithGoogle(latitude, longitude) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.primaryType,places.location"
      },
      body: JSON.stringify({
        includedTypes: includedGoogleTypes,
        maxResultCount: 4,
        rankPreference: "DISTANCE",
        languageCode: "es",
        regionCode: "AR",
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: 80
          }
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return (data.places || []).map(normalizeGooglePlace).find(Boolean) || null;
  } catch {
    return null;
  }
}

function normalizeOsmPlace(place) {
  if (!place || place.error) {
    return null;
  }

  const osmType = place.type || "";
  const address = place.address || {};
  const name =
    place.name ||
    place.namedetails?.name ||
    address.shop ||
    address.amenity ||
    address.road ||
    place.display_name?.split(",")[0];

  if (!name) {
    return null;
  }

  return {
    id: String(place.osm_id || ""),
    name,
    address: place.display_name || "",
    primaryType: osmType,
    category: categoryByOsmType.get(osmType) || "other",
    latitude: Number(place.lat) || null,
    longitude: Number(place.lon) || null
  };
}

function normalizeGooglePlace(place) {
  const name = place.displayName?.text;
  if (!name) {
    return null;
  }

  const primaryType = place.primaryType || "point_of_interest";

  return {
    id: place.id || "",
    name,
    address: place.formattedAddress || "",
    primaryType,
    category: categoryByGoogleType.get(primaryType) || "other",
    latitude: place.location?.latitude || null,
    longitude: place.location?.longitude || null
  };
}

function getOsmUserAgent() {
  const contact = process.env.OSM_CONTACT_EMAIL;
  return contact ? `Payly/0.1 (${contact})` : "Payly/0.1";
}
