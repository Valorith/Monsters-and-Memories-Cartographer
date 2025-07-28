class MapViewer {
    constructor() {
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('mapContainer');
        this.mapSelect = document.getElementById('mapSelect');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        this.image = null;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
        this.maps = [];
        this.currentMapIndex = 0;
        
        this.init();
    }
    
    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        await this.loadMapList();
        if (this.maps.length > 0) {
            await this.loadMap(this.maps[0]);
        }
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.handleTouchEnd());
        
        // Control buttons
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
        
        // Map selector
        this.mapSelect.addEventListener('change', (e) => {
            const selectedMap = this.maps[e.target.selectedIndex];
            if (selectedMap) {
                this.loadMap(selectedMap);
            }
        });
    }
    
    async loadMapList() {
        // In a real application, this would fetch from a server
        // For now, we'll hardcode the maps from the Maps directory
        this.maps = [
            { name: 'Ancient Crypt', file: 'Maps/Ancient_Crypt_Map.png' },
            { name: 'Deep Dunes', file: 'Maps/Deep_Dunes_Map.webp' },
            { name: 'Infested Crypt', file: 'Maps/Infested_Crypt_Map.png' },
            { name: 'Night Harbor V2', file: 'Maps/Night_harbor_V2.webp' },
            { name: 'Shaded Dunes', file: 'Maps/Shaded_Dunes_Map.webp' },
            { name: 'Sungreet Strand V2', file: 'Maps/Sungreet_Strand_v2.jpg' },
            { name: 'Tomb of the Last Wyrmsbane', file: 'Maps/TombOfTheLastWyrmsbaneIsometric.webp' },
            { name: 'Wyrmsbane Combined', file: 'Maps/WyrmsbaneCombined_v0.webp' },
            { name: 'Wyrmsbane Tomb', file: 'Maps/Wyrmsbane_Tomb.webp' }
        ];
        
        // Populate the select dropdown
        this.mapSelect.innerHTML = '';
        this.maps.forEach((map, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = map.name;
            this.mapSelect.appendChild(option);
        });
    }
    
    async loadMap(mapInfo) {
        this.showLoading(true);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.resetView();
                this.showLoading(false);
                resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load map: ${mapInfo.file}`);
                this.showLoading(false);
                reject();
            };
            img.src = mapInfo.file;
        });
    }
    
    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    handleMouseDown(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.offsetX;
        this.dragStartY = e.clientY - this.offsetY;
        this.canvas.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        this.offsetX = e.clientX - this.dragStartX;
        this.offsetY = e.clientY - this.dragStartY;
        this.render();
    }
    
    handleMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        this.zoomAt(x, y, zoomFactor);
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            const touch = e.touches[0];
            this.dragStartX = touch.clientX - this.offsetX;
            this.dragStartY = touch.clientY - this.offsetY;
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (!this.isDragging || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        this.offsetX = touch.clientX - this.dragStartX;
        this.offsetY = touch.clientY - this.dragStartY;
        this.render();
    }
    
    handleTouchEnd() {
        this.isDragging = false;
    }
    
    zoom(factor) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.zoomAt(centerX, centerY, factor);
    }
    
    zoomAt(x, y, factor) {
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
        
        if (newScale !== this.scale) {
            const scaleChange = newScale / this.scale;
            this.offsetX = x - (x - this.offsetX) * scaleChange;
            this.offsetY = y - (y - this.offsetY) * scaleChange;
            this.scale = newScale;
            
            this.updateZoomIndicator();
            this.render();
        }
    }
    
    resetView() {
        if (!this.image) return;
        
        const canvasRatio = this.canvas.width / this.canvas.height;
        const imageRatio = this.image.width / this.image.height;
        
        if (canvasRatio > imageRatio) {
            this.scale = this.canvas.height / this.image.height;
        } else {
            this.scale = this.canvas.width / this.image.width;
        }
        
        this.scale *= 0.9; // Add some padding
        
        this.offsetX = (this.canvas.width - this.image.width * this.scale) / 2;
        this.offsetY = (this.canvas.height - this.image.height * this.scale) / 2;
        
        this.updateZoomIndicator();
        this.render();
    }
    
    updateZoomIndicator() {
        const zoomPercent = Math.round(this.scale * 100);
        document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.image) return;
        
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.drawImage(this.image, 0, 0);
        this.ctx.restore();
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MapViewer();
});