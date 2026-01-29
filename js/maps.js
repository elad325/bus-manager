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
    // SMART BATCH ASSIGNMENT ALGORITHM
    // ==========================================

    /**
     * Smart batch assignment - assigns ALL students optimally to buses
     * Instead of assigning one-by-one (greedy), this algorithm:
     * 1. Groups students by location
     * 2. Calculates affinity scores for each location-group to each bus
     * 3. Assigns groups to buses optimally (largest groups first)
     * 4. Balances capacity across buses
     */
    async smartBatchAssignment(students, buses, progressCallback = null) {
        const MAX_BUS_CAPACITY = 50;
        const PROXIMITY_THRESHOLD_KM = 3; // Students within 3km are grouped together

        if (!this.isReady()) {
            console.log('Maps not ready for smart assignment');
            return null;
        }

        if (!students || students.length === 0 || !buses || buses.length === 0) {
            console.log('No students or buses for assignment');
            return null;
        }

        console.log(`Starting smart batch assignment for ${students.length} students across ${buses.length} buses`);

        // ========== PHASE 1: Geocode all students and group by location ==========
        if (progressCallback) progressCallback('שלב 1: איסוף מיקומי תלמידים...');

        const studentLocations = new Map(); // address -> { coords, students[] }

        for (const student of students) {
            if (!student.address) continue;

            const coords = await this.geocodeAddress(student.address);
            if (!coords) {
                console.log(`Could not geocode address: ${student.address}`);
                continue;
            }

            // Check if this location is close to an existing one
            let foundGroup = null;
            for (const [existingAddress, group] of studentLocations) {
                const dist = this.calculateDistance(
                    coords.lat, coords.lng,
                    group.coords.lat, group.coords.lng
                );
                if (dist < PROXIMITY_THRESHOLD_KM) {
                    foundGroup = existingAddress;
                    break;
                }
            }

            if (foundGroup) {
                studentLocations.get(foundGroup).students.push(student);
            } else {
                studentLocations.set(student.address, {
                    coords: coords,
                    students: [student],
                    address: student.address
                });
            }
        }

        console.log(`Grouped ${students.length} students into ${studentLocations.size} location groups`);

        // ========== PHASE 2: Geocode bus endpoints and prepare bus data ==========
        if (progressCallback) progressCallback('שלב 2: חישוב מסלולי אוטובוסים...');

        const busData = [];
        for (const bus of buses) {
            const startCoords = bus.startLocation ? await this.geocodeAddress(bus.startLocation) : null;
            const endCoords = bus.endLocation ? await this.geocodeAddress(bus.endLocation) : null;

            busData.push({
                bus: bus,
                startCoords: startCoords,
                endCoords: endCoords,
                assignedStudents: [],
                assignedGroups: []
            });
        }

        // ========== PHASE 3: Calculate affinity scores for each location-group to each bus ==========
        if (progressCallback) progressCallback('שלב 3: חישוב התאמות...');

        const locationGroups = Array.from(studentLocations.values());

        // Calculate scores for each group to each bus
        for (const group of locationGroups) {
            group.busScores = [];

            for (const bd of busData) {
                const score = this.calculateGroupBusAffinity(group, bd);
                group.busScores.push({
                    busId: bd.bus.id,
                    busName: bd.bus.name,
                    score: score.total,
                    details: score
                });
            }

            // Sort by best score (lowest is better)
            group.busScores.sort((a, b) => a.score - b.score);
        }

        // ========== PHASE 4: Assign groups to buses (largest groups first) ==========
        if (progressCallback) progressCallback('שלב 4: שיוך קבוצות לאוטובוסים...');

        // Sort groups by size (largest first) - big groups are harder to place
        locationGroups.sort((a, b) => b.students.length - a.students.length);

        const assignments = new Map(); // busId -> students[]
        for (const bd of busData) {
            assignments.set(bd.bus.id, []);
        }

        for (const group of locationGroups) {
            let assigned = false;

            // Try to assign to best matching bus that has capacity
            for (const busScore of group.busScores) {
                const currentCount = assignments.get(busScore.busId).length;
                const wouldBeCount = currentCount + group.students.length;

                if (wouldBeCount <= MAX_BUS_CAPACITY) {
                    // Assign all students in this group to this bus
                    assignments.get(busScore.busId).push(...group.students);

                    console.log(`Assigned ${group.students.length} students from "${group.address}" to "${busScore.busName}" ` +
                        `(score: ${busScore.score.toFixed(2)}, capacity: ${wouldBeCount}/${MAX_BUS_CAPACITY})`);

                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                // Could not assign - all buses full or would exceed capacity
                // Try to split the group
                console.log(`Warning: Could not assign group "${group.address}" (${group.students.length} students) - attempting split`);

                for (const student of group.students) {
                    for (const busScore of group.busScores) {
                        const currentCount = assignments.get(busScore.busId).length;
                        if (currentCount < MAX_BUS_CAPACITY) {
                            assignments.get(busScore.busId).push(student);
                            break;
                        }
                    }
                }
            }
        }

        // ========== PHASE 5: Balance if needed ==========
        if (progressCallback) progressCallback('שלב 5: איזון עומסים...');

        // Check if any bus is significantly more loaded than others
        const busLoads = busData.map(bd => ({
            busId: bd.bus.id,
            busName: bd.bus.name,
            count: assignments.get(bd.bus.id).length
        }));

        console.log('Bus loads after initial assignment:', busLoads);

        // ========== PHASE 6: Return results ==========
        if (progressCallback) progressCallback('שלב 6: סיום...');

        const results = {
            assignments: assignments,
            summary: busLoads,
            locationGroups: locationGroups.length,
            totalStudents: students.length
        };

        console.log('Smart batch assignment complete:', results.summary);

        return results;
    }

    /**
     * Calculate affinity score between a location group and a bus
     * Lower score = better match
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
