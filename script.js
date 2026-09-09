import { Map, Popup, setWorkerUrl } from "https://unpkg.com/maplibre-gl@^6.8.0/dist/maplibre-gl.mjs";

// MapLibre GL JS v6 ships as an ES module and loads its WebWorker as a separate
// module. With no bundler, point it at the official CDN copy so tiles parse on a
// worker thread instead of blocking the main thread.
setWorkerUrl("https://unpkg.com/maplibre-gl@^6.8.0/dist/maplibre-gl-worker.mjs");

// Constants
const CONFIG = {
  DEFAULT_BBOX: [49.0022, 54.835, 14.122, 24.15],
  MAX_MARKERS: 255,
  MAX_PRECISION: 8,
  MAX_ATTEMPTS: 10,
  MARKER_SCALE: 0.8,
  // OpenFreeMap Liberty — free, keyless vector-tile basemap style (includes
  // vector tiles, glyphs and sprites). Rendering is fully WebGL-accelerated.
  STYLE_URL: "https://tiles.openfreemap.org/styles/liberty",
  SOURCE_ID: "grid-points",
  PIN_ICON_LAYER: "pin-icon",
  PIN_TEXT_LAYER: "pin-text",
};

// State
let map;
let currentPrecision = -1;
let activePopup = null;

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
 * @param {import('maplibre-gl').LngLatBounds} bounds - Current map bounds
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

    // Allow precision to go negative so the step grows to 10, 100, ... degrees.
    // This keeps the marker count in check when zoomed far out: at step 10 the
    // grid only lands on "tens" (e.g. 50, 60, 180, 270).
    precision -= 1;
    step = Math.pow(10, -precision);
  }

  console.log(`Zoom: ${zoom}, Precision: ${precision}, Step: ${step}`);

  return { precision, step };
}

/**
 * Generates GeoJSON features for all grid points within the visible bounds
 * @param {import('maplibre-gl').LngLatBounds} bounds - Current map bounds
 * @param {number} precision - Decimal precision for coordinates
 * @param {number} step - Grid step size
 * @returns {Array<GeoJSON.Feature>} Array of Point features
 */
function generateGridFeatures(bounds, precision, step) {
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  // Precision may be negative at far zoom-outs (marks a coarse grid like";tens"), but coordinates still display at whole degrees.
  const displayPrecision = Math.max(0, precision);

  const startLat = Math.ceil(south / step) * step;
  const startLng = Math.ceil(west / step) * step;
  const endLat = Math.floor(north / step) * step;
  const endLng = Math.floor(east / step) * step;

  const features = [];

  for (
    let lat = startLat;
    lat <= endLat;
    lat = +(lat + step).toFixed(displayPrecision)
  ) {
    for (
      let lng = startLng;
      lng <= endLng;
      lng = +(lng + step).toFixed(displayPrecision)
    ) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON convention: [lng, lat]
        },
        properties: {
          lat: lat.toFixed(displayPrecision),
          lng: lng.toFixed(displayPrecision),
        },
      });
    }
  }

  return features;
}

/**
 * Updates the grid marker data source with features for the current viewport.
 * All rendering is handled by WebGL through MapLibre's style layers.
 */
function updateMarkers() {
  if (!map || !map.getSource(CONFIG.SOURCE_ID)) return;

  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const { precision, step } = calculateGridPrecision(bounds, zoom);

  currentPrecision = precision;
  const features = generateGridFeatures(bounds, precision, step);

  map.getSource(CONFIG.SOURCE_ID).setData({
    type: "FeatureCollection",
    features,
  });

  console.log(`Grid updated: ${features.length} markers, precision: ${precision}`);
}

/**
 * Creates a HiDPI canvas with the pin icon drawn on it
 * @returns {HTMLCanvasElement} Canvas with pin graphic (2x resolution for Retina)
 */
