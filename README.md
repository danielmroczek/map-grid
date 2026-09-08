# Map Grid

> Explore where parallels and meridians intersect

A high-performance web application that displays an adaptive coordinate grid on an interactive map. Powered by MapLibre GL JS with WebGL rendering, markers are GPU-accelerated for smooth panning and zooming even with hundreds of points. Click on any pin to see its exact coordinates and the corresponding address retrieved via reverse geocoding.

## Features

- **WebGL-Accelerated Rendering**: All markers rendered via GPU using MapLibre's symbol layers — no DOM-heavy marker objects
- **HiDPI Pin Icons**: Pin icon rendered at 2x resolution for crisp display on Retina screens
- **Responsive Design**: Full viewport map that works on any screen size

## Getting Started

### Prerequisites


### Running Locally

Since the application uses ES modules, you'll need to serve it through a local web server. Here are a few options:

**Using Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Using Node.js:**
```bash
npx serve
```

**Using PHP:**
```bash
php -S localhost:8000
```

Then open your browser and navigate to `http://localhost:8000`.

## Project Structure

```
map-grid/
├── index.html      # Main HTML document
├── script.js       # Application logic and map initialization
├── style.css       # Styling
└── README.md       # This file
```

## How It Works

1. **Initialization**: On load, the app detects your country via IP geolocation (ipapi.co) and fetches the country's bounding box from Nominatim. A MapLibre GL map is created with a raster tile source and an empty GeoJSON source for grid points.
2. **Grid Generation**: Based on the current zoom level and viewport, the app calculates an optimal grid precision to display 255 markers or fewer and generates a GeoJSON `FeatureCollection` of grid points.
3. **GPU Rendering**: Grid points are displayed via two WebGL symbol layers — one for the pin icon and one for the coordinate text. Updating the grid is a single `setData()` call on the GeoJSON source — no individual DOM markers.
4. **Address Lookup**: When you click a marker, the app queries Nominatim's reverse geocoding API to retrieve the address

## Configuration

You can customize the application behavior by modifying the `CONFIG` object in `script.js`:

```javascript
const CONFIG = {
  DEFAULT_BBOX: [49.0022, 54.835, 14.122, 24.15],  // Default bounding box (Poland)
  MAX_MARKERS: 255,                                 // Maximum markers to display
  MAX_PRECISION: 8,                                 // Maximum decimal precision
  MAX_ATTEMPTS: 10,                                 // Grid calculation iterations
  MARKER_SCALE: 0.8,                                // Marker size scale factor
  STYLE_URL: "...",                                 // OpenFreeMap Liberty vector-tile style URL
};
```

## Technologies Used

- **[MapLibre GL JS](https://maplibre.org/)**: High-performance interactive map library with WebGL rendering
- **[OpenFreeMap Liberty](https://openfreemap.org/)**: Free, keyless vector-tile basemap style (vector tiles, glyphs and sprites)

## API Usage

This application uses free public APIs:

> [!NOTE]
> **Nominatim Usage Policy**: This app uses the public Nominatim API which has a strict usage policy. Please review their [usage policy](https://operations.osmfoundation.org/policies/nominatim/) if you plan to use this code in production. For heavy usage, consider setting up your own Nominatim instance or using a commercial geocoding service.

## Browser Support

This application uses modern JavaScript features including:
- ES modules
- Async/await
- Template literals
- Arrow functions

Supported browsers:
- Chrome/Edge 61+
- Firefox 60+
- Safari 11+
- Opera 48+

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Vector tiles & basemap style by [OpenFreeMap](https://openfreemap.org/)
- Map data by [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Geocoding by [Nominatim](https://nominatim.org/)
- IP geolocation by [ipapi.co](https://ipapi.co/)
