(() => {
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
    const defaultCenter = { lat: 41.3874, lng: 2.1686 };
    const manualMessage = 'Puedes escribir la dirección y confirmarla manualmente.';
    let target;
    let revision = 0;
    let mapsRequest;
    let rejectLoad;
    let authFailed = false;
    let map;
    let marker;
    let geocoder;

    function showUnavailable() {
        searchButton.disabled = true;
        locateButton.disabled = true;
        unavailable.hidden = false;
        panel.classList.add('map-panel--unavailable');
        searchButton.hidden = true;
        locateButton.hidden = true;
        updateExternalLink();
        retryButton.hidden = authFailed;
        status.textContent = manualMessage;
    }

    window.gm_authFailure = () => {
        authFailed = true;
        rejectLoad?.(new Error('Google Maps authentication failed'));
        if (dialog.open) showUnavailable();
    };

    function loadMaps() {
        if (authFailed) return Promise.reject(new Error('Google Maps authentication failed'));
        if (mapsRequest) return mapsRequest;
        mapsRequest = (async () => {
            await window.horasConfigReady;
            const endpoint = CONFIG.GOOGLE_MAPS_API_URL;
            if (!endpoint) throw new Error('Missing Google Maps endpoint');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                let settled = false;
                const finish = error => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    rejectLoad = undefined;
                    if (error) {
                        script.remove();
                        reject(error);
                    } else {
                        resolve();
                    }
                };
                const timer = setTimeout(() => finish(new Error('Google Maps load timed out')), 10000);
                rejectLoad = finish;
                // The existing proxy redirects Google Maps to this callback.
                window.initMap = () => finish();
                script.async = true;
                script.onerror = () => finish(new Error('Google Maps script could not load'));
                const url = new URL(endpoint, window.location.href);
                url.searchParams.set('libraries', 'places');
                script.src = url.href;
                document.head.append(script);
            });
        })().catch(error => {
            mapsRequest = undefined;
            throw error;
        });
        return mapsRequest;
    }

    function isCurrent(request) {
        return dialog.open && request === revision;
    }

    function updateExternalLink() {
        if (!externalLink) return;
        const query = address.value.trim();
        const url = new URL('https://www.google.com/maps/search/');
        url.searchParams.set('api', '1');
        if (query) url.searchParams.set('query', query);
        externalLink.href = query ? url.href : 'https://www.google.com/maps/';
    }

    function setAddress(value) {
        address.value = value;
        confirmButton.disabled = !value.trim();
    }

    function geocode(query, request) {
        if (!isCurrent(request) || authFailed) return;
        status.textContent = 'Buscando dirección…';
        const timer = setTimeout(() => {
            if (!isCurrent(request) || authFailed) return;
            revision++;
            status.textContent = 'La búsqueda tarda demasiado. Puedes reintentar o usar la dirección escrita.';
        }, 8000);
        geocoder.geocode(query, (results, resultStatus) => {
            clearTimeout(timer);
            if (!isCurrent(request) || authFailed) return;
            const result = results?.[0];
            if (resultStatus !== 'OK' || !result) {
                status.textContent = resultStatus === 'ZERO_RESULTS'
                    ? 'No se encontró la dirección. Prueba añadiendo el municipio.'
                    : 'No se pudo buscar la dirección. ' + manualMessage;
                return;
            }
            setAddress(result.formatted_address);
            marker.setPosition(query.location || result.geometry.location);
            marker.setMap(map);
            if (query.address) {
                map.panTo(result.geometry.location);
                map.setZoom(16);
            }
            status.textContent = 'Dirección encontrada. Puedes corregirla antes de confirmar.';
        });
    }

    function selectPoint(location) {
        marker.setPosition(location);
        marker.setMap(map);
        geocode({ location }, ++revision);
    }

    async function prepareMap() {
        const field = target;
        searchButton.disabled = true;
        locateButton.disabled = true;
        unavailable.hidden = true;
        panel.classList.remove('map-panel--unavailable');
        searchButton.hidden = false;
        locateButton.hidden = false;
        status.textContent = 'Cargando mapa…';
        try {
            await loadMaps();
            if (!dialog.open || target !== field) return;
            if (authFailed) throw new Error('Google Maps authentication failed');
            const maps = window.google.maps;
            if (!map) {
                geocoder = new maps.Geocoder();
                marker = new maps.Marker({ draggable: true, title: 'Ubicación seleccionada' });
                map = new maps.Map(byId('map-container'), {
                    center: defaultCenter,
                    zoom: 11,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    gestureHandling: 'cooperative'
                });
                map.addListener('click', event => selectPoint(event.latLng));
                marker.addListener('dragend', event => selectPoint(event.latLng));
            }
            marker.setMap(null);
            map.setCenter(defaultCenter);
            map.setZoom(11);
            searchButton.disabled = false;
            locateButton.disabled = !navigator.geolocation;
            status.textContent = 'Busca una dirección o toca un punto en el mapa.';
        } catch (error) {
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
        // Keep inline suggestions optional. The text field works without Places.
        const addAutocomplete = async () => {
            try {
                await loadMaps();
                const { Autocomplete } = await window.google.maps.importLibrary('places');
                new Autocomplete(field, { fields: ['formatted_address'] });
                field.removeEventListener('focus', addAutocomplete);
            } catch (error) {
                // The picker reports Maps failures and supports manual entry.
            }
        };
        field.addEventListener('focus', addAutocomplete);
    });

    address.addEventListener('input', () => {
        revision++;
        if (!unavailable.hidden) updateExternalLink();
        confirmButton.disabled = !address.value.trim();
        if (!searchButton.disabled) status.textContent = 'Busca o confirma la dirección escrita.';
    });
    byId('map-search-form').addEventListener('submit', event => {
        event.preventDefault();
        const query = address.value.trim();
        if (query && !searchButton.disabled) geocode({ address: query, region: 'es' }, ++revision);
    });
    locateButton.addEventListener('click', () => {
        const request = ++revision;
        status.textContent = 'Obteniendo tu ubicación…';
        navigator.geolocation.getCurrentPosition(position => {
            if (!isCurrent(request) || authFailed) return;
            const point = { lat: position.coords.latitude, lng: position.coords.longitude };
            map.panTo(point);
            map.setZoom(16);
            selectPoint(point);
        }, () => {
            if (isCurrent(request) && !authFailed) {
                status.textContent = 'No se pudo obtener tu ubicación. Busca una dirección o elige un punto.';
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