function createPinCanvas() {
  const w = 48;
  const h = 64;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // Pin triangle (pointing down)
  ctx.fillStyle = "#c73030";
  ctx.beginPath();
  ctx.moveTo(6, 40);
  ctx.lineTo(42, 40);
  ctx.lineTo(24, 64);
  ctx.closePath();
  ctx.fill();

  // Pin circle fill
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(24, 24, 22.737, 0, Math.PI * 2);
  ctx.fill();

  // Pin circle stroke
  ctx.strokeStyle = "#c73030";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  return canvas;
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
 * Sets up map interaction handlers: hover cursor and click popups
 */
function setupInteraction() {
  // Hover cursor
  map.on("mouseenter", CONFIG.PIN_ICON_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", CONFIG.PIN_ICON_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });

  // Click popup
  map.on("click", CONFIG.PIN_ICON_LAYER, (e) => {
    if (e.features.length === 0) return;

    // Remove existing popup
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }

    const { lat, lng } = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const p = currentPrecision;

    const popupHTML = `
      Lat (Y): <strong>${parseFloat(lat).toFixed(Math.max(0, p))}</strong><br>
      Lng (X): <strong>${parseFloat(lng).toFixed(Math.max(0, p))}</strong>
      <br><br>Loading address...`;

    activePopup = new Popup({
      closeButton: true,
      className: "coordinate-popup",
      anchor: "bottom",
      offset: 30,
    })
      .setLngLat(coords)
      .setHTML(popupHTML)
      .addTo(map);

    fetchAddress(parseFloat(lat), parseFloat(lng))
      .then((address) => {
        if (activePopup) {
          activePopup.setHTML(`
            Lat (Y): <strong>${parseFloat(lat).toFixed(Math.max(0, p))}</strong><br>
            Lng (X): <strong>${parseFloat(lng).toFixed(Math.max(0, p))}</strong>
            <br><br>${address}`);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch address:", error);
        if (activePopup) {
          activePopup.setHTML(`
            Lat (Y): <strong>${parseFloat(lat).toFixed(Math.max(0, p))}</strong><br>
            Lng (X): <strong>${parseFloat(lng).toFixed(Math.max(0, p))}</strong>
            <br><br>Failed to load address`);
        }
      });
  });

  // Close popup when clicking on empty map area
  map.on("click", (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: [CONFIG.PIN_ICON_LAYER],
    });
    if (features.length === 0 && activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  });
}

/**
 * Initializes the MapLibre GL map with WebGL-accelerated tile rendering and marker layers
 */
async function initializeMap() {
  // Fetch user's country bounding box
  const bbox = await fetchUserCountryBbox();
  const [south, north, west, east] = bbox.map(parseFloat);
  const centerLng = (west + east) / 2;
  const centerLat = (south + north) / 2;

  // Create MapLibre GL map using OpenFreeMap Liberty vector-tile style (WebGL)
  map = new Map({
    container: "map",
    style: CONFIG.STYLE_URL,
    center: [centerLng, centerLat],
    zoom: 6,
    maxZoom: 19,
  });

  map.on("load", () => {
    // Add our grid points as a GeoJSON source on top of the vector basemap
    map.addSource(CONFIG.SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    // Add pin icon image to the style (HiDPI, rendered once for all markers).
    // MapLibre v6's addImage() accepts ImageData/ImageBitmap/HTMLImageElement - not a raw
    // canvas - so extract the pixels into ImageData first.
    const pinCanvas = createPinCanvas();
    const imageData = pinCanvas
      .getContext("2d")
      .getImageData(0, 0, pinCanvas.width, pinCanvas.height);
    map.addImage("pin", imageData, { pixelRatio: 2, sdf: false });

    // Add pin icon layer — GPU-rendered symbol layer
    map.addLayer({
      id: CONFIG.PIN_ICON_LAYER,
      type: "symbol",
      source: CONFIG.SOURCE_ID,
      layout: {
        "icon-image": "pin",
        "icon-size": CONFIG.MARKER_SCALE,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-optional": false,
      },
    });

    // Add pin text layer — GPU-rendered text on top of icons
    map.addLayer({
      id: CONFIG.PIN_TEXT_LAYER,
      type: "symbol",
      source: CONFIG.SOURCE_ID,
      layout: {
        "text-field": [
          "format",
          ["get", "lat"],
          { "font-scale": 0.8 },
          "\n",
          {},
          ["get", "lng"],
          { "font-scale": 0.8 },
        ],
        "text-font": ["Noto Sans Bold"],
        "text-size": 11,
        "text-max-width": 8,
        "text-allow-overlap": true,
        "text-anchor": "center",
        "text-offset": [0, -3],
      },
      paint: {
        "text-color": "#ffffff",
      },
    });

    // Setup click/hover interactions
    setupInteraction();

    // Debounced move/zoom handlers to avoid excessive updates during continuous panning
    let moveTimeout;
    const onMoveEnd = () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(updateMarkers, 50);
    };
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    // Fit to country bounds and draw initial markers
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 20, animate: false }
    );

    updateMarkers();
  });
}

// Start the application
initializeMap();
