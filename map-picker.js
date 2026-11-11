(() => {
    const MAPLIBRE_MODULE_URL = 'https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.mjs';
    const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
    const defaultCenter = { lat: 41.3874, lng: 2.1686 };
    const manualMessage = 'Puedes escribir la direcci�n y confirmarla manualmente.';

    const byId = id => document.getElementById(id);
    const dialog = byId('modal-mapa');
    const address = byId('map-search');
    const status = byId('map-status');
    const searchButton = byId('map-search-button');
    const locateButton = byId('map-locate');
    const confirmButton = byId('map-confirm');
    const unavailable = byId('map-unavailable');
    const panel = unavailable.parentElement;
    const externalLink = byId('map-external');
    const retryButton = byId('map-retry');

    let target;
    let revision = 0;
    let mapLibreRequest;
    let map;
    let marker;
    let nominatimQueue = Promise.resolve();
    let lastNominatimRequest = 0;

    function isCurrent(request) {
        return dialog.open && request === revision;
    }

    function updateExternalLink() {
        const query = address.value.trim();
        const url = new URL('https://www.openstreetmap.org/search');
        if (query) url.searchParams.set('query', query);
        externalLink.href = query ? url.href : 'https://www.openstreetmap.org/';
    }

    function setAddress(value) {
        address.value = value;
        confirmButton.disabled = !value.trim();
        updateExternalLink();
    }

    function showUnavailable() {
        searchButton.disabled = false;
        locateButton.disabled = !navigator.geolocation;
        unavailable.hidden = false;
        panel.classList.add('map-panel--unavailable');
        retryButton.hidden = false;
        updateExternalLink();
        status.textContent = 'No se pudo cargar el mapa. ' + manualMessage;
    }

    function loadMapLibre() {
        if (!mapLibreRequest) {
            mapLibreRequest = import(MAPLIBRE_MODULE_URL).catch(error => {
                mapLibreRequest = undefined;
                throw error;
            });
        }
        return mapLibreRequest;
    }

    function wait(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    function nominatimFetch(url) {
        const request = nominatimQueue.then(async () => {
            const elapsed = Date.now() - lastNominatimRequest;
            if (elapsed < 1000) await wait(1000 - elapsed);
            lastNominatimRequest = Date.now();

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
                return response.json();
            } finally {
                clearTimeout(timeout);
            }
        });
        nominatimQueue = request.catch(() => undefined);
        return request;
    }

    function placeMarker(location, moveMap = false) {
        if (!map || !marker) return;
        marker.setLngLat([location.lng, location.lat]).addTo(map);
        if (moveMap) map.flyTo({ center: [location.lng, location.lat], zoom: 16 });
    }

    async function searchAddress(query, request) {
        if (!isCurrent(request)) return;
        status.textContent = 'Buscando direcci�n.';

        const url = new URL('/search', NOMINATIM_URL);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('q', query);
        url.searchParams.set('countrycodes', 'es');
        url.searchParams.set('limit', '1');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('accept-language', 'es');

        try {
            const results = await nominatimFetch(url);
            if (!isCurrent(request)) return;
            const result = results?.[0];
            if (!result) {
                status.textContent = 'No se encontr� la direcci�n. Prueba a�adiendo el municipio.';
                return;
            }

            const location = { lat: Number(result.lat), lng: Number(result.lon) };
            setAddress(result.display_name);
            placeMarker(location, true);
            status.textContent = 'Direcci�n encontrada. Puedes corregirla antes de confirmar.';
        } catch (error) {
            if (isCurrent(request)) {
                status.textContent = 'No se pudo buscar la direcci�n. ' + manualMessage;
            }
        }
    }

    async function reverseGeocode(location, request) {
        if (!isCurrent(request)) return;
        placeMarker(location);
        status.textContent = 'Obteniendo direcci�n.';

        const url = new URL('/reverse', NOMINATIM_URL);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('lat', String(location.lat));
        url.searchParams.set('lon', String(location.lng));
        url.searchParams.set('zoom', '18');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('accept-language', 'es');

        try {
            const result = await nominatimFetch(url);
            if (!isCurrent(request)) return;
            if (result?.display_name) {
                setAddress(result.display_name);
                status.textContent = 'Ubicaci�n seleccionada. Puedes corregir la direcci�n antes de confirmar.';
            } else {
                status.textContent = 'No se encontr� una direcci�n para este punto. ' + manualMessage;
            }
        } catch (error) {
            if (isCurrent(request)) {
                status.textContent = 'No se pudo obtener la direcci�n. ' + manualMessage;
            }
        }
    }

    function selectPoint(location) {
        const point = { lat: Number(location.lat), lng: Number(location.lng) };
        placeMarker(point);
        reverseGeocode(point, ++revision);
    }

    async function createMap() {
        const maplibregl = await loadMapLibre();
        map = new maplibregl.Map({
            container: 'map-container',
            style: MAP_STYLE_URL,
            center: [defaultCenter.lng, defaultCenter.lat],
            zoom: 11,
            attributionControl: true
        });
        marker = new maplibregl.Marker({ draggable: true });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', event => selectPoint(event.lngLat));
        marker.on('dragend', () => selectPoint(marker.getLngLat()));

        await Promise.race([
            new Promise(resolve => map.once('load', resolve)),
            wait(10000).then(() => { throw new Error('OpenFreeMap load timed out'); })
        ]);
    }

    async function prepareMap() {
        const field = target;
        searchButton.disabled = true;
        locateButton.disabled = true;
        unavailable.hidden = true;
        panel.classList.remove('map-panel--unavailable');
        status.textContent = 'Cargando mapa.';

        try {
            if (!map) await createMap();
            if (!dialog.open || target !== field) return;

            marker.remove();
            map.jumpTo({ center: [defaultCenter.lng, defaultCenter.lat], zoom: 11 });
            map.resize();
            searchButton.disabled = false;
            locateButton.disabled = !navigator.geolocation;
            status.textContent = 'Busca una direcci�n o toca un punto en el mapa.';
        } catch (error) {
            map?.remove();
            map = undefined;
            marker = undefined;
            if (dialog.open && target === field) showUnavailable();
        }
    }

    document.querySelectorAll('[data-map-target]').forEach(button => {
        const field = byId(button.dataset.mapTarget);
        button.addEventListener('click', () => {
            if (field.disabled || dialog.open) return;
            target = field;
            revision++;
            setAddress(field.value);
            dialog.showModal();
            prepareMap();
        });
    });

    address.addEventListener('input', () => {
        revision++;
        updateExternalLink();
        confirmButton.disabled = !address.value.trim();
        status.textContent = 'Busca o confirma la direcci�n escrita.';
    });

    byId('map-search-form').addEventListener('submit', event => {
        event.preventDefault();
        const query = address.value.trim();
        if (query && !searchButton.disabled) searchAddress(query, ++revision);
    });

    locateButton.addEventListener('click', () => {
        const request = ++revision;
        status.textContent = 'Obteniendo tu ubicaci�n.';
        navigator.geolocation.getCurrentPosition(position => {
            if (!isCurrent(request)) return;
            const point = { lat: position.coords.latitude, lng: position.coords.longitude };
            if (map) map.flyTo({ center: [point.lng, point.lat], zoom: 16 });
            reverseGeocode(point, request);
        }, () => {
            if (isCurrent(request)) {
                status.textContent = 'No se pudo obtener tu ubicaci�n. Busca una direcci�n o elige un punto.';
            }
        }, { timeout: 8000 });
    });

    retryButton.addEventListener('click', prepareMap);
    byId('map-close').addEventListener('click', () => dialog.close());
    confirmButton.addEventListener('click', () => {
        const value = address.value.trim();
        if (!target || target.disabled || !value) return;
        target.value = value;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        dialog.close();
    });
})();

