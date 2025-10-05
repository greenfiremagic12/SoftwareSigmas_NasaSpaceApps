# Smart New York - Flutter Conversion

This Flutter application is a conversion of the original website located in the `website` folder. The conversion maintains the same functionality and visual design while adapting it to the Flutter framework.

## Features Converted

### ✅ Completed
- **Hero Section**: Main title and description with call-to-action button
- **Interactive Map**: Flutter Map with OpenStreetMap tiles
- **Layer Controls**: Toggle switches for Food Access, Heat Islands, and Waste Sites
- **NASA Data Chart**: Real-time temperature data from NASA POWER API using fl_chart
- **Responsive Design**: Mobile-friendly layout with proper spacing
- **Dark Theme**: Maintains the original dark blue color scheme (#0B0C10, #00D4FF)
- **Typography**: Uses monospace font (Orbitron font can be added later)

### 🗺️ Map Features
- **Base Layer**: OpenStreetMap tiles
- **Food Access Layer**: Polygon overlay showing sample Brooklyn area
- **Heat Islands Layer**: Marker showing heat anomaly location
- **Waste Sites Layer**: Marker showing waste transfer station
- **Interactive Controls**: Checkboxes to toggle layer visibility

### 📊 Data Visualization
- **NASA POWER API Integration**: Fetches real temperature data for NYC
- **Line Chart**: Displays max/min temperature trends
- **Real-time Updates**: Data loads automatically on app start

## Technical Implementation

### Dependencies Added
- `flutter_map: ^6.1.0` - Interactive map functionality
- `latlong2: ^0.9.1` - Geographic coordinates
- `http: ^1.1.0` - API requests
- `fl_chart: ^0.66.0` - Chart visualization
- `webview_flutter: ^4.4.2` - Web content embedding

### File Structure
```
ss_testing/
├── lib/
│   ├── main.dart              # App configuration and routing
│   └── pages/
│       ├── home.dart          # Main Smart New York page
│       ├── default.dart       # Default page
│       └── second.dart        # Secondary page
├── website/                   # Original website files (copied)
│   ├── index.html
│   ├── styles.css
│   └── script.js
└── pubspec.yaml              # Dependencies and configuration
```

## Running the App

1. Navigate to the ss_testing directory
2. Run `flutter pub get` to install dependencies
3. Run `flutter run` to start the app

## Original Website Features Preserved

- **Color Scheme**: Dark background with cyan accents
- **Layout**: Hero section + dashboard with map and controls
- **Functionality**: Layer toggles, NASA data integration
- **Visual Design**: Rounded corners, borders, proper spacing

## Future Enhancements

- Add Orbitron font files for better typography
- Implement navigation menu functionality
- Add more detailed map layers
- Enhance chart interactivity
- Add data export features
- Implement offline data caching
