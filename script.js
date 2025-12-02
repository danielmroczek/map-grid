// Constants
const CONFIG = {
  DEFAULT_BBOX: [49.0022, 54.835, 14.122, 24.15],
  MAX_MARKERS: 255,
  MAX_PRECISION: 8,
  MAX_ATTEMPTS: 10,
  MARKER_SCALE: 0.8,
  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

// State
let map;
let markers = [];
let pinSvg;

/**
 * Fetches the user's country bounding box based on IP geolocation
 * @returns {Promise<number[]>} Bounding box array [south, north, west, east]
 */
async function fetchUserCountryBbox() {
  try {
    const geoResponse = await fetch("https://ipapi.co/json/");
    const geoData = await geoResponse.json();
    console.log("Your country based on IP:", geoData.country_name);

    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?country=${geoData.country_code}&format=json`
    );
    const data = await nominatimResponse.json();

    return data?.[0]?.boundingbox ?? CONFIG.DEFAULT_BBOX;
  } catch (error) {
    console.error("Failed to fetch country bbox:", error);
    return CONFIG.DEFAULT_BBOX;
  }
}

/**
 * Calculates optimal grid precision based on current zoom level and visible area
 * @param {L.LatLngBounds} bounds - Current map bounds
 * @param {number} zoom - Current zoom level
 * @returns {{precision: number, step: number}}
 */
function calculateGridPrecision(bounds, zoom) {
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  let precision = Math.min(Math.floor(zoom / 2), CONFIG.MAX_PRECISION);
  let step = Math.pow(10, -precision);

  for (let attempt = 0; attempt < CONFIG.MAX_ATTEMPTS; attempt++) {
    const latSteps = Math.ceil((north - south) / step);
    const lngSteps = Math.ceil((east - west) / step);
    const totalMarkers = latSteps * lngSteps;

    if (totalMarkers <= CONFIG.MAX_MARKERS) {
      break;
    }

    precision = Math.max(0, precision - 1);
    step = Math.pow(10, -precision);
  }

  console.log(`Zoom: ${zoom}, Precision: ${precision}, Step: ${step}`);

  return { precision, step };
}

/**
 * Creates an SVG icon for a marker with embedded coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} precision - Decimal precision
 * @returns {L.DivIcon}
 */
function createMarkerIcon(lat, lng, precision) {
  const svgElement = new DOMParser().parseFromString(
    pinSvg,
    "image/svg+xml"
  ).documentElement;

  const latText = svgElement.querySelector("#lat");
  const lngText = svgElement.querySelector("#lng");

  if (latText) latText.textContent = lat.toFixed(Math.max(0, precision));
  if (lngText) lngText.textContent = lng.toFixed(Math.max(0, precision));

  return L.divIcon({
    html: `<div style="transform: scale(${CONFIG.MARKER_SCALE});">${svgElement.outerHTML}</div>`,
    className: "coordinate-marker",
    iconAnchor: [24 * CONFIG.MARKER_SCALE, 64 * CONFIG.MARKER_SCALE],
    popupAnchor: [0, 0],
  });
}

/**
 * Fetches address information from Nominatim reverse geocoding API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} Display name of the location
 */
async function fetchAddress(lat, lng) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
  );
  const data = await response.json();
  return data.display_name;
}

/**
 * Handles marker click event to load and display address
 * @param {L.Marker} marker - The clicked marker
 * @param {string} baseContent - Base popup content (coordinates)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
async function handleMarkerClick(marker, baseContent, lat, lng) {
  // Close other popups
  markers.forEach((m) => {
    if (m !== marker) {
      m.closePopup();
    }
  });

  const popup = marker.getPopup();

  // Prevent duplicate address fetches
  if (popup.getContent().includes("<br><br>")) return;

  popup.setContent(baseContent + "<br><br>Loading address...");

  try {
    const address = await fetchAddress(lat, lng);
    popup.setContent(baseContent + `<br><br>${address}`);
  } catch (error) {
    console.error("Failed to fetch address:", error);
    popup.setContent(baseContent + "<br><br>Failed to load address");
  }
}

/**
 * Creates a marker at the specified coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} precision - Decimal precision
 */
function createMarker(lat, lng, precision) {
  const icon = createMarkerIcon(lat, lng, precision);
  const marker = L.marker([lat, lng], {
    icon,
    riseOnHover: true,
  }).addTo(map);

  const popupContent = `
    Lat (Y): <strong>${lat.toFixed(Math.max(0, precision))}</strong><br>
    Lng (X): <strong>${lng.toFixed(Math.max(0, precision))}</strong>`;

  marker.bindPopup(popupContent, {
    closeButton: true,
    className: "coordinate-popup",
  });

  marker.on("click", () => handleMarkerClick(marker, popupContent, lat, lng));

  markers.push(marker);
}

/**
 * Updates the marker grid based on current map view
 */
function updateMarkers() {
  // Clear existing markers
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  const bounds = map.getBounds();
  const { precision, step } = calculateGridPrecision(bounds, map.getZoom());

  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  // Calculate grid boundaries aligned to step
  const startLat = Math.ceil(south / step) * step;
  const startLng = Math.ceil(west / step) * step;
  const endLat = Math.floor(north / step) * step;
  const endLng = Math.floor(east / step) * step;

  // Generate grid markers
  for (
    let lat = startLat;
    lat <= endLat;
    lat = +(lat + step).toFixed(precision)
  ) {
    for (
      let lng = startLng;
      lng <= endLng;
      lng = +(lng + step).toFixed(precision)
    ) {
      createMarker(lat, lng, precision);
    }
  }

  console.log(`Created ${markers.length} markers`);
}

/**
 * Initializes the map and loads initial data
 */
async function initializeMap() {
  // Load pin SVG
  pinSvg = await fetch("./pin.svg").then((response) => response.text());

  // Fetch user's country bounding box
  const bbox = await fetchUserCountryBbox();
  const [south, north, west, east] = bbox.map(parseFloat);

  // Initialize map
  map = L.map("map").fitBounds([
    [south, west],
    [north, east],
  ]);

  // Add tile layer
  L.tileLayer(CONFIG.TILE_URL, {
    attribution: CONFIG.TILE_ATTRIBUTION,
  }).addTo(map);

  // Setup event listeners
  map.on("moveend", updateMarkers);
  map.on("zoomend", updateMarkers);

  // Initial marker draw
  updateMarkers();
}

// Start the application
initializeMap();
