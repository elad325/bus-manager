// ===================================
// מערכת ניהול אוטובוסים - שירות מפות
// ===================================

class MapsService {
    constructor() {
        this.apiKey = null;
        this.isLoaded = false;
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.geocoder = null;
        this.geocodeCache = {}; // Cache for geocoding results
    }

    // Initialize Google Maps
    async init() {
        this.apiKey = await getGoogleMapsKey();

        if (!this.apiKey) {
            console.log('Google Maps API Key not configured');
            return false;
        }

        return new Promise((resolve) => {
            if (window.google && window.google.maps) {
                this.isLoaded = true;
                this.initServices();
                resolve(true);
                return;
            }

            // Load Google Maps script
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&language=he`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                this.isLoaded = true;
                this.initServices();
                resolve(true);
            };

            script.onerror = () => {
                console.error('Failed to load Google Maps');
                resolve(false);
            };

            document.head.appendChild(script);
        });
    }

    // Initialize Google Maps services
    initServices() {
        if (window.google && window.google.maps) {
            this.directionsService = new google.maps.DirectionsService();
            this.geocoder = new google.maps.Geocoder();
        }
    }

    // Create map in container
    createMap(containerId) {
        if (!this.isLoaded) {
            console.error('Google Maps not loaded');
            return null;
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Map container not found');
            return null;
        }

        // Default to Israel center
        const defaultCenter = { lat: 31.5, lng: 34.75 };

        this.map = new google.maps.Map(container, {
            center: defaultCenter,
            zoom: 8,
            styles: this.getMapStyles(),
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });

        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: this.map,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#6366f1',
                strokeWeight: 5
            }
        });

        return this.map;
    }

    // Get dark mode map styles
    getMapStyles() {
        return [
            { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
            {
                featureType: "administrative.country",
                elementType: "geometry.stroke",
                stylers: [{ color: "#4b6878" }]
            },
            {
                featureType: "administrative.province",
                elementType: "geometry.stroke",
                stylers: [{ color: "#4b6878" }]
            },
            {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#304a7d" }]
            },
            {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#255763" }]
            },
            {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#2c6675" }]
            },
            {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#255763" }]
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#0e1626" }]
            },
            {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#4e6d70" }]
            }
        ];
    }

    // Geocode address to coordinates (with caching)
    async geocodeAddress(address) {
        if (!this.geocoder) {
            console.error('Geocoder not initialized');
            return null;
        }

        // Clean address - remove any invalid UTF-8 characters or escape sequences
        let cleanAddress = address;
        try {
            // Remove null bytes, control characters, and other invalid UTF-8
            cleanAddress = address.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
            // Normalize unicode characters
            cleanAddress = cleanAddress.normalize('NFC');
            // Trim whitespace
            cleanAddress = cleanAddress.trim();
        } catch (e) {
            console.warn('Failed to clean address:', e);
        }

        // Check cache first
        const cacheKey = cleanAddress.toLowerCase().trim();
        if (this.geocodeCache[cacheKey]) {
            console.log(`Using cached geocode for: ${cleanAddress}`);
            return this.geocodeCache[cacheKey];
        }

        return new Promise((resolve) => {
            this.geocoder.geocode({ address: cleanAddress + ', ישראל' }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const result = {
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng(),
                        formattedAddress: results[0].formatted_address
                    };
                    // Save to cache
                    this.geocodeCache[cacheKey] = result;
                    resolve(result);
                } else {
                    console.error('Geocode failed:', status);
                    resolve(null);
                }
            });
        });
    }

    // Clear geocode cache (useful if addresses change)
    clearGeocodeCache() {
        this.geocodeCache = {};
        console.log('Geocode cache cleared');
    }

    // Calculate optimized route - handles large number of waypoints by chunking
    async calculateRoute(origin, destination, waypoints) {
        if (!this.directionsService) {
            throw new Error('Google Maps לא מוגדר');
        }

        // Geocode all addresses
        const originCoords = await this.geocodeAddress(origin);
        const destCoords = await this.geocodeAddress(destination);

        if (!originCoords || !destCoords) {
            throw new Error('לא ניתן למצוא את הכתובות');
        }

        // Geocode waypoints
        const waypointCoords = [];
        for (const wp of waypoints) {
            const coords = await this.geocodeAddress(wp.address);
            if (coords) {
                waypointCoords.push({
                    ...wp,
                    location: coords
                });
            }
        }

        // Google Maps allows max 25 waypoints per request
        // If we have more, we need to split into chunks and merge results
        const MAX_WAYPOINTS = 23; // Leave room for origin/destination connections

        if (waypointCoords.length <= MAX_WAYPOINTS) {
            // Can do it in one request
            return this.calculateSingleRoute(origin, destination, originCoords, destCoords, waypointCoords);
        } else {
            // Need to split into chunks and merge
            console.log(`Splitting ${waypointCoords.length} waypoints into chunks of ${MAX_WAYPOINTS}`);
            return this.calculateChunkedRoute(origin, destination, originCoords, destCoords, waypointCoords, MAX_WAYPOINTS);
        }
    }

    // Calculate route for a single chunk (up to 25 waypoints)
    async calculateSingleRoute(origin, destination, originCoords, destCoords, waypointCoords) {
        const waypointsForGoogle = waypointCoords.map(wp => ({
            location: new google.maps.LatLng(wp.location.lat, wp.location.lng),
            stopover: true
        }));

        return new Promise((resolve, reject) => {
            this.directionsService.route({
                origin: new google.maps.LatLng(originCoords.lat, originCoords.lng),
                destination: new google.maps.LatLng(destCoords.lat, destCoords.lng),
                waypoints: waypointsForGoogle,
                optimizeWaypoints: true, // This is the magic - Google optimizes the order!
                travelMode: google.maps.TravelMode.DRIVING,
                language: 'he'
            }, (result, status) => {
                if (status === 'OK') {
                    // Display route on map
                    if (this.directionsRenderer) {
                        this.directionsRenderer.setDirections(result);
                    }

                    // Parse the result
                    const route = result.routes[0];
                    const legs = route.legs;
                    const optimizedOrder = route.waypoint_order;

                    // Build ordered stops
                    const orderedStops = [{
                        order: 0,
                        name: 'נקודת התחלה',
                        address: origin,
                        location: originCoords,
                        duration: null,
                        distance: null
                    }];

                    // Reorder waypoints according to Google's optimization
                    optimizedOrder.forEach((originalIndex, newIndex) => {
                        const wp = waypointCoords[originalIndex];
                        const leg = legs[newIndex];

                        orderedStops.push({
                            order: newIndex + 1,
                            name: wp.name || `תחנה ${newIndex + 1}`,
                            address: wp.address,
                            location: wp.location,
                            duration: leg.duration.text,
                            durationSeconds: leg.duration.value,
                            distance: leg.distance.text,
                            distanceMeters: leg.distance.value,
                            arrivalTime: null // Will calculate below
                        });
                    });

                    // Add destination
                    const lastLeg = legs[legs.length - 1];
                    orderedStops.push({
                        order: orderedStops.length,
                        name: 'יעד סופי',
                        address: destination,
                        location: destCoords,
                        duration: lastLeg.duration.text,
                        durationSeconds: lastLeg.duration.value,
                        distance: lastLeg.distance.text,
                        distanceMeters: lastLeg.distance.value
                    });

                    // Calculate total distance and duration
                    let totalDistance = 0;
                    let totalDuration = 0;
                    legs.forEach(leg => {
                        totalDistance += leg.distance.value;
                        totalDuration += leg.duration.value;
                    });

                    // Calculate arrival times
                    const now = new Date();
                    let cumulativeTime = 0;
                    orderedStops.forEach((stop, index) => {
                        if (index > 0) {
                            cumulativeTime += orderedStops[index].durationSeconds || 0;
                        }
                        const arrivalTime = new Date(now.getTime() + cumulativeTime * 1000);
                        stop.estimatedArrival = arrivalTime.toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    });

                    resolve({
                        success: true,
                        stops: orderedStops,
                        summary: {
                            totalDistance: (totalDistance / 1000).toFixed(1) + ' ק"מ',
                            totalDistanceMeters: totalDistance,
                            totalDuration: this.formatDuration(totalDuration),
                            totalDurationSeconds: totalDuration,
                            stopsCount: orderedStops.length
                        },
                        googleRoute: result
                    });
                } else {
                    reject(new Error('חישוב המסלול נכשל: ' + status));
                }
            });
        });
    }

    // Calculate route with chunking for large number of waypoints
    async calculateChunkedRoute(origin, destination, originCoords, destCoords, waypointCoords, chunkSize) {
        // Sort waypoints by distance from origin for better chunking
        const sortedWaypoints = this.sortWaypointsByProximity(waypointCoords, originCoords, destCoords);

        // Split into chunks
        const chunks = [];
        for (let i = 0; i < sortedWaypoints.length; i += chunkSize) {
            chunks.push(sortedWaypoints.slice(i, i + chunkSize));
        }

        console.log(`Split into ${chunks.length} chunks`);

        // Process each chunk
        const allOrderedStops = [];
        let totalDistance = 0;
        let totalDuration = 0;
        let currentOrigin = origin;
        let currentOriginCoords = originCoords;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isLastChunk = i === chunks.length - 1;

            // For last chunk, use actual destination; otherwise, use last waypoint of chunk as connection point
            const chunkDest = isLastChunk ? destination : chunk[chunk.length - 1].address;
            const chunkDestCoords = isLastChunk ? destCoords : chunk[chunk.length - 1].location;

            // For non-last chunks, remove the last waypoint since it becomes the destination
            const chunkWaypoints = isLastChunk ? chunk : chunk.slice(0, -1);

            console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunkWaypoints.length} waypoints`);

            try {
                // Calculate this chunk's route
                const chunkResult = await this.calculateChunkRoute(
                    currentOrigin,
                    chunkDest,
                    currentOriginCoords,
                    chunkDestCoords,
                    chunkWaypoints
                );

                // Add stops to our collection (skip the "start point" for non-first chunks)
                const stopsToAdd = i === 0 ? chunkResult.stops : chunkResult.stops.slice(1);

                // Don't add the destination stop for non-last chunks (it becomes the next origin)
                const finalStops = isLastChunk ? stopsToAdd : stopsToAdd.slice(0, -1);

                allOrderedStops.push(...finalStops);

                // Accumulate distance and duration
                totalDistance += chunkResult.totalDistanceMeters;
                totalDuration += chunkResult.totalDurationSeconds;

                // Prepare for next chunk
                if (!isLastChunk) {
                    currentOrigin = chunk[chunk.length - 1].address;
                    currentOriginCoords = chunk[chunk.length - 1].location;
                }

            } catch (error) {
                console.error(`Error processing chunk ${i + 1}:`, error);
                throw error;
            }

            // Small delay between API calls to avoid rate limiting
            if (!isLastChunk) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Add final destination
        allOrderedStops.push({
            order: allOrderedStops.length,
            name: 'יעד סופי',
            address: destination,
            location: destCoords,
            duration: null,
            distance: null
        });

        // Renumber all stops
        allOrderedStops.forEach((stop, index) => {
            stop.order = index;
        });

        // Calculate arrival times
        const now = new Date();
        let cumulativeTime = 0;
        allOrderedStops.forEach((stop, index) => {
            if (index > 0) {
                cumulativeTime += stop.durationSeconds || 0;
            }
            const arrivalTime = new Date(now.getTime() + cumulativeTime * 1000);
            stop.estimatedArrival = arrivalTime.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
            });
        });

