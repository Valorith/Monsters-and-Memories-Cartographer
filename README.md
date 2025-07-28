# M&M Cartographer

An interactive map viewer and editor for Monsters & Memories game maps. This tool allows players to view game maps with points of interest (POIs), connections between zones, and custom markers.

## Features

- 🗺️ **Interactive Map Viewer**: Pan, zoom, and explore game maps
- 📍 **Points of Interest (POIs)**: Mark important locations with custom icons
- 🔗 **Zone Connections**: Visual connections between different game zones
- 🎯 **Point Connectors**: Link related locations across the map
- 🛠️ **Admin Mode**: Edit maps, add/move/delete POIs and connections
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 💾 **Local Storage**: All data saved locally in your browser

## Quick Start

### For Users

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mm-cartographer.git
   cd mm-cartographer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up admin password (optional):
   - Copy `.env.example` to `.env`
   - Set your admin password in the `.env` file
   - ⚠️ **Never commit the `.env` file!**

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 in your browser

### For Deployment

See [README_QUICK_DEPLOY.md](README_QUICK_DEPLOY.md) for deployment instructions.

## Usage

### Basic Navigation
- **Click and drag** to pan the map
- **Mouse wheel** to zoom in/out
- **Home button** to reset view
- **Touch gestures** supported on mobile

### Admin Mode
- Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac) to toggle admin mode
- Enter the admin password when prompted

#### Admin Features:
- **Right-click** to place new items
- **Alt+Click and drag** to move items
- **Shift+Click** to delete items
- **Ctrl+Click** to open item settings (icons, size, labels)

### Map Manager (Admin Only)
- Click the 🗺️ button in admin mode
- Add, rename, delete, or reorder maps
- Upload new map images
- View map statistics

## Development

### Tech Stack
- Vue 3 (Composition API)
- Vite
- Canvas API for rendering
- Local Storage for data persistence

### Project Structure
```
src/
├── components/       # Vue components
├── composables/      # Reusable composition functions
├── data/            # Map data and configuration
└── style.css        # Global styles
```

### Building for Production
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Google OAuth integration
- [ ] Multi-user collaboration
- [ ] Cloud data sync
- [ ] Export/import map data
- [ ] Custom icon uploads
- [ ] Map layers support

## License

This project is intended for use with the Monsters & Memories game community. Please respect the game's terms of service and intellectual property.

## Acknowledgments

- Built for the Monsters & Memories community
- Icons from standard Unicode emoji set
- Inspired by classic RPG cartography tools
