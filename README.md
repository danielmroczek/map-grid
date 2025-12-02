# Map Grid

> Explore where parallels and meridians intersect

A lightweight web application that displays an adaptive coordinate grid on an interactive map. Click on any pin to see its exact coordinates and the corresponding address retrieved via reverse geocoding.

## Features

- **Adaptive Grid System**: Automatically adjusts grid precision based on zoom level and visible area
- **Reverse Geocoding**: Click any marker to fetch and display the location address using Nominatim
- **IP-based Geolocation**: Automatically centers the map on your country using IP-based detection
- **Custom SVG Markers**: Each marker displays its coordinates directly on the pin
- **Responsive Design**: Full viewport map that works on any screen size

## Getting Started

### Prerequisites

- A modern web browser with JavaScript support
- A local web server (for proper module loading)

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
├── pin.svg         # Custom marker SVG with coordinate labels
└── README.md       # This file
```

## How It Works

1. **Initialization**: On load, the app detects your country via IP geolocation (ipapi.co) and fetches the country's bounding box from Nominatim
2. **Grid Generation**: Based on the current zoom level and viewport, the app calculates an optimal grid precision to display 255 markers or fewer
3. **Marker Creation**: Each marker is a custom SVG icon with the coordinates embedded directly in the pin
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
  TILE_URL: "...",                                  // OpenStreetMap tile server URL
  TILE_ATTRIBUTION: "...",                          // Map attribution text
};
```

## Technologies Used

- **[Leaflet](https://leafletjs.com/)**: Interactive map library
- **[OpenStreetMap](https://www.openstreetmap.org/)**: Map tiles and data
- **[Nominatim](https://nominatim.org/)**: Geocoding and reverse geocoding service
- **[ipapi.co](https://ipapi.co/)**: IP-based geolocation

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

- Map tiles by [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Geocoding by [Nominatim](https://nominatim.org/)
- IP geolocation by [ipapi.co](https://ipapi.co/)
