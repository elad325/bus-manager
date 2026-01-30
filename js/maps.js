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
        this.markers = []; // Store markers for cleanup
        this.additionalRenderers = []; // Store additional DirectionsRenderers for chunked routes
        this.distanceMatrixCache = new Map(); // Cache for distance matrix calculations
    }

    // ==========================================
    // DISTANCE MATRIX CACHE SERVICE
    // ==========================================

    /**
     * Get unique cache key for a pair of coordinates
     * @param {Object} p1 - First point {lat, lng}
     * @param {Object} p2 - Second point {lat, lng}
     * @returns {string} Cache key
     */
    _getDistanceCacheKey(p1, p2) {
        return `${p1.lat.toFixed(5)},${p1.lng.toFixed(5)}-${p2.lat.toFixed(5)},${p2.lng.toFixed(5)}`;
    }

    /**
     * Get cached distance or calculate and cache it
     * Uses Haversine formula for fast calculation
     * @param {Object} p1 - First point {lat, lng}
     * @param {Object} p2 - Second point {lat, lng}
     * @returns {number} Distance in meters
     */
    getCachedDistanceMeters(p1, p2) {
        const key = this._getDistanceCacheKey(p1, p2);

        if (this.distanceMatrixCache.has(key)) {
            return this.distanceMatrixCache.get(key);
        }

        // Calculate using Haversine (returns km, convert to meters)
        const distKm = this.calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        const distMeters = distKm * 1000;

        this.distanceMatrixCache.set(key, distMeters);

        // Also cache reverse direction (same distance)
        const reverseKey = this._getDistanceCacheKey(p2, p1);
        this.distanceMatrixCache.set(reverseKey, distMeters);

        return distMeters;
    }

    /**
     * Prefetch distance matrix for all points (warmup cache)
     * @param {Array} points - Array of {lat, lng} objects
     */
    prefetchDistanceMatrix(points) {
        const startTime = Date.now();
        let calculated = 0;

        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                this.getCachedDistanceMeters(points[i], points[j]);
                calculated++;
            }
        }

        console.log(`Distance matrix prefetch: ${calculated} pairs in ${Date.now() - startTime}ms`);
    }

    /**
     * Clear the distance matrix cache
     */
    clearDistanceMatrixCache() {
        this.distanceMatrixCache.clear();
        console.log('Distance matrix cache cleared');
    }

    /**
     * Get cache statistics
     */
    getDistanceCacheStats() {
        return {
            size: this.distanceMatrixCache.size,
            memoryEstimateKB: (this.distanceMatrixCache.size * 50) / 1024 // Rough estimate
        };
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

            // Load Google Maps script with async loading parameter
            // See: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
            const callbackName = '__googleMapsCallback_' + Date.now();

            window[callbackName] = () => {
                this.isLoaded = true;
                this.initServices();
                delete window[callbackName];
                resolve(true);
            };

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places,marker&language=he&loading=async&callback=${callbackName}`;
            script.async = true;

            script.onerror = () => {
                console.error('Failed to load Google Maps');
                delete window[callbackName];
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
            // Note: styles cannot be used with mapId - use Cloud-based map styling instead
            // See: https://developers.google.com/maps/documentation/javascript/styling#cloud_tooling
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            mapId: 'bus_manager_map' // Required for AdvancedMarkerElement
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

    // Clear all markers and route renderers from map
    clearMapDisplay() {
        // Clear markers (AdvancedMarkerElement uses .map property instead of setMap method)
        this.markers.forEach(marker => {
            marker.map = null;
        });
        this.markers = [];

        // Clear additional renderers
        this.additionalRenderers.forEach(renderer => {
            renderer.setMap(null);
        });
        this.additionalRenderers = [];

        // Reset main renderer options (don't try to clear directions as it can cause errors)
        if (this.directionsRenderer) {
            this.directionsRenderer.setOptions({
                suppressMarkers: false,
                polylineOptions: {
                    strokeColor: '#6366f1',
                    strokeWeight: 5
                }
            });
        }
    }

    // Add a marker to the map using AdvancedMarkerElement
    addMarker(location, label, title, color = '#6366f1') {
        if (!this.map) return null;

        // Create custom pin element
        const pinElement = new google.maps.marker.PinElement({
            background: color,
            borderColor: 'white',
            glyphColor: 'white',
            glyphText: label, // Use glyphText instead of deprecated glyph
            scale: 1.2
        });

        // Create advanced marker (pass pinElement directly, not .element)
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: location,
            map: this.map,
            title: title,
            content: pinElement
        });

        this.markers.push(marker);
        return marker;
    }

    // Create a new DirectionsRenderer for additional routes
    createAdditionalRenderer(color = '#10b981') {
        if (!this.map) return null;

        const renderer = new google.maps.DirectionsRenderer({
            map: this.map,
            suppressMarkers: true, // We'll add our own markers
            polylineOptions: {
                strokeColor: color,
                strokeWeight: 4,
                strokeOpacity: 0.8
            }
        });

        this.additionalRenderers.push(renderer);
        return renderer;
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

    // Geocode address to coordinates (with caching and multiple fallback strategies)
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

        // Israel bounding box for better results
        const israelBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(29.45, 34.25),  // Southwest
            new google.maps.LatLng(33.35, 35.90)   // Northeast
        );

        // Multiple search strategies for Israeli locations
        const searchStrategies = [
            // Strategy 1: Address with Israel, component restriction
            {
                address: cleanAddress,
                componentRestrictions: { country: 'IL' },
                bounds: israelBounds
            },
            // Strategy 2: Address + ישראל suffix with region
            {
                address: cleanAddress + ', ישראל',
                region: 'IL',
                bounds: israelBounds
            },
            // Strategy 3: יישוב prefix for settlements
            {
                address: 'יישוב ' + cleanAddress,
                componentRestrictions: { country: 'IL' },
                bounds: israelBounds
            },
            // Strategy 4: Just the address with bounds (sometimes works better)
            {
                address: cleanAddress,
                bounds: israelBounds,
                region: 'IL'
            }
        ];

        // Helper to check if result is valid (not just generic "Israel")
        const isValidResult = (results) => {
            if (!results || !results[0]) return false;
            const formatted = results[0].formatted_address;
            if (formatted === 'ישראל' || formatted === 'Israel') return false;
            // Also check that we got a specific enough result (not just country level)
            const types = results[0].types || [];
            if (types.includes('country') && types.length === 1) return false;
            return true;
        };

        // Try each strategy
        for (let i = 0; i < searchStrategies.length; i++) {
            const strategy = searchStrategies[i];
            try {
                const result = await new Promise((resolve) => {
                    this.geocoder.geocode(strategy, (results, status) => {
                        if (status === 'OK' && isValidResult(results)) {
                            resolve({
                                lat: results[0].geometry.location.lat(),
                                lng: results[0].geometry.location.lng(),
                                formattedAddress: results[0].formatted_address
                            });
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (result) {
                    console.log(`Geocoded "${cleanAddress}" (strategy ${i + 1}) -> ${result.lat}, ${result.lng} (${result.formattedAddress})`);
                    this.geocodeCache[cacheKey] = result;
                    return result;
                }
            } catch (e) {
                console.warn(`Geocode strategy ${i + 1} failed for "${cleanAddress}":`, e);
            }
        }

        console.error(`Geocode failed for "${cleanAddress}": all strategies exhausted`);
        return null;
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

        // Geocode waypoints with small delay to avoid rate limiting
        const waypointCoords = [];
        let failedGeocode = [];
        for (let i = 0; i < waypoints.length; i++) {
            const wp = waypoints[i];
            const coords = await this.geocodeAddress(wp.address);
            if (coords) {
                waypointCoords.push({
                    ...wp,
                    location: coords
                });
            } else {
                console.warn(`Failed to geocode address: ${wp.address} for ${wp.name}`);
                failedGeocode.push(wp);
            }

            // Small delay every 10 requests to avoid rate limiting
            if (i > 0 && i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Geocoded ${waypointCoords.length}/${waypoints.length} waypoints successfully`);
        if (failedGeocode.length > 0) {
            console.warn('Failed to geocode:', failedGeocode.map(wp => wp.address));
        }

        // Debug: log all waypoint coordinates
        console.log('Waypoint coordinates:');
        waypointCoords.forEach(wp => {
            console.log(`  ${wp.name} (${wp.address}): ${wp.location.lat}, ${wp.location.lng}`);
        });

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
        // Clear previous display
        this.clearMapDisplay();

        console.log(`calculateSingleRoute: ${waypointCoords.length} waypoints`);
        console.log('Waypoints:', waypointCoords.map(wp => `${wp.name}: ${wp.address}`));

        const waypointsForGoogle = waypointCoords.map(wp => ({
            location: new google.maps.LatLng(wp.location.lat, wp.location.lng),
            stopover: true
        }));

        console.log(`Sending ${waypointsForGoogle.length} waypoints to DirectionsService`);

        return new Promise((resolve, reject) => {
            this.directionsService.route({
                origin: new google.maps.LatLng(originCoords.lat, originCoords.lng),
                destination: new google.maps.LatLng(destCoords.lat, destCoords.lng),
                waypoints: waypointsForGoogle,
                optimizeWaypoints: true, // This is the magic - Google optimizes the order!
                travelMode: google.maps.TravelMode.DRIVING,
                language: 'he'
            }, (result, status) => {
                console.log(`DirectionsService response status: ${status}`);

                if (status === 'OK') {
                    // Display route on map
                    if (this.directionsRenderer) {
                        // Hide default markers - we'll add our own
                        this.directionsRenderer.setOptions({
                            suppressMarkers: true
                        });
                        this.directionsRenderer.setDirections(result);
                    }

                    // Parse the result
                    const route = result.routes[0];
                    const legs = route.legs;
                    const optimizedOrder = route.waypoint_order;

                    console.log(`DirectionsService returned ${legs.length} legs, waypoint_order: [${optimizedOrder.join(', ')}]`);

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

                    console.log(`Final route has ${orderedStops.length} stops`);
                    console.log('Stops:', orderedStops.map(s => `${s.order}: ${s.name} (${s.address})`));

                    // Add markers for all stops
                    this.addMarkersForStops(orderedStops);

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
                    console.error(`DirectionsService failed with status: ${status}`);
                    reject(new Error('חישוב המסלול נכשל: ' + status));
                }
            });
        });
    }

    // Calculate route with chunking for large number of waypoints
    async calculateChunkedRoute(origin, destination, originCoords, destCoords, waypointCoords, chunkSize) {
        // Clear previous display
        this.clearMapDisplay();

        // Sort waypoints by distance from origin for better chunking
        const sortedWaypoints = this.sortWaypointsByProximity(waypointCoords, originCoords, destCoords);

        // Split into chunks - use smart chunking that considers connection points
        const chunks = this.createSmartChunks(sortedWaypoints, chunkSize, originCoords, destCoords);

        console.log(`Split into ${chunks.length} chunks (smart chunking)`);

        // Process each chunk
        const allOrderedStops = [];
        const allRouteResults = []; // Store route results for display
        let totalDistance = 0;
        let totalDuration = 0;
        let currentOrigin = origin;
        let currentOriginCoords = originCoords;

        // Colors for different chunks
        const chunkColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

        // Track the remaining waypoints for dynamic connection point selection
        let remainingWaypoints = sortedWaypoints.slice();
        let processedWaypoints = [];

        for (let i = 0; i < chunks.length; i++) {
            const isLastChunk = i === chunks.length - 1;

            // Get current chunk waypoints (excluding the connection point for non-last chunks)
            let chunkWaypoints = chunks[i];
            let chunkDest, chunkDestCoords, connectionWaypoint;

            if (isLastChunk) {
                // Last chunk uses the actual destination
                chunkDest = destination;
                chunkDestCoords = destCoords;
            } else {
                // Find the best connection point from the next chunk
                // This is the waypoint in the next chunk that's most "on the way" to the destination
                const nextChunk = chunks[i + 1];
                connectionWaypoint = this.findBestConnectionPoint(
                    chunkWaypoints,
                    nextChunk,
                    currentOriginCoords,
                    destCoords
                );

                chunkDest = connectionWaypoint.address;
                chunkDestCoords = connectionWaypoint.location;

                // Remove connection waypoint from current chunk's waypoints (it becomes the destination)
                chunkWaypoints = chunkWaypoints.filter(wp => wp !== connectionWaypoint);

                console.log(`Chunk ${i + 1} connection point: ${connectionWaypoint.address}`);
            }

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

                // Store route result for map display
                if (chunkResult.googleRoute) {
                    allRouteResults.push({
                        route: chunkResult.googleRoute,
                        color: chunkColors[i % chunkColors.length]
                    });
                }

                // Add stops to our collection (skip the "start point" for non-first chunks)
                const stopsToAdd = i === 0 ? chunkResult.stops : chunkResult.stops.slice(1);

                // Don't add the destination stop for non-last chunks (it becomes the next origin)
                const finalStops = isLastChunk ? stopsToAdd : stopsToAdd.slice(0, -1);

                allOrderedStops.push(...finalStops);

                // Accumulate distance and duration
                totalDistance += chunkResult.totalDistanceMeters;
                totalDuration += chunkResult.totalDurationSeconds;

                // Prepare for next chunk - use the connection waypoint as the new origin
                if (!isLastChunk && connectionWaypoint) {
                    currentOrigin = connectionWaypoint.address;
                    currentOriginCoords = connectionWaypoint.location;
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

        // Display all routes on map
        this.displayChunkedRoutes(allRouteResults, allOrderedStops);

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

    // Add markers for all stops and fit map bounds
    addMarkersForStops(stops) {
        if (!this.map || stops.length === 0) return;

        const bounds = new google.maps.LatLngBounds();

        stops.forEach((stop, index) => {
            if (stop.location) {
                const position = new google.maps.LatLng(stop.location.lat, stop.location.lng);
                bounds.extend(position);

                // Determine marker color
                let color;
                if (index === 0) {
                    color = '#22c55e'; // Green for start
                } else if (index === stops.length - 1) {
                    color = '#ef4444'; // Red for end
                } else {
                    color = '#6366f1'; // Blue for waypoints
                }

                // Add marker with stop number
                this.addMarker(
                    position,
                    String(index + 1),
                    stop.name + ' - ' + stop.address,
                    color
                );
            }
        });

        // Fit map to show all markers
        this.map.fitBounds(bounds);
    }

    // Display all chunked routes and markers on map
    displayChunkedRoutes(routeResults, allStops) {
        if (!this.map) return;

        // Display each route segment with its own renderer
        routeResults.forEach((routeData, index) => {
            if (index === 0 && this.directionsRenderer) {
                // Use main renderer for first route
                this.directionsRenderer.setOptions({
                    suppressMarkers: true, // We'll add our own markers
                    polylineOptions: {
                        strokeColor: routeData.color,
                        strokeWeight: 5,
                        strokeOpacity: 0.9
                    }
                });
                this.directionsRenderer.setDirections(routeData.route);
            } else {
                // Create additional renderer for other routes
                const renderer = this.createAdditionalRenderer(routeData.color);
                if (renderer) {
                    renderer.setDirections(routeData.route);
                }
            }
        });

        // Add markers for all stops
        const bounds = new google.maps.LatLngBounds();

        allStops.forEach((stop, index) => {
            if (stop.location) {
                const position = new google.maps.LatLng(stop.location.lat, stop.location.lng);
                bounds.extend(position);

                // Determine marker color
                let color;
                if (index === 0) {
                    color = '#22c55e'; // Green for start
                } else if (index === allStops.length - 1) {
                    color = '#ef4444'; // Red for end
                } else {
                    color = '#6366f1'; // Blue for waypoints
                }

                // Add marker with stop number
                this.addMarker(
                    position,
                    String(index + 1),
                    stop.name + ' - ' + stop.address,
                    color
                );
            }
        });

        // Fit map to show all markers
        if (allStops.length > 0) {
            this.map.fitBounds(bounds);
        }
    }

    // ==========================================
    // ROUTE STITCHING (UNIFIED VISUALIZATION)
    // ==========================================

    /**
     * Stitch multiple route segments into a single unified route
     * Solves the visual fragmentation problem with chunked routes
     * @param {Array} routeResults - Array of route results from chunked calculation
     * @returns {Object} Unified DirectionsResult-like object for display
     */
    stitchRouteSegments(routeResults) {
        if (!routeResults || routeResults.length === 0) return null;

        console.log(`Stitching ${routeResults.length} route segments...`);

        // Create combined result structure
        const combinedResult = {
            routes: [{
                legs: [],
                overview_path: [],
                bounds: null
            }]
        };

        let totalDuration = 0;
        let totalDistance = 0;
        let bounds = null;

        // Process each route segment
        routeResults.forEach((segment, index) => {
            const googleRoute = segment.route?.routes?.[0] || segment.googleRoute?.routes?.[0];
            if (!googleRoute) {
                console.warn(`Segment ${index} has no valid Google route data`);
                return;
            }

            // Merge legs
            if (googleRoute.legs) {
                combinedResult.routes[0].legs.push(...googleRoute.legs);

                // Sum distance and duration
                googleRoute.legs.forEach(leg => {
                    totalDuration += leg.duration?.value || 0;
                    totalDistance += leg.distance?.value || 0;
                });
            }

            // Merge overview_path (polyline points)
            if (googleRoute.overview_path) {
                combinedResult.routes[0].overview_path.push(...googleRoute.overview_path);
            }

            // Merge bounds
            if (googleRoute.bounds) {
                if (!bounds) {
                    bounds = new google.maps.LatLngBounds(
                        googleRoute.bounds.getSouthWest(),
                        googleRoute.bounds.getNorthEast()
                    );
                } else {
                    bounds.union(googleRoute.bounds);
                }
            }
        });

        combinedResult.routes[0].bounds = bounds;

        // Add metadata
        combinedResult.status = 'OK';
        combinedResult.totalDistanceMeters = totalDistance;
        combinedResult.totalDurationSeconds = totalDuration;
        combinedResult.segmentCount = routeResults.length;

        console.log(`Route stitched: ${(totalDistance / 1000).toFixed(1)}km, ${Math.round(totalDuration / 60)}min`);

        return combinedResult;
    }

    /**
     * Display a unified/stitched route on the map
     * Creates a clean, single-color route display
     * @param {Object} stitchedRoute - Result from stitchRouteSegments
     * @param {Array} allStops - All stops to display as markers
     * @param {Object} options - Display options
     */
    displayUnifiedRoute(stitchedRoute, allStops, options = {}) {
        if (!this.map || !stitchedRoute) return;

        const {
            routeColor = '#4f46e5', // Indigo - professional single color
            routeWeight = 6,
            routeOpacity = 0.85,
            showMarkers = true
        } = options;

        // Clear existing display
        this.clearMapDisplay();

        // Create a single polyline from the stitched path
        if (stitchedRoute.routes[0].overview_path.length > 0) {
            const routePolyline = new google.maps.Polyline({
                path: stitchedRoute.routes[0].overview_path,
                geodesic: true,
                strokeColor: routeColor,
                strokeWeight: routeWeight,
                strokeOpacity: routeOpacity,
                map: this.map
            });

            // Store for cleanup (add to markers array for simplicity)
            this.additionalRenderers.push({
                setMap: (map) => routePolyline.setMap(map)
            });
        }

        // Add markers for stops
        if (showMarkers && allStops && allStops.length > 0) {
            const bounds = new google.maps.LatLngBounds();

            allStops.forEach((stop, index) => {
                if (!stop.location) return;

                const position = new google.maps.LatLng(stop.location.lat, stop.location.lng);
                bounds.extend(position);

                // Determine marker color
                let color;
                if (index === 0) {
                    color = '#22c55e'; // Green for start
                } else if (index === allStops.length - 1) {
                    color = '#ef4444'; // Red for end
                } else {
                    color = '#6366f1'; // Blue for waypoints
                }

                this.addMarker(
                    position,
                    String(index + 1),
                    stop.name + ' - ' + (stop.address || ''),
                    color
                );
            });

            // Fit map to bounds
            this.map.fitBounds(bounds);
        } else if (stitchedRoute.routes[0].bounds) {
            // Use route bounds if no stops provided
            this.map.fitBounds(stitchedRoute.routes[0].bounds);
        }

        console.log('Unified route displayed successfully');
    }

    /**
     * Enhanced route display that automatically stitches chunked routes
     * Use this instead of displayChunkedRoutes for better visualization
     * @param {Array} routeResults - Array from calculateChunkedRoute
     * @param {Array} allStops - All stops with location data
     */
    displaySmartRoute(routeResults, allStops) {
        if (!routeResults || routeResults.length === 0) {
            console.warn('No route results to display');
            return;
        }

        // If single segment, use standard display
        if (routeResults.length === 1) {
            this.displayChunkedRoutes(routeResults, allStops);
            return;
        }

        // Multiple segments - stitch and display unified
        const stitchedRoute = this.stitchRouteSegments(routeResults);

        if (stitchedRoute) {
            this.displayUnifiedRoute(stitchedRoute, allStops);
        } else {
            // Fallback to chunked display
            console.warn('Stitching failed, falling back to chunked display');
            this.displayChunkedRoutes(routeResults, allStops);
        }
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

    // Create smart chunks that consider geographic clustering and optimal connection points
    createSmartChunks(sortedWaypoints, chunkSize, originCoords, destCoords) {
        if (sortedWaypoints.length <= chunkSize) {
            return [sortedWaypoints];
        }

        const chunks = [];
        let remaining = [...sortedWaypoints];

        while (remaining.length > 0) {
            if (remaining.length <= chunkSize) {
                // Last chunk - take all remaining
                chunks.push(remaining);
                break;
            }

            // Take up to chunkSize waypoints
            // But try to find a natural break point based on distance gaps
            const chunk = remaining.slice(0, chunkSize);

            // Find the best break point within the last few waypoints of the chunk
            // Look for the largest distance gap which indicates a natural cluster boundary
            const breakSearchStart = Math.max(0, chunkSize - 5);
            let bestBreakIndex = chunkSize - 1;
            let maxGap = 0;

            for (let i = breakSearchStart; i < chunkSize - 1 && i < remaining.length - 1; i++) {
                const gap = this.calculateDistance(
                    remaining[i].location.lat, remaining[i].location.lng,
                    remaining[i + 1].location.lat, remaining[i + 1].location.lng
                );
                if (gap > maxGap) {
                    maxGap = gap;
                    bestBreakIndex = i;
                }
            }

            // Use the break point (add 1 because we want to include the waypoint at bestBreakIndex)
            const actualChunkSize = bestBreakIndex + 1;
            chunks.push(remaining.slice(0, actualChunkSize));
            remaining = remaining.slice(actualChunkSize);
        }

        return chunks;
    }

    // Find the best connection point between current chunk and next chunk
    // This waypoint will serve as the destination for the current chunk and origin for the next
    findBestConnectionPoint(currentChunk, nextChunk, currentOriginCoords, finalDestCoords) {
        if (!nextChunk || nextChunk.length === 0) {
            return currentChunk[currentChunk.length - 1];
        }

        // Calculate the centroid of the current chunk (approximate ending area)
        const currentCentroid = this.calculateCentroid(currentChunk);

        // Find the waypoint in the combined chunks that best serves as a transition point
        // We want a point that:
        // 1. Is relatively close to the current chunk's general area
        // 2. Is a good starting point for reaching the rest of the next chunk
        // 3. Makes progress towards the final destination

        let bestWaypoint = nextChunk[0];
        let bestScore = Infinity;

        // Look at waypoints from both current chunk (last few) and next chunk (first few)
        const candidates = [
            ...currentChunk.slice(-3),  // Last 3 from current chunk
            ...nextChunk.slice(0, 5)     // First 5 from next chunk
        ];

        for (const wp of candidates) {
            // Distance from current chunk centroid
            const distFromCurrent = this.calculateDistance(
                currentCentroid.lat, currentCentroid.lng,
                wp.location.lat, wp.location.lng
            );

            // Distance to next chunk centroid (how well it can reach the next chunk)
            const nextCentroid = this.calculateCentroid(nextChunk.filter(w => w !== wp));
            const distToNext = this.calculateDistance(
                wp.location.lat, wp.location.lng,
                nextCentroid.lat, nextCentroid.lng
            );

            // Distance to final destination (progress towards goal)
            const distToFinal = this.calculateDistance(
                wp.location.lat, wp.location.lng,
                finalDestCoords.lat, finalDestCoords.lng
            );

            // Score: balance between being reachable and being a good starting point
            // Lower score is better
            const score = distFromCurrent * 0.3 + distToNext * 0.4 + distToFinal * 0.3;

            if (score < bestScore) {
                bestScore = score;
                bestWaypoint = wp;
            }
        }

        return bestWaypoint;
    }

    // Calculate the centroid (geographic center) of a set of waypoints
    calculateCentroid(waypoints) {
        if (waypoints.length === 0) {
            return { lat: 0, lng: 0 };
        }

        let sumLat = 0;
        let sumLng = 0;

        for (const wp of waypoints) {
            sumLat += wp.location.lat;
            sumLng += wp.location.lng;
        }

        return {
            lat: sumLat / waypoints.length,
            lng: sumLng / waypoints.length
        };
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

    // Calculate perpendicular distance from a point to a line segment (route)
    calculateDistanceToRouteLine(point, lineStart, lineEnd) {
        // Vector from lineStart to lineEnd
        const dx = lineEnd.lng - lineStart.lng;
        const dy = lineEnd.lat - lineStart.lat;

        // Length squared of line segment
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // Start and end are the same point
            return this.calculateDistance(point.lat, point.lng, lineStart.lat, lineStart.lng);
        }

        // Calculate projection parameter t (clamped to [0,1] for segment)
        const t = Math.max(0, Math.min(1,
            ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lengthSquared
        ));

        // Find nearest point on line segment
        const nearestLng = lineStart.lng + t * dx;
        const nearestLat = lineStart.lat + t * dy;

        // Return distance to nearest point on segment
        return this.calculateDistance(point.lat, point.lng, nearestLat, nearestLng);
    }

    // Check if a student location is roughly in the direction of the bus route
    isOnRouteDirection(studentCoords, startCoords, endCoords) {
        // Calculate route direction vector
        const routeDx = endCoords.lng - startCoords.lng;
        const routeDy = endCoords.lat - startCoords.lat;

        // Calculate student direction vector from start
        const studentDx = studentCoords.lng - startCoords.lng;
        const studentDy = studentCoords.lat - startCoords.lat;

        // Dot product to check if generally in same direction
        const dotProduct = routeDx * studentDx + routeDy * studentDy;

        // Student is "on route direction" if dot product is positive (same general direction)
        // or if they're very close to start
        const distToStart = this.calculateDistance(
            studentCoords.lat, studentCoords.lng,
            startCoords.lat, startCoords.lng
        );

        return dotProduct >= 0 || distToStart < 5; // Within 5km of start is always OK
    }

    // Find the best bus for a student address - IMPROVED ALGORITHM
    async findBestBusForAddress(studentAddress) {
        const MAX_BUS_CAPACITY = 50; // Maximum students per bus

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
        let bestScore = Infinity;
        let bestDetails = {};

        // Check each bus
        for (const bus of buses) {
            if (!bus.startLocation && !bus.endLocation) continue;

            // Check bus capacity first
            const busStudents = window.studentManager ? window.studentManager.getStudentsByBus(bus.id) : [];
            if (busStudents.length >= MAX_BUS_CAPACITY) {
                console.log(`Bus "${bus.name}" is full (${busStudents.length}/${MAX_BUS_CAPACITY}), skipping`);
                continue; // Skip full buses
            }

            // 1. Get start and end coordinates
            let startCoords = null;
            let endCoords = null;

            if (bus.startLocation) {
                startCoords = await this.geocodeAddress(bus.startLocation);
            }
            if (bus.endLocation) {
                endCoords = await this.geocodeAddress(bus.endLocation);
            }

            // 2. Calculate distances to start/end points
            let distToStart = Infinity;
            let distToEnd = Infinity;

            if (startCoords) {
                distToStart = this.calculateDistance(
                    studentCoords.lat, studentCoords.lng,
                    startCoords.lat, startCoords.lng
                );
            }
            if (endCoords) {
                distToEnd = this.calculateDistance(
                    studentCoords.lat, studentCoords.lng,
                    endCoords.lat, endCoords.lng
                );
            }

            // 3. Calculate distance to route line (perpendicular distance)
            let distToRouteLine = Infinity;
            let onRouteDirection = true;
            if (startCoords && endCoords) {
                distToRouteLine = this.calculateDistanceToRouteLine(studentCoords, startCoords, endCoords);
                onRouteDirection = this.isOnRouteDirection(studentCoords, startCoords, endCoords);
            }

            // 4. Check ALL unique student addresses on this bus for clustering
            // (busStudents already retrieved above for capacity check)

            // Get unique addresses to reduce geocoding calls
            const uniqueAddresses = new Set();
            for (const existingStudent of busStudents) {
                uniqueAddresses.add(existingStudent.address);
            }

            let nearestStudentDist = Infinity;
            let studentsInSameArea = 0; // Count students within 10km

            for (const address of uniqueAddresses) {
                const existingCoords = await this.geocodeAddress(address);
                if (existingCoords) {
                    const dist = this.calculateDistance(
                        studentCoords.lat, studentCoords.lng,
                        existingCoords.lat, existingCoords.lng
                    );
                    nearestStudentDist = Math.min(nearestStudentDist, dist);
                    if (dist < 10) { // Within 10km
                        studentsInSameArea++;
                    }
                }
            }

            // 5. Calculate combined score (lower is better)
            let busScore = Infinity;

            // Scoring factors:
            // - Clustering: If there are students nearby, this is very important
            // - Route alignment: Is the student on/near the route path?
            // - Distance to endpoints: Fallback metric

            const minEndpointDist = Math.min(distToStart, distToEnd);

            if (nearestStudentDist < Infinity) {
                // There are existing students on this bus

                // Strong clustering bonus: students living close together should be on same bus
                const clusterScore = nearestStudentDist * 0.2; // Very strong weight for clustering

                // Bonus for having multiple students in the same area
                const areaBonus = studentsInSameArea > 0 ? -studentsInSameArea * 0.5 : 0;

                // Route alignment score (only if both endpoints exist)
                let routeScore = minEndpointDist;
                if (distToRouteLine < Infinity) {
                    // Bonus for being close to the route line
                    routeScore = Math.min(routeScore, distToRouteLine * 0.7);

                    // Penalty if student is not in the route direction
                    if (!onRouteDirection) {
                        routeScore += 5; // Add 5km penalty for wrong direction
                    }
                }

                // Combined score: prioritize clustering, then route alignment
                busScore = Math.min(clusterScore, routeScore) + areaBonus;

            } else {
                // No students yet on this bus - use route-based scoring
                if (distToRouteLine < Infinity) {
                    busScore = distToRouteLine * 0.8;
                    if (!onRouteDirection) {
                        busScore += 5; // Penalty for wrong direction
                    }
                } else {
                    busScore = minEndpointDist;
                }
            }

            // Track best bus
            if (busScore < bestScore) {
                bestScore = busScore;
                bestBus = bus;
                bestDetails = {
                    nearestStudentDist,
                    studentsInSameArea,
                    distToRouteLine,
                    onRouteDirection,
                    distToStart,
                    distToEnd,
                    currentCapacity: busStudents.length,
                    maxCapacity: MAX_BUS_CAPACITY
                };
            }
        }

        if (bestBus) {
            console.log(`Best bus for "${studentAddress}": ${bestBus.name} (score: ${bestScore.toFixed(2)}, ` +
                `capacity: ${bestDetails.currentCapacity}/${bestDetails.maxCapacity}, ` +
                `nearest student: ${bestDetails.nearestStudentDist.toFixed(2)}km, ` +
                `students in area: ${bestDetails.studentsInSameArea}, ` +
                `on route: ${bestDetails.onRouteDirection})`);
        }

        return bestBus;
    }

    // ==========================================
    // K-MEANS CLUSTERING ALGORITHM
    // ==========================================

    /**
     * K-Means clustering algorithm for geographic grouping
     * Groups students into K clusters based on their coordinates
     * @param {Array} points - Array of {lat, lng, data} objects
     * @param {number} k - Number of clusters
     * @param {number} maxIterations - Maximum iterations (default 100)
     * @returns {Array} Array of clusters, each containing points
     */
    kMeansClustering(points, k, maxIterations = 100) {
        if (points.length === 0 || k <= 0) return [];
        if (points.length <= k) {
            // Each point is its own cluster
            return points.map(p => ({ centroid: { lat: p.lat, lng: p.lng }, points: [p] }));
        }

        // Initialize centroids using K-Means++ for better starting positions
        let centroids = this.initializeCentroidsKMeansPlusPlus(points, k);

        let clusters = [];
        let previousAssignments = [];

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // Step 1: Assign each point to nearest centroid
            clusters = Array.from({ length: k }, () => ({ points: [] }));

            const currentAssignments = [];
            for (const point of points) {
                let minDist = Infinity;
                let nearestCluster = 0;

                for (let i = 0; i < centroids.length; i++) {
                    const dist = this.calculateDistance(
                        point.lat, point.lng,
                        centroids[i].lat, centroids[i].lng
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        nearestCluster = i;
                    }
                }

                clusters[nearestCluster].points.push(point);
                currentAssignments.push(nearestCluster);
            }

            // Check for convergence
            if (JSON.stringify(currentAssignments) === JSON.stringify(previousAssignments)) {
                console.log(`K-Means converged after ${iteration + 1} iterations`);
                break;
            }
            previousAssignments = currentAssignments;

            // Step 2: Update centroids
            for (let i = 0; i < k; i++) {
                if (clusters[i].points.length > 0) {
                    const sumLat = clusters[i].points.reduce((sum, p) => sum + p.lat, 0);
                    const sumLng = clusters[i].points.reduce((sum, p) => sum + p.lng, 0);
                    centroids[i] = {
                        lat: sumLat / clusters[i].points.length,
                        lng: sumLng / clusters[i].points.length
                    };
                }
            }
        }

        // Add centroids to cluster objects
        for (let i = 0; i < k; i++) {
            clusters[i].centroid = centroids[i];
        }

        // Filter out empty clusters
        return clusters.filter(c => c.points.length > 0);
    }

    /**
     * K-Means++ initialization - choose initial centroids spread apart
     */
    initializeCentroidsKMeansPlusPlus(points, k) {
        const centroids = [];

        // First centroid: random point
        const firstIndex = Math.floor(Math.random() * points.length);
        centroids.push({ lat: points[firstIndex].lat, lng: points[firstIndex].lng });

        // Remaining centroids: weighted probability based on distance
        while (centroids.length < k) {
            const distances = points.map(point => {
                let minDist = Infinity;
                for (const centroid of centroids) {
                    const dist = this.calculateDistance(point.lat, point.lng, centroid.lat, centroid.lng);
                    minDist = Math.min(minDist, dist);
                }
                return minDist * minDist; // Square for weighted probability
            });

            const totalDist = distances.reduce((sum, d) => sum + d, 0);
            let random = Math.random() * totalDist;

            for (let i = 0; i < points.length; i++) {
                random -= distances[i];
                if (random <= 0) {
                    centroids.push({ lat: points[i].lat, lng: points[i].lng });
                    break;
                }
            }
        }

        return centroids;
    }

    /**
     * Determine optimal number of clusters using the Elbow Method
     * Returns suggested K based on student count and bus count
     */
    calculateOptimalK(studentCount, busCount, maxStudentsPerBus = 50) {
        // Minimum clusters = number of buses
        // Maximum clusters = studentCount / minStudentsPerCluster
        const minStudentsPerCluster = 3;
        const maxK = Math.floor(studentCount / minStudentsPerCluster);

        // Calculate required buses based on capacity
        const requiredBuses = Math.ceil(studentCount / maxStudentsPerBus);

        // K should be at least the number of buses, but could be more for better geographic grouping
        // Use 1.5x buses as a good balance
        const suggestedK = Math.min(
            Math.max(busCount, requiredBuses, Math.ceil(busCount * 1.5)),
            maxK
        );

        console.log(`Optimal K calculation: students=${studentCount}, buses=${busCount}, suggested K=${suggestedK}`);
        return suggestedK;
    }

    // ==========================================
    // INSERTION COST HEURISTIC
    // ==========================================

    /**
     * Calculate the cost of inserting a new point into an existing route
     * Uses the "cheapest insertion" heuristic
     * @param {Array} route - Current route as array of {lat, lng} points
     * @param {Object} newPoint - Point to insert {lat, lng}
     * @param {Object} origin - Route origin {lat, lng}
     * @param {Object} destination - Route destination {lat, lng}
     * @returns {Object} { cost, insertIndex, newRoute }
     */
    calculateInsertionCost(route, newPoint, origin, destination) {
        let bestCost = Infinity;
        let bestIndex = 0;

        // Build full path: origin -> route points -> destination
        const fullPath = [origin, ...route, destination];

        // Try inserting at each position
        for (let i = 0; i < fullPath.length - 1; i++) {
            const prevPoint = fullPath[i];
            const nextPoint = fullPath[i + 1];

            // Original distance between prev and next
            const originalDist = this.calculateDistance(
                prevPoint.lat, prevPoint.lng,
                nextPoint.lat, nextPoint.lng
            );

            // New distance: prev -> newPoint -> next
            const distToNew = this.calculateDistance(
                prevPoint.lat, prevPoint.lng,
                newPoint.lat, newPoint.lng
            );
            const distFromNew = this.calculateDistance(
                newPoint.lat, newPoint.lng,
                nextPoint.lat, nextPoint.lng
            );

            const detour = (distToNew + distFromNew) - originalDist;

            if (detour < bestCost) {
                bestCost = detour;
                bestIndex = i; // Insert after position i in route (0 = after origin)
            }
        }

        // Build the new route with the point inserted
        const newRoute = [...route];
        newRoute.splice(bestIndex, 0, newPoint);

        return {
            cost: bestCost,
            insertIndex: bestIndex,
            newRoute: newRoute
        };
    }

    /**
     * Calculate total route distance
     */
    calculateTotalRouteDistance(route, origin, destination) {
        const fullPath = [origin, ...route, destination];
        let total = 0;

        for (let i = 0; i < fullPath.length - 1; i++) {
            total += this.calculateDistance(
                fullPath[i].lat, fullPath[i].lng,
                fullPath[i + 1].lat, fullPath[i + 1].lng
            );
        }

        return total;
    }

    /**
     * Estimate route time based on distance (rough estimate)
     * Assumes average speed of 40 km/h for urban/suburban routes
     */
    estimateRouteTimeMinutes(distanceKm, numStops = 0) {
        const avgSpeedKmh = 40;
        const stopTimeMinutes = 2; // Time per stop

        const driveTimeMinutes = (distanceKm / avgSpeedKmh) * 60;
        const totalStopTime = numStops * stopTimeMinutes;

        return driveTimeMinutes + totalStopTime;
    }

    // ==========================================
    // 2-OPT LOCAL SEARCH (TSP IMPROVEMENT)
    // ==========================================

    /**
     * 2-opt algorithm for route optimization
     * Repeatedly reverses segments of the route to find improvements
     * This is the classic TSP local search algorithm
     * @param {Array} route - Array of points with {lat, lng}
     * @param {Object} origin - Start point
     * @param {Object} destination - End point
     * @returns {Array} Optimized route
     */
    twoOptOptimize(route, origin, destination) {
        if (route.length < 3) return [...route];

        let improved = true;
        let currentRoute = [...route];
        let iterations = 0;
        const maxIterations = 100;

        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;

            for (let i = 0; i < currentRoute.length - 1; i++) {
                for (let j = i + 2; j < currentRoute.length; j++) {
                    // Calculate current distance for edges (i, i+1) and (j, j+1)
                    const pointI = i === 0 ? origin : currentRoute[i - 1];
                    const pointI1 = currentRoute[i];
                    const pointJ = currentRoute[j];
                    const pointJ1 = j === currentRoute.length - 1 ? destination : currentRoute[j + 1];

                    const currentDist =
                        this.calculateDistance(pointI.lat, pointI.lng, pointI1.lat, pointI1.lng) +
                        this.calculateDistance(pointJ.lat, pointJ.lng, pointJ1.lat, pointJ1.lng);

                    // Calculate new distance if we reverse the segment between i and j
                    const newDist =
                        this.calculateDistance(pointI.lat, pointI.lng, pointJ.lat, pointJ.lng) +
                        this.calculateDistance(pointI1.lat, pointI1.lng, pointJ1.lat, pointJ1.lng);

                    if (newDist < currentDist - 0.01) { // Small epsilon to avoid floating point issues
                        // Reverse the segment between i and j (inclusive)
                        const reversed = currentRoute.slice(i, j + 1).reverse();
                        currentRoute = [
                            ...currentRoute.slice(0, i),
                            ...reversed,
                            ...currentRoute.slice(j + 1)
                        ];
                        improved = true;
                    }
                }
            }
        }

        if (iterations > 1) {
            console.log(`2-opt optimized route in ${iterations} iterations`);
        }

        return currentRoute;
    }

    /**
     * Calculate the total improvement from 2-opt optimization
     */
    calculateTwoOptImprovement(originalRoute, optimizedRoute, origin, destination) {
        const originalDist = this.calculateTotalRouteDistance(originalRoute, origin, destination);
        const optimizedDist = this.calculateTotalRouteDistance(optimizedRoute, origin, destination);
        return {
            originalDistance: originalDist,
            optimizedDistance: optimizedDist,
            improvement: originalDist - optimizedDist,
            improvementPercent: ((originalDist - optimizedDist) / originalDist * 100).toFixed(1)
        };
    }

    // ==========================================
    // INTER-BUS SWAP OPTIMIZATION
    // ==========================================

    /**
     * Try to improve total distance by swapping students between buses
     * @param {Map} assignments - Map of busId -> {bus, students, route}
     * @param {number} maxIterations - Maximum swap attempts
     * @returns {Object} { improved: boolean, swapCount: number }
     */
    interBusSwapOptimization(assignments, maxIterations = 50) {
        let totalSwaps = 0;
        let improved = true;
        let iteration = 0;

        while (improved && iteration < maxIterations) {
            improved = false;
            iteration++;

            const busIds = Array.from(assignments.keys());

            // Try swapping students between each pair of buses
            for (let i = 0; i < busIds.length; i++) {
                for (let j = i + 1; j < busIds.length; j++) {
                    const busA = assignments.get(busIds[i]);
                    const busB = assignments.get(busIds[j]);

                    if (!busA.students.length || !busB.students.length) continue;

                    // Try each student from busA with each student from busB
                    for (let a = 0; a < busA.route.length; a++) {
                        for (let b = 0; b < busB.route.length; b++) {
                            const studentA = busA.route[a];
                            const studentB = busB.route[b];

                            // Calculate current total distance
                            const currentDistA = this.calculateTotalRouteDistance(
                                busA.route, busA.bus.origin, busA.bus.destination
                            );
                            const currentDistB = this.calculateTotalRouteDistance(
                                busB.route, busB.bus.origin, busB.bus.destination
                            );
                            const currentTotal = currentDistA + currentDistB;

                            // Create new routes with swapped students
                            const newRouteA = [...busA.route];
                            const newRouteB = [...busB.route];
                            newRouteA[a] = studentB;
                            newRouteB[b] = studentA;

                            // Optimize new routes with 2-opt
                            const optimizedRouteA = this.twoOptOptimize(
                                newRouteA, busA.bus.origin, busA.bus.destination
                            );
                            const optimizedRouteB = this.twoOptOptimize(
                                newRouteB, busB.bus.origin, busB.bus.destination
                            );

                            // Calculate new total distance
                            const newDistA = this.calculateTotalRouteDistance(
                                optimizedRouteA, busA.bus.origin, busA.bus.destination
                            );
                            const newDistB = this.calculateTotalRouteDistance(
                                optimizedRouteB, busB.bus.origin, busB.bus.destination
                            );
                            const newTotal = newDistA + newDistB;

                            // If improvement found, apply the swap
                            if (newTotal < currentTotal - 0.5) { // At least 0.5km improvement
                                busA.route = optimizedRouteA;
                                busB.route = optimizedRouteB;

                                // Swap in students arrays too
                                const tempStudent = busA.students[a];
                                busA.students[a] = busB.students[b];
                                busB.students[b] = tempStudent;

                                totalSwaps++;
                                improved = true;
                                console.log(`Swap improvement: ${(currentTotal - newTotal).toFixed(2)}km ` +
                                    `(${busA.bus.bus.name} <-> ${busB.bus.bus.name})`);
                            }
                        }
                    }
                }
            }
        }

        return { improved: totalSwaps > 0, swapCount: totalSwaps, iterations: iteration };
    }

    /**
     * Try relocating a student from one bus to another (not swap, just move)
     * Useful when buses have uneven loads
     */
    relocateOptimization(assignments, maxCapacity = 50) {
        let totalRelocations = 0;
        let improved = true;

        while (improved) {
            improved = false;

            const busIds = Array.from(assignments.keys());

            for (const sourceBusId of busIds) {
                const sourceBus = assignments.get(sourceBusId);
                if (sourceBus.route.length <= 1) continue; // Don't leave bus empty

                for (let s = 0; s < sourceBus.route.length; s++) {
                    const studentPoint = sourceBus.route[s];

                    // Find best target bus for this student
                    let bestTarget = null;
                    let bestImprovement = 0;

                    for (const targetBusId of busIds) {
                        if (targetBusId === sourceBusId) continue;

                        const targetBus = assignments.get(targetBusId);
                        if (targetBus.students.length >= maxCapacity) continue;

                        // Calculate cost of removing from source
                        const sourceRouteCurrent = this.calculateTotalRouteDistance(
                            sourceBus.route, sourceBus.bus.origin, sourceBus.bus.destination
                        );
                        const sourceRouteWithout = [...sourceBus.route];
                        sourceRouteWithout.splice(s, 1);
                        const sourceRouteNew = this.calculateTotalRouteDistance(
                            sourceRouteWithout, sourceBus.bus.origin, sourceBus.bus.destination
                        );

                        // Calculate cost of adding to target
                        const targetRouteCurrent = this.calculateTotalRouteDistance(
                            targetBus.route, targetBus.bus.origin, targetBus.bus.destination
                        );
                        const insertion = this.calculateInsertionCost(
                            targetBus.route, studentPoint, targetBus.bus.origin, targetBus.bus.destination
                        );
                        const targetRouteNew = this.calculateTotalRouteDistance(
                            insertion.newRoute, targetBus.bus.origin, targetBus.bus.destination
                        );

                        // Total improvement
                        const totalImprovement = (sourceRouteCurrent + targetRouteCurrent) -
                            (sourceRouteNew + targetRouteNew);

                        if (totalImprovement > bestImprovement + 1) { // At least 1km improvement
                            bestImprovement = totalImprovement;
                            bestTarget = {
                                bus: targetBus,
                                insertion: insertion,
                                sourceRouteWithout: sourceRouteWithout
                            };
                        }
                    }

                    if (bestTarget) {
                        // Apply relocation
                        const student = sourceBus.students[s];

                        sourceBus.route = bestTarget.sourceRouteWithout;
                        sourceBus.students.splice(s, 1);

                        bestTarget.bus.route = bestTarget.insertion.newRoute;
                        bestTarget.bus.students.push(student);

                        totalRelocations++;
                        improved = true;
                        console.log(`Relocated student: ${bestImprovement.toFixed(2)}km improvement`);
                        break; // Restart search after each relocation
                    }
                }
                if (improved) break;
            }
        }

        return { relocations: totalRelocations };
    }

    // ==========================================
    // TIME WINDOW CONSTRAINTS
    // ==========================================

    /**
     * Check if adding a student violates time constraints
     * @param {Array} route - Current route
     * @param {Object} newPoint - Point to add
     * @param {Object} origin - Route origin
     * @param {Object} destination - Route destination
     * @param {Object} constraints - Time constraints
     * @returns {Object} { valid, reason, estimatedTime }
     */
    checkTimeConstraints(route, newPoint, origin, destination, constraints = {}) {
        const {
            maxRideTimeMinutes = 60,      // Max time any student spends on bus
            maxTotalRouteMinutes = 90,    // Max total route time
            schoolStartTime = null        // Optional: school start time
        } = constraints;

        // Calculate insertion
        const insertion = this.calculateInsertionCost(route, newPoint, origin, destination);

        // Calculate new total route distance
        const newTotalDistance = this.calculateTotalRouteDistance(
            insertion.newRoute, origin, destination
        );

        // Estimate new route time
        const newRouteTime = this.estimateRouteTimeMinutes(
            newTotalDistance, insertion.newRoute.length
        );

        // Check total route time
        if (newRouteTime > maxTotalRouteMinutes) {
            return {
                valid: false,
                reason: `זמן מסלול כולל (${newRouteTime.toFixed(0)} דק') חורג מהמקסימום (${maxTotalRouteMinutes} דק')`,
                estimatedTime: newRouteTime
            };
        }

        // Check max ride time for first student
        // First student rides the entire route, so their time = total route time
        if (newRouteTime > maxRideTimeMinutes && insertion.newRoute.length > 1) {
            return {
                valid: false,
                reason: `זמן נסיעה לתלמיד ראשון (${newRouteTime.toFixed(0)} דק') חורג מהמקסימום (${maxRideTimeMinutes} דק')`,
                estimatedTime: newRouteTime
            };
        }

        return {
            valid: true,
            reason: null,
            estimatedTime: newRouteTime,
            insertion: insertion
        };
    }

    // ==========================================
    // SMART BATCH ASSIGNMENT ALGORITHM (V2)
    // ==========================================

    /**
     * Smart batch assignment V2 - uses K-Means clustering and insertion heuristic
     *
     * Algorithm:
     * 1. Geocode all students
     * 2. Use K-Means to create geographic clusters
     * 3. Match clusters to buses based on route alignment
     * 4. Within each cluster, use insertion heuristic to build optimal route
     * 5. Validate time constraints
     */
    async smartBatchAssignmentV2(students, buses, progressCallback = null, constraints = {}) {
        const MAX_BUS_CAPACITY = constraints.maxBusCapacity || 50;
        const MAX_RIDE_TIME = constraints.maxRideTimeMinutes || 60;
        const MAX_ROUTE_TIME = constraints.maxTotalRouteMinutes || 90;

        if (!this.isReady()) {
            console.log('Maps not ready for smart assignment');
            return null;
        }

        if (!students || students.length === 0 || !buses || buses.length === 0) {
            console.log('No students or buses for assignment');
            return null;
        }

        console.log(`=== SMART BATCH ASSIGNMENT V2 ===`);
        console.log(`Students: ${students.length}, Buses: ${buses.length}`);
        console.log(`Constraints: maxCapacity=${MAX_BUS_CAPACITY}, maxRideTime=${MAX_RIDE_TIME}min, maxRouteTime=${MAX_ROUTE_TIME}min`);

        // ========== PHASE 1: Geocode all students ==========
        if (progressCallback) progressCallback('שלב 1: מיקום תלמידים...');

        const studentPoints = [];
        for (const student of students) {
            if (!student.address) continue;

            const coords = await this.geocodeAddress(student.address);
            if (coords) {
                studentPoints.push({
                    lat: coords.lat,
                    lng: coords.lng,
                    student: student,
                    address: student.address
                });
            }
        }

        console.log(`Geocoded ${studentPoints.length}/${students.length} students`);

        // ========== PHASE 2: Geocode bus endpoints ==========
        if (progressCallback) progressCallback('שלב 2: מיקום מסלולי אוטובוסים...');

        const busData = [];
        for (const bus of buses) {
            const startCoords = bus.startLocation ? await this.geocodeAddress(bus.startLocation) : null;
            const endCoords = bus.endLocation ? await this.geocodeAddress(bus.endLocation) : null;

            if (startCoords && endCoords) {
                busData.push({
                    bus: bus,
                    origin: startCoords,
                    destination: endCoords,
                    route: [],           // Current route points
                    assignedStudents: [],
                    totalDistance: 0,
                    estimatedTime: 0
                });
            }
        }

        console.log(`Prepared ${busData.length} buses with valid routes`);

        // ========== PHASE 3: K-Means Clustering ==========
        if (progressCallback) progressCallback('שלב 3: קיבוץ גיאוגרפי (K-Means)...');

        const optimalK = this.calculateOptimalK(studentPoints.length, busData.length, MAX_BUS_CAPACITY);
        const clusters = this.kMeansClustering(studentPoints, optimalK);

        console.log(`Created ${clusters.length} geographic clusters:`);
        clusters.forEach((c, i) => {
            console.log(`  Cluster ${i + 1}: ${c.points.length} students at (${c.centroid.lat.toFixed(4)}, ${c.centroid.lng.toFixed(4)})`);
        });

        // ========== PHASE 4: Match clusters to buses ==========
        if (progressCallback) progressCallback('שלב 4: התאמת קבוצות לאוטובוסים...');

        // Calculate affinity between each cluster and each bus
        for (const cluster of clusters) {
            cluster.busAffinities = busData.map(bd => {
                const distToRoute = this.calculateDistanceToRouteLine(
                    cluster.centroid, bd.origin, bd.destination
                );
                const onDirection = this.isOnRouteDirection(cluster.centroid, bd.origin, bd.destination);

                return {
                    busId: bd.bus.id,
                    busName: bd.bus.name,
                    distToRoute: distToRoute,
                    onDirection: onDirection,
                    score: distToRoute + (onDirection ? 0 : 15) // Penalty for wrong direction
                };
            });

            // Sort by best affinity (lowest score)
            cluster.busAffinities.sort((a, b) => a.score - b.score);
        }

        // Sort clusters by size (largest first) and distance to best bus
        clusters.sort((a, b) => {
            // Prioritize larger clusters
            const sizeDiff = b.points.length - a.points.length;
            if (Math.abs(sizeDiff) > 2) return sizeDiff;
            // Then by best affinity score
            return a.busAffinities[0].score - b.busAffinities[0].score;
        });

        // ========== PHASE 5: Assign clusters using insertion heuristic ==========
        if (progressCallback) progressCallback('שלב 5: שיוך אופטימלי עם עלות הכנסה...');

        const assignments = new Map();
        for (const bd of busData) {
            assignments.set(bd.bus.id, {
                bus: bd,
                students: [],
                route: []
            });
        }

        let unassignedStudents = [];

        for (const cluster of clusters) {
            let clusterAssigned = false;

            // Try to assign entire cluster to best matching bus
            for (const affinity of cluster.busAffinities) {
                const assignment = assignments.get(affinity.busId);
                const wouldBeCount = assignment.students.length + cluster.points.length;

                if (wouldBeCount <= MAX_BUS_CAPACITY) {
                    // Use insertion heuristic to add cluster points optimally
                    const studentsToAdd = [...cluster.points];

                    // Sort cluster students by distance to route for better insertion order
                    studentsToAdd.sort((a, b) => {
                        const distA = this.calculateDistanceToRouteLine(a, assignment.bus.origin, assignment.bus.destination);
                        const distB = this.calculateDistanceToRouteLine(b, assignment.bus.origin, assignment.bus.destination);
                        return distA - distB;
                    });

                    let allValid = true;
                    const tempRoute = [...assignment.route];
                    const tempStudents = [...assignment.students];

                    for (const point of studentsToAdd) {
                        // Check time constraints before adding
                        const timeCheck = this.checkTimeConstraints(
                            tempRoute,
                            point,
                            assignment.bus.origin,
                            assignment.bus.destination,
                            { maxRideTimeMinutes: MAX_RIDE_TIME, maxTotalRouteMinutes: MAX_ROUTE_TIME }
                        );

                        if (timeCheck.valid) {
                            tempRoute.splice(timeCheck.insertion.insertIndex, 0, point);
                            tempStudents.push(point.student);
                        } else {
                            console.log(`Time constraint violated for student in cluster: ${timeCheck.reason}`);
                            allValid = false;
                            break;
                        }
                    }

                    if (allValid || tempStudents.length > assignment.students.length) {
                        // Accept the assignment (full or partial)
                        assignment.route = tempRoute;
                        assignment.students = tempStudents;

                        const addedCount = tempStudents.length - (assignment.students.length - studentsToAdd.length);
                        console.log(`Assigned ${studentsToAdd.length} students from cluster to "${affinity.busName}" ` +
                            `(total: ${assignment.students.length}/${MAX_BUS_CAPACITY})`);

                        // Mark unassigned students from this cluster
                        if (!allValid) {
                            const assignedIds = new Set(tempStudents.map(s => s.id));
                            for (const point of studentsToAdd) {
                                if (!assignedIds.has(point.student.id)) {
                                    unassignedStudents.push(point);
                                }
                            }
                        }

                        clusterAssigned = true;
                        break;
                    }
                }
            }

            if (!clusterAssigned) {
                // Could not assign cluster - add all to unassigned
                console.log(`Could not assign cluster of ${cluster.points.length} students`);
                unassignedStudents.push(...cluster.points);
            }
        }

        // ========== PHASE 6: Handle unassigned students ==========
        if (progressCallback) progressCallback('שלב 6: טיפול בתלמידים שלא שובצו...');

        if (unassignedStudents.length > 0) {
            console.log(`Attempting to place ${unassignedStudents.length} unassigned students...`);

            for (const point of unassignedStudents) {
                let placed = false;

                // Find best bus with capacity
                let bestBus = null;
                let bestCost = Infinity;

                for (const [busId, assignment] of assignments) {
                    if (assignment.students.length >= MAX_BUS_CAPACITY) continue;

                    const insertion = this.calculateInsertionCost(
                        assignment.route,
                        point,
                        assignment.bus.origin,
                        assignment.bus.destination
                    );

                    if (insertion.cost < bestCost) {
                        bestCost = insertion.cost;
                        bestBus = assignment;
                    }
                }

                if (bestBus) {
                    const insertion = this.calculateInsertionCost(
                        bestBus.route,
                        point,
                        bestBus.bus.origin,
                        bestBus.bus.destination
                    );

                    bestBus.route = insertion.newRoute;
                    bestBus.students.push(point.student);
                    placed = true;
                }

                if (!placed) {
                    console.warn(`Could not place student: ${point.student.firstName} ${point.student.lastName}`);
                }
            }
        }

        // ========== PHASE 7: Calculate final statistics ==========
        if (progressCallback) progressCallback('שלב 7: סיכום...');

        const results = {
            assignments: new Map(),
            summary: [],
            totalStudents: studentPoints.length,
            clustersCreated: clusters.length,
            unassignedCount: 0
        };

        for (const [busId, assignment] of assignments) {
            results.assignments.set(busId, assignment.students);

            const totalDist = this.calculateTotalRouteDistance(
                assignment.route,
                assignment.bus.origin,
                assignment.bus.destination
            );
            const estimatedTime = this.estimateRouteTimeMinutes(totalDist, assignment.route.length);

            results.summary.push({
                busId: busId,
                busName: assignment.bus.bus.name,
                count: assignment.students.length,
                routeDistance: totalDist.toFixed(1),
                estimatedTime: estimatedTime.toFixed(0)
            });
        }

        console.log('=== SMART BATCH ASSIGNMENT V2 COMPLETE ===');
        console.log('Summary:', results.summary);

        return results;
    }

    /**
     * Calculate affinity score between a location group and a bus
     * Lower score = better match (used by V1 algorithm, kept for compatibility)
     */
    calculateGroupBusAffinity(group, busData) {
        const coords = group.coords;
        const startCoords = busData.startCoords;
        const endCoords = busData.endCoords;

        let distToStart = Infinity;
        let distToEnd = Infinity;
        let distToRoute = Infinity;
        let onRouteDirection = true;

        // Distance to start
        if (startCoords) {
            distToStart = this.calculateDistance(
                coords.lat, coords.lng,
                startCoords.lat, startCoords.lng
            );
        }

        // Distance to end
        if (endCoords) {
            distToEnd = this.calculateDistance(
                coords.lat, coords.lng,
                endCoords.lat, endCoords.lng
            );
        }

        // Distance to route line
        if (startCoords && endCoords) {
            distToRoute = this.calculateDistanceToRouteLine(coords, startCoords, endCoords);
            onRouteDirection = this.isOnRouteDirection(coords, startCoords, endCoords);
        }

        // Calculate total score
        // Prioritize: on-route > close to route > close to endpoints
        let total = 0;

        // Base: distance to nearest endpoint
        const minEndpointDist = Math.min(distToStart, distToEnd);
        total += minEndpointDist;

        // Bonus for being close to route line
        if (distToRoute < Infinity) {
            total = Math.min(total, distToRoute * 1.2);
        }

        // Penalty for wrong direction
        if (!onRouteDirection) {
            total += 10; // 10km penalty
        }

        // Bonus for larger groups (we want big groups together)
        // Negative bonus = lower score = better
        total -= group.students.length * 0.1;

        return {
            total: total,
            distToStart: distToStart,
            distToEnd: distToEnd,
            distToRoute: distToRoute,
            onRouteDirection: onRouteDirection,
            groupSize: group.students.length
        };
    }

    // ==========================================
    // GENETIC ALGORITHM OPTIMIZER (Meta-heuristic)
    // ==========================================

    /**
     * Genetic Algorithm for VRP optimization
     * Uses evolutionary techniques to find near-optimal solutions
     * that can escape local minima
     *
     * @param {Array} studentPoints - Array of {lat, lng, student} objects
     * @param {Array} busData - Array of {bus, origin, destination} objects
     * @param {Object} config - GA configuration
     * @returns {Map} Optimal assignment: busId -> [students]
     */
    geneticAlgorithmOptimize(studentPoints, busData, config = {}) {
        // Configuration with defaults
        const POPULATION_SIZE = config.populationSize || 80;
        const GENERATIONS = config.generations || 150;
        const MUTATION_RATE = config.mutationRate || 0.08;
        const ELITE_SIZE = config.eliteSize || 8;
        const MAX_CAPACITY = config.maxCapacity || 50;
        const TOURNAMENT_SIZE = config.tournamentSize || 5;

        console.log(`=== GENETIC ALGORITHM OPTIMIZER ===`);
        console.log(`Population: ${POPULATION_SIZE}, Generations: ${GENERATIONS}, Mutation: ${MUTATION_RATE}`);

        const startTime = Date.now();

        // Prefetch distance matrix for performance
        const allPoints = [
            ...studentPoints.map(s => ({ lat: s.lat, lng: s.lng })),
            ...busData.map(b => b.origin),
            ...busData.map(b => b.destination)
        ];
        this.prefetchDistanceMatrix(allPoints);

        // Create initial population
        let population = [];
        for (let i = 0; i < POPULATION_SIZE; i++) {
            population.push(this._createIndividual(studentPoints, busData, MAX_CAPACITY));
        }

        // Track best solution
        let bestFitness = Infinity;
        let bestIndividual = null;
        let generationsWithoutImprovement = 0;

        // Evolution loop
        for (let gen = 0; gen < GENERATIONS; gen++) {
            // Calculate fitness for all individuals
            const fitnessScores = population.map(individual => ({
                individual,
                fitness: this._calculateFitness(individual, busData, MAX_CAPACITY)
            }));

            // Sort by fitness (lower is better)
            fitnessScores.sort((a, b) => a.fitness - b.fitness);

            // Track best
            if (fitnessScores[0].fitness < bestFitness) {
                bestFitness = fitnessScores[0].fitness;
                bestIndividual = this._cloneIndividual(fitnessScores[0].individual);
                generationsWithoutImprovement = 0;

                if (gen % 20 === 0 || gen < 10) {
                    console.log(`Gen ${gen}: Best fitness = ${(bestFitness / 1000).toFixed(1)}km`);
                }
            } else {
                generationsWithoutImprovement++;
            }

            // Early termination if no improvement for 30 generations
            if (generationsWithoutImprovement > 30) {
                console.log(`Converged at generation ${gen} (no improvement for 30 gens)`);
                break;
            }

            // Create next generation
            const newPopulation = [];

            // Elitism: keep best individuals
            for (let i = 0; i < ELITE_SIZE; i++) {
                newPopulation.push(this._cloneIndividual(fitnessScores[i].individual));
            }

            // Fill rest with crossover and mutation
            while (newPopulation.length < POPULATION_SIZE) {
                // Tournament selection
                const parentA = this._tournamentSelect(fitnessScores, TOURNAMENT_SIZE);
                const parentB = this._tournamentSelect(fitnessScores, TOURNAMENT_SIZE);

                // Crossover
                let child = this._crossover(parentA, parentB, studentPoints, busData, MAX_CAPACITY);

                // Mutation
                if (Math.random() < MUTATION_RATE) {
                    child = this._mutate(child, busData, MAX_CAPACITY);
                }

                newPopulation.push(child);
            }

            population = newPopulation;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`GA Complete: Best fitness = ${(bestFitness / 1000).toFixed(1)}km in ${duration}s`);

        return bestIndividual;
    }

    /**
     * Create a random individual (chromosome)
     * An individual is a Map: busId -> [studentPoints]
     */
    _createIndividual(studentPoints, busData, maxCapacity) {
        const assignment = new Map();
        busData.forEach(bd => assignment.set(bd.bus.id, []));

        // Shuffle students for randomness
        const shuffled = [...studentPoints].sort(() => Math.random() - 0.5);

        // Assign students to buses
        for (const student of shuffled) {
            // Find buses with available capacity
            const availableBuses = busData.filter(bd =>
                assignment.get(bd.bus.id).length < maxCapacity
            );

            if (availableBuses.length > 0) {
                // Weighted random selection - prefer buses closer to student
                const weights = availableBuses.map(bd => {
                    const dist = this.getCachedDistanceMeters(
                        { lat: student.lat, lng: student.lng },
                        bd.origin
                    );
                    return 1 / (dist + 1000); // Inverse distance with offset
                });

                const totalWeight = weights.reduce((a, b) => a + b, 0);
                let random = Math.random() * totalWeight;

                let selectedBus = availableBuses[0];
                for (let i = 0; i < availableBuses.length; i++) {
                    random -= weights[i];
                    if (random <= 0) {
                        selectedBus = availableBuses[i];
                        break;
                    }
                }

                assignment.get(selectedBus.bus.id).push(student);
            }
        }

        return assignment;
    }

    /**
     * Calculate fitness (total distance) for an individual
     * Lower fitness = better solution
     */
    _calculateFitness(individual, busData, maxCapacity) {
        let totalDistance = 0;
        let penaltyMultiplier = 1;

        for (const bd of busData) {
            const students = individual.get(bd.bus.id);
            if (students.length === 0) continue;

            // Capacity penalty
            if (students.length > maxCapacity) {
                penaltyMultiplier += (students.length - maxCapacity) * 0.5;
            }

            // Calculate route distance using nearest neighbor heuristic
            const routeDist = this._calculateRouteDistanceNN(students, bd.origin, bd.destination);
            totalDistance += routeDist;
        }

        return totalDistance * penaltyMultiplier;
    }

    /**
     * Calculate route distance using Nearest Neighbor heuristic
     * Fast approximation for fitness evaluation
     */
    _calculateRouteDistanceNN(students, origin, destination) {
        if (students.length === 0) return 0;

        let distance = 0;
        let current = origin;
        const unvisited = [...students];

        while (unvisited.length > 0) {
            let nearestIdx = 0;
            let nearestDist = Infinity;

            for (let i = 0; i < unvisited.length; i++) {
                const dist = this.getCachedDistanceMeters(current, {
                    lat: unvisited[i].lat,
                    lng: unvisited[i].lng
                });
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestIdx = i;
                }
            }

            distance += nearestDist;
            current = { lat: unvisited[nearestIdx].lat, lng: unvisited[nearestIdx].lng };
            unvisited.splice(nearestIdx, 1);
        }

        // Add distance to destination
        distance += this.getCachedDistanceMeters(current, destination);

        return distance;
    }

    /**
     * Tournament selection - pick best from random subset
     */
    _tournamentSelect(fitnessScores, tournamentSize) {
        const tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * fitnessScores.length);
            tournament.push(fitnessScores[idx]);
        }
        tournament.sort((a, b) => a.fitness - b.fitness);
        return tournament[0].individual;
    }

    /**
     * Crossover - create child from two parents
     * Uses route-based crossover to preserve good routes
     */
    _crossover(parentA, parentB, studentPoints, busData, maxCapacity) {
        const child = new Map();
        busData.forEach(bd => child.set(bd.bus.id, []));

        const assignedStudentIds = new Set();

        // Step 1: Take complete route from random bus in parent A
        const busIds = Array.from(parentA.keys());
        const randomBusId = busIds[Math.floor(Math.random() * busIds.length)];
        const studentsFromA = parentA.get(randomBusId);

        for (const student of studentsFromA) {
            if (!assignedStudentIds.has(student.student.id)) {
                child.get(randomBusId).push(student);
                assignedStudentIds.add(student.student.id);
            }
        }

        // Step 2: Fill remaining students from parent B's ordering
        for (const [busId, students] of parentB) {
            for (const student of students) {
                if (!assignedStudentIds.has(student.student.id)) {
                    // Try to assign to same bus as in parent B
                    const targetBus = child.get(busId);
                    if (targetBus && targetBus.length < maxCapacity) {
                        targetBus.push(student);
                        assignedStudentIds.add(student.student.id);
                    }
                }
            }
        }

        // Step 3: Handle any remaining unassigned students
        for (const student of studentPoints) {
            if (!assignedStudentIds.has(student.student.id)) {
                // Find bus with capacity
                for (const bd of busData) {
                    const busStudents = child.get(bd.bus.id);
                    if (busStudents.length < maxCapacity) {
                        busStudents.push(student);
                        break;
                    }
                }
            }
        }

        return child;
    }

    /**
     * Mutation - apply random changes to individual
     */
    _mutate(individual, busData, maxCapacity) {
        const mutationType = Math.random();

        if (mutationType < 0.5) {
            // Swap mutation: swap students between two buses
            return this._swapMutation(individual, busData, maxCapacity);
        } else {
            // Relocate mutation: move student from one bus to another
            return this._relocateMutation(individual, busData, maxCapacity);
        }
    }

    /**
     * Swap mutation - swap students between buses
     */
    _swapMutation(individual, busData, maxCapacity) {
        const busIds = Array.from(individual.keys());
        const nonEmptyBuses = busIds.filter(id => individual.get(id).length > 0);

        if (nonEmptyBuses.length < 2) return individual;

        // Pick two random buses
        const idx1 = Math.floor(Math.random() * nonEmptyBuses.length);
        let idx2 = Math.floor(Math.random() * nonEmptyBuses.length);
        while (idx2 === idx1) idx2 = Math.floor(Math.random() * nonEmptyBuses.length);

        const bus1 = nonEmptyBuses[idx1];
        const bus2 = nonEmptyBuses[idx2];

        const students1 = individual.get(bus1);
        const students2 = individual.get(bus2);

        if (students1.length > 0 && students2.length > 0) {
            // Swap random students
            const studentIdx1 = Math.floor(Math.random() * students1.length);
            const studentIdx2 = Math.floor(Math.random() * students2.length);

            const temp = students1[studentIdx1];
            students1[studentIdx1] = students2[studentIdx2];
            students2[studentIdx2] = temp;
        }

        return individual;
    }

    /**
     * Relocate mutation - move student to different bus
     */
    _relocateMutation(individual, busData, maxCapacity) {
        const busIds = Array.from(individual.keys());
        const nonEmptyBuses = busIds.filter(id => individual.get(id).length > 1); // Keep at least 1

        if (nonEmptyBuses.length === 0) return individual;

        // Pick source bus
        const sourceBusId = nonEmptyBuses[Math.floor(Math.random() * nonEmptyBuses.length)];
        const sourceStudents = individual.get(sourceBusId);

        // Find target bus with capacity
        const targetBuses = busIds.filter(id =>
            id !== sourceBusId && individual.get(id).length < maxCapacity
        );

        if (targetBuses.length === 0) return individual;

        const targetBusId = targetBuses[Math.floor(Math.random() * targetBuses.length)];

        // Move random student
        const studentIdx = Math.floor(Math.random() * sourceStudents.length);
        const student = sourceStudents.splice(studentIdx, 1)[0];
        individual.get(targetBusId).push(student);

        return individual;
    }

    /**
     * Clone an individual (deep copy)
     */
    _cloneIndividual(individual) {
        const clone = new Map();
        for (const [busId, students] of individual) {
            clone.set(busId, [...students]);
        }
        return clone;
    }

    /**
     * Convert GA result to standard assignment format
     */
    _convertGAResultToAssignment(gaResult, busData) {
        const assignments = new Map();

        for (const bd of busData) {
            const students = gaResult.get(bd.bus.id) || [];
            assignments.set(bd.bus.id, {
                bus: bd,
                students: students.map(s => s.student),
                route: students.map(s => ({ lat: s.lat, lng: s.lng, student: s.student }))
            });
        }

        return assignments;
    }

    // ==========================================
    // SMART BATCH ASSIGNMENT ALGORITHM (V3)
    // ==========================================

    /**
     * Smart batch assignment V3 - Advanced VRP with Local Search
     *
     * Improvements over V2:
     * 1. Adaptive constraints - automatically relaxes if impossible
     * 2. 2-opt route optimization within each bus
     * 3. Inter-bus swap optimization for global improvement
     * 4. Relocation optimization for load balancing
     * 5. Quality metrics and efficiency scoring
     *
     * @param {Array} students - All students to assign
     * @param {Array} buses - Available buses
     * @param {Function} progressCallback - Progress update callback
     * @param {Object} constraints - Assignment constraints
     * @returns {Object} Assignment results with quality metrics
     */
    async smartBatchAssignmentV3(students, buses, progressCallback = null, constraints = {}) {
        const MAX_BUS_CAPACITY = constraints.maxBusCapacity || 50;
        const MAX_RIDE_TIME = constraints.maxRideTimeMinutes || 60;
        const MAX_ROUTE_TIME = constraints.maxTotalRouteMinutes || 90;
        const ADAPTIVE_CONSTRAINTS = constraints.adaptiveConstraints !== false; // Default true

        if (!this.isReady()) {
            console.log('Maps not ready for smart assignment');
            return null;
        }

        if (!students || students.length === 0 || !buses || buses.length === 0) {
            console.log('No students or buses for assignment');
            return null;
        }

        console.log(`=== SMART BATCH ASSIGNMENT V3 ===`);
        console.log(`Students: ${students.length}, Buses: ${buses.length}`);
        console.log(`Constraints: maxCapacity=${MAX_BUS_CAPACITY}, maxRideTime=${MAX_RIDE_TIME}min, maxRouteTime=${MAX_ROUTE_TIME}min`);
        console.log(`Adaptive constraints: ${ADAPTIVE_CONSTRAINTS ? 'ENABLED' : 'DISABLED'}`);

        const startTime = Date.now();

        // ========== PHASE 1: Geocode all students ==========
        if (progressCallback) progressCallback('שלב 1/8: מיקום תלמידים...');

        const studentPoints = [];
        for (const student of students) {
            if (!student.address) continue;

            const coords = await this.geocodeAddress(student.address);
            if (coords) {
                studentPoints.push({
                    lat: coords.lat,
                    lng: coords.lng,
                    student: student,
                    address: student.address
                });
            }
        }

        console.log(`Geocoded ${studentPoints.length}/${students.length} students`);

        // ========== PHASE 2: Geocode bus endpoints ==========
        if (progressCallback) progressCallback('שלב 2/8: מיקום מסלולי אוטובוסים...');

        const busData = [];
        for (const bus of buses) {
            const startCoords = bus.startLocation ? await this.geocodeAddress(bus.startLocation) : null;
            const endCoords = bus.endLocation ? await this.geocodeAddress(bus.endLocation) : null;

            if (startCoords && endCoords) {
                busData.push({
                    bus: bus,
                    origin: startCoords,
                    destination: endCoords,
                    route: [],
                    assignedStudents: [],
                    totalDistance: 0,
                    estimatedTime: 0
                });
            }
        }

        console.log(`Prepared ${busData.length} buses with valid routes`);

        // ========== PHASE 3: Adaptive constraint calculation ==========
        if (progressCallback) progressCallback('שלב 3/8: חישוב אילוצים אדפטיביים...');

        let effectiveMaxRouteTime = MAX_ROUTE_TIME;
        let constraintsRelaxed = false;

        if (ADAPTIVE_CONSTRAINTS && studentPoints.length > 0 && busData.length > 0) {
            // Calculate minimum possible route time based on geographic spread
            const allCoords = studentPoints.map(p => ({ lat: p.lat, lng: p.lng }));
            const geographicSpread = this.calculateGeographicSpread(allCoords);

            // Estimate minimum route time per bus
            const avgStudentsPerBus = studentPoints.length / busData.length;
            const minRouteDistanceEstimate = geographicSpread.maxDistance / 2; // Rough estimate
            const minRouteTimeEstimate = this.estimateRouteTimeMinutes(minRouteDistanceEstimate, avgStudentsPerBus);

            console.log(`Geographic spread: ${geographicSpread.maxDistance.toFixed(1)}km`);
            console.log(`Estimated min route time per bus: ${minRouteTimeEstimate.toFixed(0)}min`);

            if (minRouteTimeEstimate > MAX_ROUTE_TIME) {
                effectiveMaxRouteTime = Math.ceil(minRouteTimeEstimate * 1.2); // Add 20% buffer
                constraintsRelaxed = true;
                console.log(`⚠️ Constraints relaxed: maxRouteTime ${MAX_ROUTE_TIME} -> ${effectiveMaxRouteTime}min`);
            }
        }

        // ========== PHASE 4: K-Means Clustering ==========
        if (progressCallback) progressCallback('שלב 4/8: קיבוץ גיאוגרפי (K-Means)...');

        const optimalK = this.calculateOptimalK(studentPoints.length, busData.length, MAX_BUS_CAPACITY);
        const clusters = this.kMeansClustering(studentPoints, optimalK);

        console.log(`Created ${clusters.length} geographic clusters:`);
        clusters.forEach((c, i) => {
            console.log(`  Cluster ${i + 1}: ${c.points.length} students at (${c.centroid.lat.toFixed(4)}, ${c.centroid.lng.toFixed(4)})`);
        });

        // ========== PHASE 5: Initial assignment with insertion heuristic ==========
        if (progressCallback) progressCallback('שלב 5/8: שיוך ראשוני...');

        const assignments = new Map();
        for (const bd of busData) {
            assignments.set(bd.bus.id, {
                bus: bd,
                students: [],
                route: []
            });
        }

        // Calculate cluster-bus affinities
        for (const cluster of clusters) {
            cluster.busAffinities = busData.map(bd => {
                const distToRoute = this.calculateDistanceToRouteLine(
                    cluster.centroid, bd.origin, bd.destination
                );
                const onDirection = this.isOnRouteDirection(cluster.centroid, bd.origin, bd.destination);

                return {
                    busId: bd.bus.id,
                    busName: bd.bus.name,
                    distToRoute: distToRoute,
                    onDirection: onDirection,
                    score: distToRoute + (onDirection ? 0 : 15)
                };
            });
            cluster.busAffinities.sort((a, b) => a.score - b.score);
        }

        // Sort clusters by size (largest first)
        clusters.sort((a, b) => b.points.length - a.points.length);

        let unassignedStudents = [];

        // Assign clusters to buses
        for (const cluster of clusters) {
            let clusterAssigned = false;

            for (const affinity of cluster.busAffinities) {
                const assignment = assignments.get(affinity.busId);
                const wouldBeCount = assignment.students.length + cluster.points.length;

                if (wouldBeCount <= MAX_BUS_CAPACITY) {
                    // Sort cluster students by distance from bus origin (farthest first for pickup)
                    const studentsToAdd = [...cluster.points].sort((a, b) => {
                        const distA = this.calculateDistance(a.lat, a.lng, assignment.bus.origin.lat, assignment.bus.origin.lng);
                        const distB = this.calculateDistance(b.lat, b.lng, assignment.bus.origin.lat, assignment.bus.origin.lng);
                        return distB - distA; // Farthest first
                    });

                    // Add all students from cluster
                    for (const point of studentsToAdd) {
                        const insertion = this.calculateInsertionCost(
                            assignment.route,
                            point,
                            assignment.bus.origin,
                            assignment.bus.destination
                        );
                        assignment.route = insertion.newRoute;
                        assignment.students.push(point.student);
                    }

                    console.log(`Assigned ${cluster.points.length} students to "${affinity.busName}" ` +
                        `(total: ${assignment.students.length}/${MAX_BUS_CAPACITY})`);

                    clusterAssigned = true;
                    break;
                }
            }

            if (!clusterAssigned) {
                console.log(`Could not assign cluster of ${cluster.points.length} students, splitting...`);
                unassignedStudents.push(...cluster.points);
            }
        }

        // Handle unassigned students individually
        for (const point of unassignedStudents) {
            let bestBus = null;
            let bestCost = Infinity;

            for (const [busId, assignment] of assignments) {
                if (assignment.students.length >= MAX_BUS_CAPACITY) continue;

                const insertion = this.calculateInsertionCost(
                    assignment.route,
                    point,
                    assignment.bus.origin,
                    assignment.bus.destination
                );

                if (insertion.cost < bestCost) {
                    bestCost = insertion.cost;
                    bestBus = assignment;
                }
            }

            if (bestBus) {
                const insertion = this.calculateInsertionCost(
                    bestBus.route,
                    point,
                    bestBus.bus.origin,
                    bestBus.bus.destination
                );
                bestBus.route = insertion.newRoute;
                bestBus.students.push(point.student);
            }
        }

        // ========== PHASE 6: 2-opt route optimization ==========
        if (progressCallback) progressCallback('שלב 6/8: אופטימיזציית מסלול (2-opt)...');

        let totalTwoOptImprovement = 0;

        for (const [busId, assignment] of assignments) {
            if (assignment.route.length < 3) continue;

            const originalDistance = this.calculateTotalRouteDistance(
                assignment.route, assignment.bus.origin, assignment.bus.destination
            );

            // Apply 2-opt optimization
            assignment.route = this.twoOptOptimize(
                assignment.route,
                assignment.bus.origin,
                assignment.bus.destination
            );

            const optimizedDistance = this.calculateTotalRouteDistance(
                assignment.route, assignment.bus.origin, assignment.bus.destination
            );

            const improvement = originalDistance - optimizedDistance;
            totalTwoOptImprovement += improvement;

            if (improvement > 0.1) {
                console.log(`2-opt improved ${assignment.bus.bus.name}: -${improvement.toFixed(1)}km`);
            }
        }

        console.log(`Total 2-opt improvement: ${totalTwoOptImprovement.toFixed(1)}km`);

        // ========== PHASE 7: Inter-bus swap optimization ==========
        if (progressCallback) progressCallback('שלב 7/8: אופטימיזציית החלפות בין אוטובוסים...');

        const swapResult = this.interBusSwapOptimization(assignments, 30);
        console.log(`Inter-bus swaps: ${swapResult.swapCount} (${swapResult.iterations} iterations)`);

        const relocateResult = this.relocateOptimization(assignments, MAX_BUS_CAPACITY);
        console.log(`Relocations: ${relocateResult.relocations}`);

        // ========== PHASE 8: Final statistics and quality metrics ==========
        if (progressCallback) progressCallback('שלב 8/8: חישוב מדדי איכות...');

        const results = {
            assignments: new Map(),
            summary: [],
            totalStudents: studentPoints.length,
            clustersCreated: clusters.length,
            unassignedCount: 0,
            qualityMetrics: {},
            constraintsRelaxed: constraintsRelaxed,
            effectiveMaxRouteTime: effectiveMaxRouteTime
        };

        let totalDistance = 0;
        let maxRouteTime = 0;
        let totalRouteTime = 0;

        for (const [busId, assignment] of assignments) {
            results.assignments.set(busId, assignment.students);

            const routeDistance = this.calculateTotalRouteDistance(
                assignment.route,
                assignment.bus.origin,
                assignment.bus.destination
            );
            const estimatedTime = this.estimateRouteTimeMinutes(routeDistance, assignment.route.length);

            totalDistance += routeDistance;
            totalRouteTime += estimatedTime;
            maxRouteTime = Math.max(maxRouteTime, estimatedTime);

            results.summary.push({
                busId: busId,
                busName: assignment.bus.bus.name,
                count: assignment.students.length,
                routeDistance: routeDistance.toFixed(1),
                estimatedTime: estimatedTime.toFixed(0),
                utilizationPercent: ((assignment.students.length / MAX_BUS_CAPACITY) * 100).toFixed(0)
            });
        }

        // Calculate quality metrics
        const avgRouteTime = busData.length > 0 ? totalRouteTime / busData.length : 0;
        const avgStudentsPerBus = busData.length > 0 ? studentPoints.length / busData.length : 0;

        // Efficiency score: 100 = perfect, 0 = terrible
        // Based on: route time vs target, load balance, constraint compliance
        const timeScore = Math.max(0, 100 - (maxRouteTime / effectiveMaxRouteTime - 1) * 50);
        const loadVariance = this.calculateLoadVariance(results.summary.map(s => s.count));
        const loadScore = Math.max(0, 100 - loadVariance * 2);
        const efficiencyScore = (timeScore * 0.6 + loadScore * 0.4).toFixed(0);

        results.qualityMetrics = {
            totalDistance: totalDistance.toFixed(1),
            avgRouteTime: avgRouteTime.toFixed(0),
            maxRouteTime: maxRouteTime.toFixed(0),
            avgStudentsPerBus: avgStudentsPerBus.toFixed(1),
            efficiencyScore: efficiencyScore,
            twoOptImprovement: totalTwoOptImprovement.toFixed(1),
            swapCount: swapResult.swapCount,
            relocations: relocateResult.relocations
        };

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`=== SMART BATCH ASSIGNMENT V3 COMPLETE (${duration}s) ===`);
        console.log('Summary:', results.summary);
        console.log('Quality Metrics:', results.qualityMetrics);

        return results;
    }

    // ==========================================
    // SMART BATCH ASSIGNMENT ALGORITHM (V4)
    // Uses Genetic Algorithm for global optimization
    // ==========================================

    /**
     * Smart batch assignment V4 - Hybrid Genetic Algorithm + Local Search
     *
     * This is the most advanced algorithm combining:
     * 1. Genetic Algorithm for global optimization (escapes local minima)
     * 2. K-Means for seeding good initial population
     * 3. 2-opt and inter-bus optimization for solution refinement
     * 4. Quality metrics and efficiency scoring
     *
     * Use this for large-scale problems (50+ students) where V3 might get stuck
     *
     * @param {Array} students - All students to assign
     * @param {Array} buses - Available buses
     * @param {Function} progressCallback - Progress update callback
     * @param {Object} constraints - Assignment constraints
     * @returns {Object} Assignment results with quality metrics
     */
    async smartBatchAssignmentV4(students, buses, progressCallback = null, constraints = {}) {
        const MAX_BUS_CAPACITY = constraints.maxBusCapacity || 50;
        const MAX_RIDE_TIME = constraints.maxRideTimeMinutes || 60;
        const MAX_ROUTE_TIME = constraints.maxTotalRouteMinutes || 90;

        // GA configuration based on problem size
        const GA_CONFIG = {
            populationSize: Math.min(100, Math.max(40, students.length)),
            generations: Math.min(200, Math.max(80, students.length * 2)),
            mutationRate: 0.08,
            eliteSize: Math.max(5, Math.floor(students.length / 20)),
            maxCapacity: MAX_BUS_CAPACITY,
            tournamentSize: 5
        };

        if (!this.isReady()) {
            console.log('Maps not ready for smart assignment');
            return null;
        }

        if (!students || students.length === 0 || !buses || buses.length === 0) {
            console.log('No students or buses for assignment');
            return null;
        }

        console.log(`=== SMART BATCH ASSIGNMENT V4 (GENETIC ALGORITHM) ===`);
        console.log(`Students: ${students.length}, Buses: ${buses.length}`);
        console.log(`GA Config: pop=${GA_CONFIG.populationSize}, gen=${GA_CONFIG.generations}`);

        const startTime = Date.now();

        // ========== PHASE 1: Geocode all students ==========
        if (progressCallback) progressCallback('שלב 1/6: מיקום תלמידים...');

        const studentPoints = [];
        for (const student of students) {
            if (!student.address) continue;

            const coords = await this.geocodeAddress(student.address);
            if (coords) {
                studentPoints.push({
                    lat: coords.lat,
                    lng: coords.lng,
                    student: student,
                    address: student.address
                });
            }
        }

        console.log(`Geocoded ${studentPoints.length}/${students.length} students`);

        // ========== PHASE 2: Geocode bus endpoints ==========
        if (progressCallback) progressCallback('שלב 2/6: מיקום מסלולי אוטובוסים...');

        const busData = [];
        for (const bus of buses) {
            const startCoords = bus.startLocation ? await this.geocodeAddress(bus.startLocation) : null;
            const endCoords = bus.endLocation ? await this.geocodeAddress(bus.endLocation) : null;

            if (startCoords && endCoords) {
                busData.push({
                    bus: bus,
                    origin: startCoords,
                    destination: endCoords
                });
            }
        }

        console.log(`Prepared ${busData.length} buses with valid routes`);

        if (busData.length === 0 || studentPoints.length === 0) {
            console.log('Cannot proceed: no valid buses or students');
            return null;
        }

        // ========== PHASE 3: Run Genetic Algorithm ==========
        if (progressCallback) progressCallback('שלב 3/6: אופטימיזציה גנטית (זה עשוי לקחת זמן)...');

        const gaResult = this.geneticAlgorithmOptimize(studentPoints, busData, GA_CONFIG);

        if (!gaResult) {
            console.log('Genetic algorithm failed, falling back to V3');
            return this.smartBatchAssignmentV3(students, buses, progressCallback, constraints);
        }

        // ========== PHASE 4: Convert GA result to assignments ==========
        if (progressCallback) progressCallback('שלב 4/6: עיבוד תוצאות...');

        const assignments = this._convertGAResultToAssignment(gaResult, busData);

        // ========== PHASE 5: Local search refinement (2-opt + swaps) ==========
        if (progressCallback) progressCallback('שלב 5/6: שיפור מקומי (2-opt)...');

        let totalTwoOptImprovement = 0;

        for (const [busId, assignment] of assignments) {
            if (assignment.route.length < 3) continue;

            const originalDistance = this.calculateTotalRouteDistance(
                assignment.route, assignment.bus.origin, assignment.bus.destination
            );

            // Apply 2-opt optimization
            assignment.route = this.twoOptOptimize(
                assignment.route,
                assignment.bus.origin,
                assignment.bus.destination
            );

            const optimizedDistance = this.calculateTotalRouteDistance(
                assignment.route, assignment.bus.origin, assignment.bus.destination
            );

            const improvement = originalDistance - optimizedDistance;
            totalTwoOptImprovement += improvement;
        }

        console.log(`2-opt refinement: -${totalTwoOptImprovement.toFixed(1)}km`);

        // Inter-bus swap optimization
        const swapResult = this.interBusSwapOptimization(assignments, 20);
        console.log(`Inter-bus swaps: ${swapResult.swapCount}`);

        // ========== PHASE 6: Generate results and quality metrics ==========
        if (progressCallback) progressCallback('שלב 6/6: חישוב מדדי איכות...');

        const results = {
            assignments: new Map(),
            summary: [],
            totalStudents: studentPoints.length,
            algorithm: 'V4-Genetic',
            gaConfig: GA_CONFIG,
            qualityMetrics: {}
        };

        let totalDistance = 0;
        let maxRouteTime = 0;
        let totalRouteTime = 0;

        for (const [busId, assignment] of assignments) {
            results.assignments.set(busId, assignment.students);

            const routeDistance = this.calculateTotalRouteDistance(
                assignment.route,
                assignment.bus.origin,
                assignment.bus.destination
            );
            const estimatedTime = this.estimateRouteTimeMinutes(routeDistance, assignment.route.length);

            totalDistance += routeDistance;
            totalRouteTime += estimatedTime;
            maxRouteTime = Math.max(maxRouteTime, estimatedTime);

            results.summary.push({
                busId: busId,
                busName: assignment.bus.bus.name,
                count: assignment.students.length,
                routeDistance: routeDistance.toFixed(1),
                estimatedTime: estimatedTime.toFixed(0),
                utilizationPercent: ((assignment.students.length / MAX_BUS_CAPACITY) * 100).toFixed(0)
            });
        }

        // Calculate quality metrics
        const avgRouteTime = busData.length > 0 ? totalRouteTime / busData.length : 0;
        const avgStudentsPerBus = busData.length > 0 ? studentPoints.length / busData.length : 0;

        // Efficiency score
        const timeScore = Math.max(0, 100 - (maxRouteTime / MAX_ROUTE_TIME - 1) * 50);
        const loadVariance = this.calculateLoadVariance(results.summary.map(s => parseInt(s.count)));
        const loadScore = Math.max(0, 100 - loadVariance * 2);
        const efficiencyScore = (timeScore * 0.6 + loadScore * 0.4).toFixed(0);

        results.qualityMetrics = {
            totalDistance: totalDistance.toFixed(1),
            avgRouteTime: avgRouteTime.toFixed(0),
            maxRouteTime: maxRouteTime.toFixed(0),
            avgStudentsPerBus: avgStudentsPerBus.toFixed(1),
            efficiencyScore: efficiencyScore,
            twoOptImprovement: totalTwoOptImprovement.toFixed(1),
            swapCount: swapResult.swapCount,
            gaGenerations: GA_CONFIG.generations,
            distanceCacheSize: this.distanceMatrixCache.size
        };

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`=== SMART BATCH ASSIGNMENT V4 COMPLETE (${duration}s) ===`);
        console.log('Summary:', results.summary);
        console.log('Quality Metrics:', results.qualityMetrics);

        return results;
    }

    /**
     * Calculate geographic spread of points
     */
    calculateGeographicSpread(points) {
        if (points.length < 2) {
            return { maxDistance: 0, avgDistance: 0 };
        }

        let maxDistance = 0;
        let totalDistance = 0;
        let pairs = 0;

        // Sample pairs if too many points (to avoid O(n²) for large sets)
        const sampleSize = Math.min(points.length, 50);
        const sampledPoints = points.length <= 50 ? points :
            points.filter((_, i) => i % Math.ceil(points.length / 50) === 0).slice(0, 50);

        for (let i = 0; i < sampledPoints.length; i++) {
            for (let j = i + 1; j < sampledPoints.length; j++) {
                const dist = this.calculateDistance(
                    sampledPoints[i].lat, sampledPoints[i].lng,
                    sampledPoints[j].lat, sampledPoints[j].lng
                );
                maxDistance = Math.max(maxDistance, dist);
                totalDistance += dist;
                pairs++;
            }
        }

        return {
            maxDistance: maxDistance,
            avgDistance: pairs > 0 ? totalDistance / pairs : 0
        };
    }

    /**
     * Calculate variance in bus load (for quality metrics)
     */
    calculateLoadVariance(loads) {
        if (loads.length === 0) return 0;

        const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
        const squaredDiffs = loads.map(load => Math.pow(load - avg, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / loads.length);
    }

    /**
     * Apply smart batch assignment results - updates student busId fields
     */
    async applySmartAssignment(results) {
        if (!results || !results.assignments) {
            console.log('No assignment results to apply');
            return false;
        }

        let updatedCount = 0;

        for (const [busId, students] of results.assignments) {
            for (const student of students) {
                if (student.busId !== busId) {
                    student.busId = busId;
                    if (window.storageService) {
                        await window.storageService.saveStudent(student);
                    }
                    updatedCount++;
                }
            }
        }

        console.log(`Applied smart assignment: updated ${updatedCount} students`);
        return true;
    }
}

// Create global instance
window.mapsService = new MapsService();