        // Display combined route on map (show last chunk's route as approximation)
        // For a more accurate visual, we'd need to render multiple routes

        return {
            success: true,
            stops: allOrderedStops,
            summary: {
                totalDistance: (totalDistance / 1000).toFixed(1) + ' ק"מ',
                totalDistanceMeters: totalDistance,
                totalDuration: this.formatDuration(totalDuration),
                totalDurationSeconds: totalDuration,
                stopsCount: allOrderedStops.length
            },
            googleRoute: null, // No single route for chunked calculation
            isChunked: true,
            chunkCount: chunks.length
        };
    }

    // Calculate a single chunk of the route
    async calculateChunkRoute(origin, destination, originCoords, destCoords, waypointCoords) {
        const waypointsForGoogle = waypointCoords.map(wp => ({
            location: new google.maps.LatLng(wp.location.lat, wp.location.lng),
            stopover: true
        }));

        return new Promise((resolve, reject) => {
            this.directionsService.route({
                origin: new google.maps.LatLng(originCoords.lat, originCoords.lng),
                destination: new google.maps.LatLng(destCoords.lat, destCoords.lng),
                waypoints: waypointsForGoogle,
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING,
                language: 'he'
            }, (result, status) => {
                if (status === 'OK') {
                    const route = result.routes[0];
                    const legs = route.legs;
                    const optimizedOrder = route.waypoint_order;

                    const stops = [{
                        order: 0,
                        name: 'נקודת התחלה',
                        address: origin,
                        location: originCoords,
                        duration: null,
                        distance: null,
                        durationSeconds: 0
                    }];

                    // Reorder waypoints according to optimization
                    optimizedOrder.forEach((originalIndex, newIndex) => {
                        const wp = waypointCoords[originalIndex];
                        const leg = legs[newIndex];

                        stops.push({
                            order: newIndex + 1,
                            name: wp.name || `תחנה ${newIndex + 1}`,
                            address: wp.address,
                            location: wp.location,
                            duration: leg.duration.text,
                            durationSeconds: leg.duration.value,
                            distance: leg.distance.text,
                            distanceMeters: leg.distance.value
                        });
                    });

                    // Add destination
                    const lastLeg = legs[legs.length - 1];
                    stops.push({
                        order: stops.length,
                        name: 'יעד',
                        address: destination,
                        location: destCoords,
                        duration: lastLeg.duration.text,
                        durationSeconds: lastLeg.duration.value,
                        distance: lastLeg.distance.text,
                        distanceMeters: lastLeg.distance.value
                    });

                    // Calculate totals
                    let totalDistance = 0;
                    let totalDuration = 0;
                    legs.forEach(leg => {
                        totalDistance += leg.distance.value;
                        totalDuration += leg.duration.value;
                    });

                    resolve({
                        stops,
                        totalDistanceMeters: totalDistance,
                        totalDurationSeconds: totalDuration,
                        googleRoute: result
                    });
                } else {
                    reject(new Error('חישוב המסלול נכשל: ' + status));
                }
            });
        });
    }

    // Sort waypoints by proximity - start from origin, always pick nearest unvisited
    sortWaypointsByProximity(waypoints, originCoords, destCoords) {
        if (waypoints.length <= 1) return waypoints;

        const sorted = [];
        const remaining = [...waypoints];
        let currentPos = originCoords;

        while (remaining.length > 0) {
            // Find nearest waypoint to current position
            let nearestIndex = 0;
            let nearestDist = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const dist = this.calculateDistance(
                    currentPos.lat, currentPos.lng,
                    remaining[i].location.lat, remaining[i].location.lng
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestIndex = i;
                }
            }

            // Add nearest to sorted list
            const nearest = remaining.splice(nearestIndex, 1)[0];
            sorted.push(nearest);
            currentPos = nearest.location;
        }

        return sorted;
    }

    // Format duration in Hebrew
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} שעות ו-${minutes} דקות`;
        }
        return `${minutes} דקות`;
    }

    // Generate Waze navigation link
    generateWazeLink(stops) {
        if (stops.length === 0) return '';

        // Waze only supports one destination at a time
        // Generate link to first stop
        const firstStop = stops.find(s => s.order === 1);
        if (firstStop && firstStop.location) {
            return `https://waze.com/ul?ll=${firstStop.location.lat},${firstStop.location.lng}&navigate=yes`;
        }

        return '';
    }

    // Generate Google Maps navigation link
    generateGoogleMapsLink(stops) {
        if (stops.length < 2) return '';

        const origin = stops[0];
        const destination = stops[stops.length - 1];
        const waypoints = stops.slice(1, -1);

        let url = 'https://www.google.com/maps/dir/?api=1';
        url += `&origin=${encodeURIComponent(origin.address)}`;
        url += `&destination=${encodeURIComponent(destination.address)}`;

        if (waypoints.length > 0) {
            const waypointAddresses = waypoints.map(w => encodeURIComponent(w.address)).join('|');
            url += `&waypoints=${waypointAddresses}`;
        }

        url += '&travelmode=driving';

        return url;
    }

    // Check if maps is ready
    isReady() {
        return this.isLoaded && this.apiKey;
    }

    // Calculate distance between two coordinates (Haversine formula)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    // Find the best bus for a student address
    async findBestBusForAddress(studentAddress) {
        if (!this.isReady()) {
            console.log('Maps not ready, cannot auto-assign bus');
            return null;
        }

        // Geocode student address
        const studentCoords = await this.geocodeAddress(studentAddress);
        if (!studentCoords) {
            console.log('Could not geocode student address');
            return null;
        }

        // Get all buses
        const buses = window.busManager ? window.busManager.getAllBuses() : [];
        if (buses.length === 0) {
            return null;
        }

        let bestBus = null;
        let shortestDistance = Infinity;

        // Check each bus
        for (const bus of buses) {
            if (!bus.startLocation && !bus.endLocation) continue;

            // Calculate distance to bus start and end points
            let minDistToBus = Infinity;

            if (bus.startLocation) {
                const startCoords = await this.geocodeAddress(bus.startLocation);
                if (startCoords) {
                    const dist = this.calculateDistance(
                        studentCoords.lat, studentCoords.lng,
                        startCoords.lat, startCoords.lng
                    );
                    minDistToBus = Math.min(minDistToBus, dist);
                }
            }

            if (bus.endLocation) {
                const endCoords = await this.geocodeAddress(bus.endLocation);
                if (endCoords) {
                    const dist = this.calculateDistance(
                        studentCoords.lat, studentCoords.lng,
                        endCoords.lat, endCoords.lng
                    );
                    minDistToBus = Math.min(minDistToBus, dist);
                }
            }

            // Also check distance to other students on this bus (cluster matching)
            const busStudents = window.studentManager ? window.studentManager.getStudentsByBus(bus.id) : [];
            for (const existingStudent of busStudents.slice(0, 3)) { // Check first 3 students
                const existingCoords = await this.geocodeAddress(existingStudent.address);
                if (existingCoords) {
                    const dist = this.calculateDistance(
                        studentCoords.lat, studentCoords.lng,
                        existingCoords.lat, existingCoords.lng
                    );
                    // Weight student proximity more heavily
                    minDistToBus = Math.min(minDistToBus, dist * 0.5);
                }
            }

            if (minDistToBus < shortestDistance) {
                shortestDistance = minDistToBus;
                bestBus = bus;
            }
        }

        if (bestBus) {
            console.log(`Best bus for "${studentAddress}": ${bestBus.name} (distance: ${shortestDistance.toFixed(2)} km)`);
        }

        return bestBus;
    }
}

// Create global instance
window.mapsService = new MapsService();
