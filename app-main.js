

        // Manejador global de errores asíncronos para debugging
        window.addEventListener('unhandledrejection', function(event) {
            console.error('ERROR ASÍNCRONO NO CAPTURADO:', event.reason);
            console.error('Stack trace:', event.reason?.stack || 'No stack available');
            
            // Intentar identificar el origen del error
            if (event.reason?.message?.includes('listener') || event.reason?.message?.includes('channel')) {
                console.warn('Posible causa: Listener asíncrono con canal cerrado');
                console.warn('Áreas sospechosas: OAuth, Google Maps, o event listeners');
            }
        });

        // Sistema de control de versiones (definido en app-version.js)
        const APP_VERSION = window.APP_VERSION || { version: '1.5.8', date: '', changes: [] };
        
        // Mostrar versión en consola al cargar
        console.log('%c=== PERCU MANAGER ===', 'color: #2563eb; font-weight: bold; font-size: 14px');
        console.log(`%cVersión: ${APP_VERSION.version}`, 'color: #10b981; font-weight: bold');
        console.log(`%cFecha: ${APP_VERSION.date}`, 'color: #6366f1; font-weight: bold');
        console.log('%cCambios recientes:', 'color: #f59e0b; font-weight: bold');
        APP_VERSION.changes.forEach((change, i) => {
            console.log(`%c${i + 1}. ${change}`, 'color: #64748b; font-size: 12px');
        });
        console.log('%c========================', 'color: #2563eb; font-weight: bold; font-size: 14px');

        let tokenClient;
        function tokenStorageKey() {
            return typeof CONFIG !== 'undefined' && CONFIG.DATA_MODE && CONFIG.DATA_MODE !== 'test' ? 'g_token_horas_'+CONFIG.DATA_MODE+(CONFIG.SCOPES.includes('calendar.events.owned')?'_calendar_v1':'') : typeof CONFIG !== 'undefined' && CONFIG.TEST_MODE ? 'g_token_pruebas' : 'g_token';
        }
        let gapiInited = false;
        let gisInited = false;
        let authRestoreStarted = false;
        let authConnecting = false;
        let syncInFlight = null;
        const mutationGate = AppData.createGate();
        window.horasOperationBusy=()=>!!syncInFlight||mutationGate.isBusy();
        function savedSession(){return AuthSession.create(localStorage,tokenStorageKey());}
        function showGoogleConnection(connected,message=''){
            document.getElementById('auth-btn').classList.toggle('hidden',connected);
            document.getElementById('sync-btn').classList.toggle('hidden',!connected);
            document.getElementById('add-future-events-btn').classList.toggle('hidden',!connected);
            document.getElementById('auth-text').innerText=connected?'Conectado':message?'Renovar conexión':'Conectar Google';
            document.getElementById('auth-btn').ariaLabel=message?'Renovar conexión':'Conectar Google';
            document.getElementById('auth-status').textContent=message;
        }
        function expireGoogleConnection(){
            savedSession().clear();if(typeof gapi!=='undefined'&&gapi.client)gapi.client.setToken(null);
            showGoogleConnection(false,'La conexión de Google ha caducado. Pulsa «Renovar conexión» para continuar. Tus datos se conservan.');
        }
        window.horasAccessToken=function(){
            const stored=savedSession().read();
            if(stored.expired){expireGoogleConnection();throw new Error('Renueva la conexión de Google antes de continuar.');}
            if(stored.token&&gapi.client?.getToken()?.access_token!==stored.token)gapi.client.setToken({access_token:stored.token});
            return stored.token;
        };
        window.horasFetch=async function(url,options){
            const send=async(signal)=>{
            const response=await (window.horasGoogleRequests?window.horasGoogleRequests.fetch(url,{...options,signal:signal||options?.signal},{locked:true}):fetch(url,{...options,signal:signal||options?.signal}));
            if(!response.ok){const data=await response.clone().json().catch(()=>({}));if(AuthSession.isAuthError({status:response.status,message:data.error}))expireGoogleConnection();}
            return response;
            };
            if(AppData.mutatingRequest(url,options)){
                if(CONFIG.PROTECTED_MODE&&window.horasWritesEnabled===false)throw AppData.notSent('Solo lectura: los cambios aún no están activados.');
                if(syncInFlight)throw AppData.notSent('Espera a que termine la carga antes de guardar cambios.');
                const save=async()=>{
                    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
                    try{const response=await send(controller.signal);await response.clone().text();return response;}
                    catch(error){if(controller.signal.aborted)throw new Error('El guardado ha tardado demasiado. Recarga para comprobar si se completó.');throw error;}
                    finally{clearTimeout(timer);}
                };
                try{return await mutationGate.enqueue(()=>{
                    if(typeof renderAll==='function')renderAll();
                    if(typeof navigator==='undefined'||!navigator.locks)return save();
                    return (async()=>{
                        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);let acquired=false;
                        try{return await navigator.locks.request('horas-write-'+CONFIG.SPREADSHEET_ID,{signal:controller.signal},()=>{acquired=true;clearTimeout(timer);return save();});}
                        catch(error){if(!acquired&&controller.signal.aborted)throw AppData.notSent('Otra pestaña sigue guardando. Cierra esa pestaña o vuelve a intentarlo.');throw error;}
                        finally{clearTimeout(timer);}
                    })();
                });}finally{if(typeof renderAll==='function')renderAll();}
            }
            return send();
        };
        let eventos = [];
        let grupos = [];
        let calendar;
        // Función para parsear números de Google Sheets (soporta formato español con coma y símbolos de moneda)
        function parseSpanishNumber(val) {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return val;
            if ((CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE) && CONFIG.TEST_PHASE >= 4) return LocaleData.numeric(val) ?? 0;
            
            // Eliminar espacios, símbolos de moneda y otros caracteres no numéricos excepto coma y punto
            let cleanVal = val.toString().replace(/[^\d,.-]/g, '').trim();
            
            // Si hay puntos y comas, asumimos que el punto es separador de miles y la coma decimal (formato español)
            if (cleanVal.includes('.') && cleanVal.includes(',')) {
                cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
            } else if (cleanVal.includes(',')) {
                // Si solo hay coma, es el separador decimal
                cleanVal = cleanVal.replace(',', '.');
            }
            
            const result = parseFloat(cleanVal);
            return isNaN(result) ? 0 : result;
        }
		
        function gapiLoaded() {
            gapi.load('client', async () => {
                await gapi.client.init({
                    discoveryDocs: CONFIG.DISCOVERY_DOCS,
                });
                gapiInited = true;
                checkAuth();
            });
        }

        async function loadOAuthConfig() {
            if ((CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE)) return;
            try {
                if (CONFIG.ENVIRONMENT === 'production' && CONFIG.USE_PROXY) {
                    const response = await fetch(`${CONFIG.PROXY_URL}/api/oauth-config`);
                    const config = await response.json();
                    CONFIG.CLIENT_ID = config.client_id;
                    CONFIG.SCOPES = config.scopes;
                }
            } catch (error) {
                console.error('Error loading OAuth config:', error);
                // Fallback: usar valores por defecto si el proxy falla
                if (!CONFIG.CLIENT_ID) {
                    CONFIG.CLIENT_ID = '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com';
                }
            }
        }

        async function gisLoaded() {
            await loadOAuthConfig();
            if (CONFIG.CLIENT_ID) {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    error_callback: (error) => {
                        authConnecting=false;
                        document.getElementById('review-google-permissions').disabled=false;
                        document.getElementById('auth-btn').disabled=false;
                        hideLoading();
                        document.getElementById('auth-status').textContent='No se completó la conexión. Pulsa «Conectar Google» para volver a intentarlo.';
                        if ((CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE)) document.getElementById('test-result').textContent = 'No se pudo completar la conexión de Google (' + (error.type || 'error de acceso') + ').';
                    },
                    client_id: CONFIG.CLIENT_ID,
                    scope: CONFIG.SCOPES,
                    callback: '', 
                });
                gisInited = true;
                checkAuth();
            } else {
                console.error('CLIENT_ID no disponible para OAuth');
            }
        }

        async function handleAuthClick(reviewPermissions=false) {
            if(authConnecting)return;
            if(!gisInited||!gapiInited||!tokenClient){showErrorModal('Google se está preparando','Espera unos segundos y vuelve a pulsar Conectar Google.','info');return;}
            authConnecting=true;document.getElementById('auth-btn').disabled=true;
            document.getElementById('review-google-permissions').disabled=true;
            showLoading('Conectando con Google...');
            tokenClient.callback = async (resp) => {
                try {
                    if (resp.error !== undefined) throw (resp);
                    if(!google.accounts.oauth2.hasGrantedAllScopes(resp,...CONFIG.SCOPES.split(/\s+/).filter(Boolean)))throw new Error('Faltan permisos necesarios para Calendar y la hoja. Vuelve a conectar y permite crear, editar y eliminar eventos en tus calendarios.');
                    savedSession().save(resp);
                    gapi.client.setToken({access_token:resp.access_token});
                    showGoogleConnection(true);
                    await syncData(false,false);
                } catch(error) {
                    showErrorModal('Conexión de Google',error.message||error.error_description||'No se pudo completar la conexión.','warning');
                } finally {
                    authConnecting=false;document.getElementById('auth-btn').disabled=false;
                    document.getElementById('review-google-permissions').disabled=false;
                    hideLoading();
                }
            };
            try{tokenClient.requestAccessToken(AuthSession.requestOptions(reviewPermissions));}catch(error){authConnecting=false;document.getElementById('auth-btn').disabled=false;document.getElementById('review-google-permissions').disabled=false;hideLoading();showErrorModal('Conexión de Google',error.message,'warning');}
        }

        function checkAuth() {
            if (gapiInited && gisInited && !authRestoreStarted) {
                authRestoreStarted=true;
                const stored=savedSession().read();
                if(stored.expired){expireGoogleConnection();return;}
                const token = stored.token;
                if (token) {
                    gapi.client.setToken({access_token: token});
                    document.getElementById('sync-btn').classList.remove('hidden');
                    document.getElementById('add-future-events-btn').classList.remove('hidden');
                    document.getElementById('auth-btn').classList.add('hidden');
                    document.getElementById('auth-text').innerText = "Conectado";
                    
                    // Intentar sincronizar para validar el token
                    syncData(false,false).catch(err => {if(AuthSession.isAuthError(err))expireGoogleConnection();else document.getElementById('auth-status').textContent='No se pudieron cargar los datos. Puedes reintentar sin volver a iniciar sesión.';});
                } else {
                    // Mostrar botón de autenticación solo cuando no hay token
                    document.getElementById('auth-btn').classList.remove('hidden');
                    document.getElementById('auth-text').innerText = "Conectar Google";
                }
            }
        }

        // Función para asegurar que el botón de auth sea visible al cargar
        function ensureAuthButtonVisible() {
            const authBtn = document.getElementById('auth-btn');
            const token = localStorage.getItem(tokenStorageKey());
            
            if (!token) {
                // Forzar visibilidad del botón si no hay token
                authBtn.classList.remove('hidden');
                document.getElementById('auth-text').innerText = "Conectar Google";
            } else {
                // Ocultar botón si hay token
                authBtn.classList.add('hidden');
            }
        }

        // Llamar inmediatamente cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', ensureAuthButtonVisible);
        } else {
            ensureAuthButtonVisible();
        }
		// FUNCIÓN CLAVE: Proxy para llamadas a Google APIs en producción
        async function proxyGoogleAPI(apiType, method, params = {}, body = null) {
            if ((CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE)) {
                if (!window.horasEnvironmentReady || !await window.horasEnvironmentReady) throw new Error('El destino protegido no está verificado.');
                if (apiType === 'sheets' && params.spreadsheetId !== CONFIG.SPREADSHEET_ID) throw new Error('Destino de hoja bloqueado.');
                if (!((apiType === 'sheets' && method === 'get') || (apiType === 'calendar' && method === 'list'))) throw new Error('Usa la revisión protegida para guardar; Calendar es de solo lectura.');
            }
            if (CONFIG.ENVIRONMENT === 'production' && CONFIG.USE_PROXY) {
                // En producción, usar el proxy
                const proxyUrl = CONFIG[`GOOGLE_${apiType.toUpperCase()}_API_URL`];
                if (!proxyUrl) {
                    throw new Error(`URL del proxy no configurada para ${apiType}`);
                }
                
                // Obtener token de OAuth si está disponible
                const token = window.horasAccessToken();
                
                const headers = {
                    'Content-Type': 'application/json',
                };
                
                // Añadir token de OAuth si existe
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                
                const requestData = {
                    method: method,
                    params: params,
                    body: body
                };
                
                
                const response = await window.horasFetch(proxyUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestData)
                });
                
                return await AppData.readResponse(response);
            } else {
                // En desarrollo, usar gapi directamente
                const service=apiType==='sheets'?gapi.client.sheets.spreadsheets.values:gapi.client.calendar.events;
                if(apiType==='sheets'&&method==='batchUpdate')return (await gapi.client.sheets.spreadsheets.batchUpdate({...params,resource:body})).result;
                return (await service[method]({...params,...(body?{resource:body}:{})})).result;
            }
        }

        // FUNCIÓN CLAVE: Implementación de Exponential Backoff para evitar el error 403
        async function fetchWithBackoff(apiCall, maxRetries = 5) {
            for (let n = 0; n < maxRetries; n++) {
                try {
                    return await apiCall();
                } catch (err) {
                    const isRateLimit = err.status === 403 || err.status === 429;
                    if (isRateLimit && n < maxRetries - 1) {
                        const waitTime = Math.pow(2, n) * 1000 + (Math.random() * 1000);
                        console.warn(`Límite excedido. Reintentando en ${Math.round(waitTime)}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                    throw err;
                }
            }
        }
		// Limpia tildes y caracteres especiales para comparaciones robustas
        function limpiarTexto(texto) {
            if (!texto) return '';
            return texto.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Elimina tildes
                .replace(/[^a-z0-9\s]/g, "")     // Elimina caracteres especiales
                .trim();
        }

        // Busca en Google Calendar el eventId para una fila de Sheets que no lo tenga todavía.
        // Requiere coincidencia de grupo, fecha y horas; solo amarillo, sin asignaciones por descarte.
        // Si no encaja ninguno → deja vacío.
        function formatHoraHHMM(isoDateTime) {
            if (!isoDateTime) return '';
            const d = new Date(isoDateTime);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        function extractHorasFromCalendarEvent(ev) {
            // Para eventos "all-day" (start.date), no hay hora útil → dejamos vacío.
            const startDT = ev?.start?.dateTime || '';
            const endDT = ev?.end?.dateTime || '';
            if (!startDT || !endDT) return { horaInicio: '', horaFin: '' };
            return {
                horaInicio: formatHoraHHMM(startDT),
                horaFin: formatHoraHHMM(endDT)
            };
        }

        async function listAllCalendarEvents(params) {
            return CalendarLinking.listAll(page => proxyGoogleAPI('calendar', 'list', page), params);
        }

        async function fetchCalendarEventInfo(fechaObj, grupoNombre, sitioNombre, sourceEvent = null, sourceRows = eventos) {
            if (!fechaObj) return { status: 'unmatched', id: '', horaInicio: '', horaFin: '' };
            const timeMin = new Date(fechaObj); timeMin.setHours(0,0,0,0);
            const timeMax = new Date(timeMin); timeMax.setDate(timeMax.getDate()+1);
            const response = await listAllCalendarEvents({calendarId:'primary', timeMin:timeMin.toISOString(), timeMax:timeMax.toISOString(), singleEvents:true, orderBy:'startTime'});
            const row = sourceEvent || { grupo:grupoNombre, fechaStr:fechaObj.getDate()+'/'+(fechaObj.getMonth()+1)+'/'+fechaObj.getFullYear() };
            const decision = CalendarLinking.choose(row,response.items,sourceRows);
            return { id:'', horaInicio:'', horaFin:'', ...decision };
        }

        function syncData(resolverCal = false, actualizarRealizadosFlag = false) {
            if(syncInFlight)return syncInFlight;
            if(window.horasOperationBusy?.())return Promise.reject(new Error('Espera a que termine el guardado antes de recargar.'));
            syncInFlight=performDataSync(resolverCal,actualizarRealizadosFlag).then(value=>{setTimeout(()=>window.runAutoPerformed?.(),0);return value;}).finally(()=>{syncInFlight=null;});
            return syncInFlight;
        }
        async function performDataSync(resolverCal = false, actualizarRealizadosFlag = false) {
            if ((CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE) && resolverCal) {
                if (CONFIG.TEST_PHASE >= 3 && window.prepareProtectedSync) return window.prepareProtectedSync();
                showErrorModal('Revisión pendiente', 'Espera a que se compruebe la conexión antes de revisar la sincronización.', 'info');
                return;
            }
            showLoading('Sincronizando datos...');
            try {
                const nativeData = (CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE) && CONFIG.TEST_PHASE >= 4 ? await window.loadNativeData() : null;
                if (nativeData) window.updateLocaleWarnings?.(nativeData);
                // 1. Grupos
                const resColes = nativeData ? {values:nativeData.groups} : await proxyGoogleAPI('sheets', 'get', {
                    spreadsheetId: CONFIG.SPREADSHEET_ID, 
                    range: 'Coles!A2:E'
                });
                const loadedGroups = (resColes.values || []).map((row, index) => AppData.hasContent(row)?({
                    rowIdx: index + 2,
                    nombre: String(row[0]||''),
                    sitio: row[1] || '',
                    precio: LocaleData.numeric(row[2]),
                    precioBolo: LocaleData.numeric(row[3]),
                    ubicacion: row[4] || ''                    
                }):null).filter(Boolean);

                // 2. Sesiones (leemos hasta columna N para incluir calEventId, dirección y horas guardadas)
                const resDetalle = nativeData ? {values:nativeData.details} : await proxyGoogleAPI('sheets', 'get', {
                    spreadsheetId: CONFIG.SPREADSHEET_ID, 
                    range: 'Detalle!A2:N'
                });
                
                const rawRows = resDetalle.values || [];
                const hoy = new Date().setHours(0,0,0,0);
                
                // Mapeamos primero sin calEventId para tener los objetos base
                let eventosBase = rawRows.map((row, index) => {
                    if(!AppData.hasContent(row))return null;
                    const fObj = LocaleData.localDate(LocaleData.parseSpanish(row[5]));
                    let realizado = row[1] === 'X';

                    return {
                        rowIdx: index + 2,
                        sourceVersion: nativeData?.rowVersions?.[index],
                        dateWarning: nativeData?.warnings.some(w => w.rowIdx === index + 2),
                        amountWarning: LocaleData.numeric(row[6])===null || nativeData?.amountWarnings.some(w => w.rowIdx === index + 2 && [4,6].includes(w.column)),
                        pagado: row[0] === 'X',
                        realizado: realizado,
                        autoExcluded: String(row[14]??'').trim().toUpperCase()==='NO'||row[14]===false,
                        boloCole: row[2] || '',
                        clase: row[3] || '',
                        precioHora: parseSpanishNumber(row[4]),
                        fechaStr: row[5] || '',
                        fechaObj: fObj,
                        total: parseSpanishNumber(row[6]),
                        horas: parseSpanishNumber(row[7]),
                        grupo: row[8],
                        sitio: row[9] || '',
                        calEventId: row[10] || '',
                        direccion: row[11] || '',
                        horaInicio: row[12] || '',
                        horaFin: row[13] || ''
                    };
                }).filter(Boolean);

                if (resolverCal) CalendarLinking.assertUniqueLinks(eventosBase);
                const sinId = resolverCal
                    ? eventosBase.filter(ev => !ev.calEventId && ev.fechaObj)
                    : [];
                
                // Sincronizamos Calendar eventIds si hay eventos sin ID
                if (sinId.length > 0) {
                    const updates = [];
                    for (const ev of sinId) {
                        const info = await fetchCalendarEventInfo(ev.fechaObj, ev.grupo, ev.sitio, ev, eventosBase);
                        if (info && info.id) {
                            ev.calEventId = info.id;
                            if (info.horaInicio) ev.horaInicio = info.horaInicio;
                            if (info.horaFin) ev.horaFin = info.horaFin;
                            updates.push({
                                updateCells: {
                                    range: {
                                        sheetId: 0,
                                        startRowIndex: ev.rowIdx - 1,
                                        endRowIndex: ev.rowIdx,
                                        startColumnIndex: 10, // Columna K (0-indexed)
                                        endColumnIndex: 11
                                    },
                                    rows: [{
                                        values: [{
                                            userEnteredValue: { stringValue: info.id }
                                        }]
                                    }],
                                    fields: 'userEnteredValue'
                                }
                            });

                            // Guardar también hora inicio (M) y hora fin (N) si las tenemos
                            if (info.horaInicio) {
                                updates.push({
                                    updateCells: {
                                        range: {
                                            sheetId: 0,
                                            startRowIndex: ev.rowIdx - 1,
                                            endRowIndex: ev.rowIdx,
                                            startColumnIndex: 12, // Columna M (0-indexed)
                                            endColumnIndex: 13
                                        },
                                        rows: [{
                                            values: [{
                                                userEnteredValue: { stringValue: info.horaInicio }
                                            }]
                                        }],
                                        fields: 'userEnteredValue'
                                    }
                                });
                            }

                            if (info.horaFin) {
                                updates.push({
                                    updateCells: {
                                        range: {
                                            sheetId: 0,
                                            startRowIndex: ev.rowIdx - 1,
                                            endRowIndex: ev.rowIdx,
                                            startColumnIndex: 13, // Columna N (0-indexed)
                                            endColumnIndex: 14
                                        },
                                        rows: [{
                                            values: [{
                                                userEnteredValue: { stringValue: info.horaFin }
                                            }]
                                        }],
                                        fields: 'userEnteredValue'
                                    }
                                });
                            }
                        }
                    }
                    // Guardamos todos los IDs encontrados en Sheets de una vez
                    if (updates.length > 0) {
                        await proxyGoogleAPI('sheets', 'batchUpdate', {
                            spreadsheetId: CONFIG.SPREADSHEET_ID
                        }, {
                            requests: updates
                        });
                    }
                }

                // 3. Importar eventos nuevos desde Calendar (evitando duplicados)
                if (resolverCal) {
                    const now = new Date();
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    const oneMonthAhead = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    
                    // Obtener eventos del Calendar
                    const calendarResponse = await listAllCalendarEvents({
                        calendarId: 'primary',
                        timeMin: threeMonthsAgo.toISOString(),
                        timeMax: oneMonthAhead.toISOString(),
                        singleEvents: true,
                        orderBy: 'startTime'
                    });
                    
                    const allEvents = calendarResponse.items || [];
                    
                    // Filtrar solo eventos con colorId 5 (amarillo)
                    const events = allEvents.filter(ev => {
                        // Validación robusta del colorId
                        if (!ev.colorId) {
                            console.warn('Evento sin colorId:', ev.summary || 'Sin título');
                            return false;
                        }
                        // Asegurar que colorId sea string y comparar correctamente
                        const colorIdStr = String(ev.colorId);
                        const isValid = colorIdStr === '5';
                        if (!isValid) {
                            console.warn('Evento con colorId diferente a 5:', ev.summary || 'Sin título', 'colorId:', ev.colorId);
                        }
                        return isValid;
                    });
                    
                    if (events.length > 0) {
                        // Crear set de calEventId existentes para búsqueda rápida
                        const existingEventIds = new Set();
                        const existingEventKeys = new Set(); // Para verificación adicional
                        eventosBase.forEach(event => {
                            if (event.calEventId) existingEventIds.add(event.calEventId);
                            const uniqueKey = CalendarLinking.eventKey(event);
                            if (uniqueKey) existingEventKeys.add(uniqueKey);
                        });
                        
                        // Procesar cada evento y añadirlo si no existe
                        const rowsToAdd = [];
                        let processedCount = 0;
                        let skippedCount = 0;
                        let updateCount = 0;
                        
                        for (const event of events) {
                            try {
                                // Procesar evento para obtener datos actuales del Calendar
                                const tempRow = await processCalendarEvent(event);
                                if (!tempRow) {
                                    console.warn(`No se pudo procesar evento ${event.id}`);
                                    continue;
                                }
                                
                                // Guardar tempRow en el evento para usarlo en comparaciones
                                event.tempRow = tempRow;
                                
                                // Verificar si el evento ya existe por calEventId
                                if (existingEventIds.has(event.id)) {
                                    // El evento existe, verificar si hay cambios
                                    const existingEvent = eventosBase.find(ev => ev.calEventId === event.id);
                                    if (existingEvent) {
                                        // Convertir evento existente a formato de fila para comparación
                                        const existingRow = [
                                            existingEvent.pagado ? 'X' : '',
                                            existingEvent.realizado ? 'X' : '',
                                            existingEvent.boloCole,
                                            existingEvent.clase,
                                            existingEvent.precioHora,
                                            existingEvent.fechaStr,
                                            existingEvent.total.toFixed(2).replace('.', ',') + ' €',
                                            existingEvent.horas,
                                            existingEvent.grupo,
                                            existingEvent.sitio,
                                            existingEvent.calEventId,
                                            existingEvent.direccion,
                                            existingEvent.horaInicio,
                                            existingEvent.horaFin
                                        ];
                                        
                                        // Verificar si hay cambios
                                        if (hasEventChanges(event, existingRow)) {
                                            // Hay cambios, actualizar el registro existente
                                            const updated = await updateExistingEvent(existingEvent.rowIdx, event, existingEvent);
                                            if (updated) {
                                                updateCount++;
                                                console.log(`Evento ${event.id} actualizado con cambios de fecha/hora`);
                                            } else {
                                                console.warn(`No se pudo actualizar evento ${event.id}`);
                                            }
                                        } else {
                                            // No hay cambios, omitir
                                            skippedCount++;
                                        }
                                    } else {
                                        skippedCount++;
                                    }
                                    continue;
                                }
                                
                                // El evento no existe, verificar si es un nuevo evento
                                const fecha = tempRow[5]; // Columna F: fecha
                                const grupo = tempRow[8]; // Columna I: grupo
                                const horaInicio = tempRow[12]; // Columna M: horaInicio
                                const horaFin = tempRow[13]; // Columna N: horaFin
                                
                                // Verificar duplicado por fecha+grupo+horas
                                if (fecha && grupo) {
                                    const uniqueKey = CalendarLinking.eventKey({fechaStr:fecha,grupo,horaInicio,horaFin});
                                    if (existingEventKeys.has(uniqueKey)) {
                                        skippedCount++;
                                        continue;
                                    }
                                }
                                
                                if (eventosBase.some(ev => !ev.calEventId && CalendarLinking.compatible(ev, event))) {
                                    skippedCount++;
                                    continue; // Resolver la ambigüedad antes de añadir otra fila.
                                }
                                existingEventIds.add(event.id);
                                existingEventKeys.add(CalendarLinking.eventKey({fechaStr:fecha,grupo,horaInicio,horaFin}));
                                rowsToAdd.push(tempRow);
                                processedCount++;
                            } catch (err) {
                                console.warn(`Error procesando evento ${event.id}:`, err);
                            }
                        }
                        
                        // Mostrar resumen de sincronización
                        let message = '';
                        if (processedCount > 0 || updateCount > 0) {
                            message = `Sincronización completada: `;
                            const parts = [];
                            if (processedCount > 0) parts.push(`${processedCount} nuevos eventos`);
                            if (updateCount > 0) parts.push(`${updateCount} eventos actualizados`);
                            if (skippedCount > 0) parts.push(`${skippedCount} omitidos`);
                            message += parts.join(', ') + '.';
                            showErrorModal('Sincronización Completada', message, 'success');
                        } else if (skippedCount > 0) {
                            showErrorModal('Sincronización', `${skippedCount} eventos ya estaban sincronizados.`, 'info');
                        }
                        
                        // Añadir nuevos eventos al spreadsheet
                        if (rowsToAdd.length > 0) {
                            await proxyGoogleAPI('sheets', 'append', {
                                spreadsheetId: CONFIG.SPREADSHEET_ID,
                                range: 'Detalle!A:N',
                                valueInputOption: 'USER_ENTERED',
                                insertDataOption: 'INSERT_ROWS'
                            }, {
                                values: rowsToAdd
                            });
                            
                            // Recargar eventos base para incluir los nuevos
                            const resDetalleActualizado = await proxyGoogleAPI('sheets', 'get', {
                                spreadsheetId: CONFIG.SPREADSHEET_ID, 
                                range: 'Detalle!A2:N'
                            });
                            
                            const rawRowsActualizado = resDetalleActualizado.values || [];
                            eventosBase = rawRowsActualizado.map((row, index) => {
                                const fParts = (row[5] || "").split("/");
                                const fObj = fParts.length === 3 ? new Date(fParts[2], fParts[1]-1, fParts[0]) : null;
                                let realizado = row[1] === 'X';

                                return {
                                    rowIdx: index + 2,
                                    pagado: row[0] === 'X',
                                    realizado: realizado,
                                    boloCole: row[2] || '',
                                    clase: row[3] || '',
                                    precioHora: parseSpanishNumber(row[4]),
                                    fechaStr: row[5],
                                    fechaObj: fObj,
                                    total: parseSpanishNumber(row[6]),
                                    horas: parseSpanishNumber(row[7]),
                                    grupo: row[8],
                                    sitio: row[9] || '',
                                    calEventId: row[10] || '',
                                    direccion: row[11] || '',
                                    horaInicio: row[12] || '',
                                    horaFin: row[13] || ''
                                };
                            });
                        }
                    }
                }

                grupos = loadedGroups;
                eventos = eventosBase.sort((a,b) => (b.fechaObj - a.fechaObj));

                renderAll();
                updateFinancialStats();
                window.refreshCalendarPending?.().catch(error=>console.warn("No se pudieron consultar los cambios pendientes",error.message));
                
                // 4. Actualizar automáticamente las clases realizadas (solo en la carga inicial)
                if (actualizarRealizadosFlag) {
                    await actualizarRealizados();
                }
            } catch (err) { 
        console.error("Error sync:", err);
        
        // Detectar error de autenticación y limpiar token inválido
        if (AuthSession.isAuthError(err)) {
            console.error('Token inválido detectado en syncData, limpiando localStorage');
            expireGoogleConnection();
            
            // Lanzar error para que checkAuth() también sepa que falló
            throw err;
        }
        const notice=document.getElementById('test-result')||document.getElementById('auth-status');
        if(notice)notice.textContent='No se pudieron recargar los datos. Se conserva la última vista: '+err.message;
        throw err;
    } finally {
        hideLoading();
    }
        }

        // Función para actualizar automáticamente las clases realizadas en el spreadsheet
        async function actualizarRealizados() {
            try {
                const hoy = new Date().setHours(0,0,0,0);
                const updates = [];
                
                // Volver a leer los datos originales del spreadsheet para comparar correctamente
                const resDetalle = await proxyGoogleAPI('sheets', 'get', {
                    spreadsheetId: CONFIG.SPREADSHEET_ID, 
                    range: 'Detalle!A2:I'  // Incluir hasta columna I para obtener fecha y grupo
                });
                
                const rawRows = resDetalle.values || [];
                
                // Buscar clases que deberían estar realizadas pero no lo están en el spreadsheet
                for (let i = 0; i < rawRows.length; i++) {
                    const row = rawRows[i];
                    const rowIdx = i + 2; // +2 porque empieza en A2
                    
                    // Extraer fecha directamente del spreadsheet (columna F = index 5)
                    const fechaStr = row[5] || '';
                    if (!fechaStr) continue;
                    
                    // Parsear fecha del spreadsheet
                    const fParts = fechaStr.split("/");
                    const fechaObj = fParts.length === 3 ? new Date(fParts[2], fParts[1]-1, fParts[0]) : null;
                    
                    if (!fechaObj) continue;
                    
                    const fueRealizadoOriginalmente = row[1] === 'X'; // Valor original del spreadsheet
                    const deberiaEstarRealizado = fechaObj < hoy;
                    
                    // Obtener nombre del grupo si está disponible
                    const grupo = row[8] || 'Sin nombre';
                    
                    // Si debería estar realizado pero no estaba marcado como X en la columna B
                    if (deberiaEstarRealizado && !fueRealizadoOriginalmente) {
                        updates.push({
                            rowIdx: rowIdx,
                            grupo: grupo,
                            fechaStr: fechaStr
                        });
                    }
                }
                
                // Actualizar celdas individualmente para preservar formato de checkbox
                if (updates.length > 0) {
                    for (const update of updates) {
                        // Usar método update para preservar formato de checkbox
                        await proxyGoogleAPI('sheets', 'update', {
                            spreadsheetId: CONFIG.SPREADSHEET_ID,
                            range: `Detalle!B${update.rowIdx}`,
                            valueInputOption: 'USER_ENTERED'
                        }, {
                            values: [['X']]
                        });
                    }
                }
            } catch (err) {
                console.error("Error actualizando realizados:", err);
            }
        }

        // Helpers UI Finales
        async function togglePago(rowIdx,newState){
            const event=eventos.find(e=>e.rowIdx===rowIdx);if(!event||event.paymentSaving)return;
            const previous=event.pagado;event.paymentSaving=true;event.paymentUncertain=false;event.paymentError=false;event.pagado=newState;renderAll();updateFinancialStats();
            try{
                if(CONFIG.PROTECTED_MODE||CONFIG.TEST_MODE){
                    if(!await window.horasEnvironmentReady)throw Error('La conexión aún no está preparada.');
                    const token=window.horasAccessToken();if(!token)throw Error('Conecta Google para guardar los pagos.');
                    const response=await window.horasFetch(CONFIG.STATE_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,action:'setPayment',rowIdx,paid:newState,expectedVersion:event.sourceVersion})});
                    const saved=await AppData.readResponse(response);if(saved.paid!==newState||!saved.version||saved.spreadsheetId!==CONFIG.SPREADSHEET_ID||saved.calendarModified!==false)throw Error('Falta confirmar el pago.');event.sourceVersion=saved.version;
                }else await proxyGoogleAPI('sheets','update',{spreadsheetId:CONFIG.SPREADSHEET_ID,range:'Detalle!A'+rowIdx,valueInputOption:'RAW'},{values:[[newState?'X':'']]});
            }catch(error){
                event.pagado=previous;
                let verified=false;
                if((CONFIG.PROTECTED_MODE||CONFIG.TEST_MODE)&&!error.notSent){
                    try{const token=window.horasAccessToken();if(token){const response=await window.horasFetch(CONFIG.STATE_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,action:'getPayment',rowIdx})});const saved=await AppData.readResponse(response);if(typeof saved.paid==='boolean'&&saved.version&&saved.spreadsheetId===CONFIG.SPREADSHEET_ID&&saved.calendarModified===false){event.pagado=saved.paid;event.sourceVersion=saved.version;verified=true;}}}catch{}
                }
                event.paymentError=!verified||event.pagado!==newState;
                if(event.paymentError){
                    const reason=/429|quota|cuota/i.test(error.message)?'Google ha limitado temporalmente las consultas. Espera un minuto antes de volver a intentarlo.':/cambi[oó]|recarga/i.test(error.message)?'Actualiza los datos antes de volver a intentarlo.':'Comprueba la conexión con Google y vuelve a intentarlo.';
                    showErrorModal('Pago no guardado','No se pudo guardar el pago de '+(event.grupo||'la sesión')+(event.fechaStr?' ('+event.fechaStr+')':'')+'. '+(verified?'Se muestra el estado de la hoja. ':'Se ha restaurado su estado anterior. ')+reason,'warning');
                }
            }finally{event.paymentSaving=false;renderAll();updateFinancialStats();}
        }
        function toggleRecurrence() {
            const isChecked = document.getElementById('ev-repite').checked;
            const options = document.getElementById('recurrence-options');
            if (isChecked) {
                options.classList.remove('hidden');
            } else {
                options.classList.add('hidden');
            }
        }

        function showConfirmModal(message, callback) {
            document.getElementById('confirm-message').textContent = message;
            confirmCallback = callback;
            document.getElementById('modal-confirm').classList.remove('hidden');
        }

        function closeConfirmModal(confirmed) {
            document.getElementById('modal-confirm').classList.add('hidden');
            if (confirmCallback) {
                confirmCallback(confirmed);
                confirmCallback = null;
            }
        }

        function confirmarBorrar(rowIdx) {
            const ev = eventos.find(e => e.rowIdx === rowIdx);
            if (ev && ev.calEventId && eventos.some(other => other.rowIdx !== rowIdx && other.calEventId === ev.calEventId)) {
                showErrorModal('Vínculo compartido', 'Revisa el CalendarId antes de borrar. Podría pertenecer a otra clase.', 'warning');
                return;
            }
            const mensaje = ev ? 
                `¿Seguro que quieres borrar la clase "${ev.grupo}" del ${ev.fechaStr}? Esta acción no se puede deshacer.` :
                "¿Seguro que quieres borrar esta fila? Esta acción no se puede deshacer.";
            
            showConfirmModal(mensaje, async (confirmed) => {
                if (confirmed) {
                    // 1. Borrar evento de Google Calendar si existe
                    if (ev && ev.calEventId) {
                        try {
                            await proxyGoogleAPI('calendar', 'delete', {
                                calendarId: 'primary',
                                eventId: ev.calEventId
                            });
                        } catch(calErr) {
                                // Continuamos aunque falle Calendar (puede que el evento ya no exista)
                        }
                    }
                    // 2. Borrar fila de Sheets
                    await proxyGoogleAPI('sheets', 'batchUpdate', {
                        spreadsheetId: CONFIG.SPREADSHEET_ID
                    }, {
                        requests: [{ deleteDimension: { range: { sheetId: 0, dimension: "ROWS", startIndex: rowIdx - 1, endIndex: rowIdx } } }]
                    });
                    syncData();
                }
            });
        }

        function switchTab(tabId) {
            ['eventos', 'calendario', 'maestros', 'repertorio'].forEach(t => {
                if (t === 'repertorio' && typeof CONFIG !== 'undefined' && CONFIG.DATA_MODE !== 'production') return;
                document.getElementById('tab-' + t).classList.add('hidden');
                document.getElementById(t === 'repertorio' ? 'repertoire-entry' : 'btn-' + t).className = "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all text-slate-400 flex items-center justify-center gap-2";
            });
            document.getElementById('tab-' + tabId).classList.remove('hidden');
            document.getElementById(tabId === 'repertorio' ? 'repertoire-entry' : 'btn-' + tabId).className = "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 tab-active";
            if(tabId === 'calendario') {
                setTimeout(() => {
                    if (calendar && calendar.render) {
                        calendar.render();
                        highlightTodayInMobileCalendar();
                    }
                }, 50);
            }
        }

        function highlightTodayInMobileCalendar() {
            // Los estilos del día de hoy ahora se manejan completamente con CSS
            // No se necesita JavaScript para aplicar estilos inline
        }

        function openAddFutureEventsModal() {
            // Poblar select de años (año actual y 2 años futuros)
            const yearSelect = document.getElementById('future-year');
            const currentYear = new Date().getFullYear();
            yearSelect.innerHTML = '<option value="">Selecciona un año...</option>';
            
            for (let i = 0; i <= 2; i++) {
                const year = currentYear + i;
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            }
            
            // Seleccionar mes y año actuales por defecto
            const currentMonth = new Date().getMonth() + 1;
            document.getElementById('future-month').value = currentMonth;
            document.getElementById('future-year').value = currentYear;
            
            openModal('modal-future-events');
        }

        function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
        function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

        // Función para actualizar estadísticas financieras
        function updateFinancialStats() {
            const statsInfo = document.getElementById('stats-info');
            if (!statsInfo) return;
            
            const reportScope=window.horasReportScope?.()||{curso:'all',grupo:''};
            const reportEvents=window.ReportTools?ReportTools.filterSessions(eventos,reportScope,LocaleData.parseSpanish,GroupIdentity.id):eventos;
            // Calcular totales
            let totalCobrar = 0;
            let totalPendiente = 0;
            
            reportEvents.forEach(ev => {
                if (!ev.pagado && !ev.amountWarning) {
                    totalCobrar += ev.total;
                    totalPendiente += ev.total;
                }
            });
            
            // Estimación de IRPF configurada por el usuario.
            const retencionIRPF = totalCobrar * 0.35;
            const totalNeto = totalCobrar - retencionIRPF;
            
            // Formatear números
            const formatCurrency = (amount) => {
                return LocaleData.currency(amount);
            };
            
            // Actualizar el span con la información financiera
            statsInfo.innerHTML = `
                <div class="financial-overview">
                    <div class="financial-cards">
                        <div class="financial-card financial-card-main"><span>Pendiente de cobro (bruto)</span><strong>${formatCurrency(totalCobrar)}</strong></div>
                        <div class="financial-card"><span>IRPF estimado (35 %)</span><strong>${formatCurrency(retencionIRPF)}</strong></div>
                        <div class="financial-card"><span>Estimado tras IRPF</span><strong>${formatCurrency(totalNeto)}</strong></div>
                    </div>
                    <details class="financial-explanation"><summary>Cómo se calcula</summary><p>Periodo: ${reportScope.curso==='all'?'todo el histórico':reportScope.curso}. Grupo: ${reportScope.grupo?'grupo seleccionado':'todos'}. Estos filtros son independientes de la lista de sesiones. Los importes sin interpretar se excluyen. IRPF estimado con el 35 % configurado; no es una liquidación fiscal.</p></details>
                </div>
            `;
        }

        async function importFutureEvents(month, year) {
            showLoading('Importando eventos...');
            
            try {
                // 1. Cargar grupos desde el spreadsheet (igual que syncData)
                const resColes = await proxyGoogleAPI('sheets', 'get', {
                    spreadsheetId: CONFIG.SPREADSHEET_ID, 
                    range: 'Coles!A2:E'
                });
                grupos = (resColes.values || []).map((row, index) => ({
                    rowIdx: index + 2,
                    nombre: row[0],
                    sitio: row[1] || '',
                    precio: LocaleData.numeric(row[2]),
                    precioBolo: LocaleData.numeric(row[3]),
                    ubicacion: row[4] || ''                    
                }));
                
                // Calcular rango de fechas para el mes seleccionado de forma robusta
                const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
                const endDate = new Date(year, month, 1, 0, 0, 0, 0);
                
                const timeMin = startDate.toISOString();
                const timeMax = endDate.toISOString();
                
                // 2. Obtener eventos de Google Calendar
                const calendarResponse = await listAllCalendarEvents({
                    calendarId: 'primary',
                    timeMin: timeMin,
                    timeMax: timeMax,
                    singleEvents: true,
                    orderBy: 'startTime'
                });
                
                const allEvents = calendarResponse.items || [];
                
                // Filtrar solo eventos con colorId 5 (amarillo)
                const events = allEvents.filter(ev => {
                    if (!ev.colorId) return false;
                    return String(ev.colorId) === '5';
                });
                
                // Procesar eventos de Calendar para obtener su representación en Excel (tempRow)
                for (const event of events) {
                    event.tempRow = await processCalendarEvent(event);
                }
                
                // 3. Obtener eventos existentes del spreadsheet en rango completo Detalle!A2:N
                const existingEvents = await proxyGoogleAPI('sheets', 'get', {
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: 'Detalle!A2:N'
                });
                
                const allSheetRows = existingEvents.values || [];
                
                // Mapear filas completas a objetos
                const sheetEvents = allSheetRows.map((row, index) => {
                    const fParts = (row[5] || "").split("/");
                    const fObj = fParts.length === 3 ? new Date(fParts[2], fParts[1]-1, fParts[0]) : null;
                    return {
                        rowIdx: index + 2,
                        pagado: row[0] === 'X',
                        realizado: row[1] === 'X',
                        boloCole: row[2] || '',
                        clase: row[3] || '',
                        precioHora: parseSpanishNumber(row[4]) || 0,
                        fechaStr: row[5] || '',
                        fechaObj: fObj,
                        total: parseSpanishNumber(row[6]) || 0,
                        horas: parseSpanishNumber(row[7]) || 1,
                        grupo: row[8] || '',
                        sitio: row[9] || '',
                        calEventId: row[10] || '',
                        direccion: row[11] || '',
                        horaInicio: row[12] || '',
                        horaFin: row[13] || ''
                    };
                });
                
                CalendarLinking.assertUniqueLinks(sheetEvents);
                // Filtrar eventos del spreadsheet para el mes y año seleccionados
                const sheetEventsInMonth = sheetEvents.filter(ev => 
                    ev.fechaObj && 
                    (ev.fechaObj.getMonth() + 1) === month && 
                    ev.fechaObj.getFullYear() === year
                );
                
                if (events.length === 0 && sheetEventsInMonth.length === 0) {
                    showErrorModal('Sin Eventos Válidos', 'No se encontraron eventos en el mes seleccionado ni en Google Calendar ni en el Spreadsheet.', 'info');
                    return;
                }
                
                // Registro de estados y matched IDs/Keys
                const matchedCalendarEventIds = new Set(sheetEvents.map(ev => ev.calEventId).filter(Boolean));
                const rowsToAdd = [];
                let insertedInSheets = 0;
                let updatedInSheets = 0;
                let insertedInCalendar = 0;
                let skippedCount = 0;
                
                // Paso 1: Cruzar datos de Sheets a Calendar
                for (const sheetEv of sheetEventsInMonth) {
                    let calEv = null;
                    
                    // Buscar coincidencia en Calendar
                    if (sheetEv.calEventId) {
                        calEv = events.find(e => e.id === sheetEv.calEventId);
                    }
                    
                    if (!calEv && !sheetEv.calEventId) {
                        const decision = CalendarLinking.choose(sheetEv, events, sheetEvents);
                        if (decision.status === 'matched') calEv = events.find(e => e.id === decision.id);
                    }

                    if (calEv) {
                        // El evento existe en ambos lados
                        matchedCalendarEventIds.add(calEv.id);
                        
                        // Convertir evento de la hoja a fila para comparación
                        const existingRow = [
                            sheetEv.pagado ? 'X' : '',
                            sheetEv.realizado ? 'X' : '',
                            sheetEv.boloCole,
                            sheetEv.clase,
                            sheetEv.precioHora,
                            sheetEv.fechaStr,
                            sheetEv.total.toFixed(2).replace('.', ',') + ' €',
                            sheetEv.horas,
                            sheetEv.grupo,
                            sheetEv.sitio,
                            sheetEv.calEventId,
                            sheetEv.direccion,
                            sheetEv.horaInicio,
                            sheetEv.horaFin
                        ];
                        
                        const needsIdUpdate = sheetEv.calEventId !== calEv.id;
                        const hasChanges = hasEventChanges(calEv, existingRow);
                        
                        if (hasChanges || needsIdUpdate) {
                            // Actualizar calEventId en tempRow antes de guardarlo en Excel
                            calEv.tempRow[10] = calEv.id;
                            
                            const updated = await updateExistingEvent(sheetEv.rowIdx, calEv, sheetEv);
                            if (updated) {
                                sheetEv.calEventId = calEv.id;
                                updatedInSheets++;
                            }
                        } else {
                            skippedCount++;
                        }
                    } else {
                        // Ausente del mes no equivale a borrado: conservar el vínculo y no recrear.
                        skippedCount++;
                        console.warn('Vínculo pendiente de revisión; no se crea un evento nuevo', sheetEv.rowIdx);
                    }
                }

                // Paso 2: Agregar a Sheets los eventos que están en Calendar pero no en Sheets
                const unmatchedEvents = events.filter(e => !matchedCalendarEventIds.has(e.id));
                for (const unmatchedEv of unmatchedEvents) {
                    if (sheetEvents.some(ev => CalendarLinking.compatible(ev, unmatchedEv))) {
                        skippedCount++;
                        continue;
                    }
                    if (unmatchedEv.tempRow) {
                        rowsToAdd.push(unmatchedEv.tempRow);
                        insertedInSheets++;
                    }
                }
                
                // Insertar los registros nuevos en Sheets en lote
                if (rowsToAdd.length > 0) {
                    await proxyGoogleAPI('sheets', 'append', {
                        spreadsheetId: CONFIG.SPREADSHEET_ID,
                        range: 'Detalle!A:N',
                        valueInputOption: 'USER_ENTERED',
                        insertDataOption: 'INSERT_ROWS'
                    }, {
                        values: rowsToAdd
                    });
                }
                
                // 4. Mostrar resumen completo
                let message = '';
                const parts = [];
                if (insertedInSheets > 0) parts.push(`${insertedInSheets} nuevos en Sheets`);
                if (updatedInSheets > 0) parts.push(`${updatedInSheets} actualizados en Sheets`);
                if (insertedInCalendar > 0) parts.push(`${insertedInCalendar} agregados a Calendar`);
                if (skippedCount > 0) parts.push(`${skippedCount} omitidos (sin cambios)`);
                
                if (parts.length > 0) {
                    message = `Operación completada: ` + parts.join(', ') + '.';
                } else {
                    message = `No se realizaron cambios.`;
                }
                
                showErrorModal('Importación y Sincronización', message, 'success');
                
            } catch (error) {
                console.error('Error en importFutureEvents:', error);
                throw error;
            } finally {
                hideLoading();
            }
        }

        // Función para detectar cambios entre evento de Calendar y registro existente en Excel
        function hasEventChanges(calendarEvent, existingRow) {
            const calendarData = {
                fecha: calendarEvent.tempRow ? calendarEvent.tempRow[5] : '',
                horaInicio: calendarEvent.tempRow ? calendarEvent.tempRow[12] : '',
                horaFin: calendarEvent.tempRow ? calendarEvent.tempRow[13] : '',
                grupo: calendarEvent.tempRow ? calendarEvent.tempRow[8] : '',
                sitio: calendarEvent.tempRow ? calendarEvent.tempRow[9] : ''
            };
            
            const excelData = {
                fecha: existingRow[5] || '',
                horaInicio: existingRow[12] || '',
                horaFin: existingRow[13] || '',
                grupo: existingRow[8] || '',
                sitio: existingRow[9] || ''
            };
            
            // Comparar campos clave
            return calendarData.fecha !== excelData.fecha ||
                   calendarData.horaInicio !== excelData.horaInicio ||
                   calendarData.horaFin !== excelData.horaFin ||
                   (calendarData.grupo !== excelData.grupo && !GroupIdentity.same(calendarData.grupo,excelData.grupo)) ||
                   calendarData.sitio !== excelData.sitio;
        }

        // Función para actualizar un registro existente en Excel
        async function updateExistingEvent(rowIdx, calendarEvent, existingEvent = null) {
            if (!calendarEvent.tempRow) return false;
            
            try {
                // Preparar datos para actualización (mantener columnas A y B si existen)
                const updateRow = [...calendarEvent.tempRow];
                updateRow[0] = existingEvent && existingEvent.pagado ? 'X' : '';
                updateRow[1] = existingEvent && existingEvent.realizado ? 'X' : '';
                
                await proxyGoogleAPI('sheets', 'update', {
                    spreadsheetId: CONFIG.SPREADSHEET_ID,
                    range: `Detalle!A${rowIdx}:N${rowIdx}`,
                    valueInputOption: 'USER_ENTERED'
                }, {
                    values: [updateRow]
                });
                
                return true;
            } catch (err) {
                console.error('Error actualizando evento existente:', err);
                return false;
            }
        }

        // Función para procesar un evento de calendar y convertirlo a fila del spreadsheet
        async function processCalendarEvent(event) {
            // Extraer información del evento
            const title = event.summary || 'Sin título';
            const start = event.start;
            const end = event.end;
            
            // Parsear fechas y horas usando las mismas funciones que syncData
            let startDate, endDate, horaInicio, horaFin;
            
            if (start.dateTime) {
                // Evento con hora específica
                startDate = new Date(start.dateTime);
                endDate = new Date(end.dateTime);
                
                // Usar la misma función que syncData para formatear horas
                const horasInfo = extractHorasFromCalendarEvent(event);
                horaInicio = horasInfo.horaInicio;
                horaFin = horasInfo.horaFin;
            } else if (start.date) {
                // Evento de día completo - usar valores por defecto como syncData
                startDate = new Date(start.date);
                endDate = new Date(end.date);
                horaInicio = '';
                horaFin = '';
            } else {
                return null; // Evento sin fecha válida
            }
            
            // Formatear fecha para spreadsheet (mismo formato que syncData)
            const fFormat = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}`;
            
            // Extraer información del título como lo hace el formulario
            let grupo = 'Sin grupo';
            let sitio = '';
            
            // Determinar si es un evento de Bolo
            const tieneBolo = title.toLowerCase().includes('bolo');

            
            if (title.includes(' - ')) {
                const parts = title.split(' - ');
                grupo = parts[0].trim();
                sitio = parts.slice(1).join(' - ').trim(); // El resto es el sitio
            } else {
                // Si no tiene formato "Grupo - Sitio", asumimos que todo es el grupo
                grupo = title.trim();
                sitio = '';
            }

            grupo = grupo.replace(/^Bolo\s+/, "");
            
            // Determinar si es Maracuya para la columna clase (como en el formulario)
            const isMaracuya = grupo.toLowerCase().includes('maracuyá') || grupo.toLowerCase().includes('maracuya');
            
            // Marcar campo BoloCole si contiene la palabra "Bolo"
            const boloCole = tieneBolo ? "X" : ""; 
            const clase = isMaracuya ? "" : "X"; // Columna D: "" para Maracuya, "X" para otros
            
            // Buscar información del grupo como hace el formulario
            const g = GroupIdentity.resolve(grupos,grupo);
            if(g)grupo = g.nombre;
            
            // Usar precio bolo si es evento de Bolo, sino precio normal
            const precio = g ? (tieneBolo ? g.precioBolo : g.precio) : null;
            if(precio === null || !Number.isFinite(precio))throw new Error(`El grupo «${grupo}» no tiene una tarifa válida para este tipo de sesión. Revisa Coles antes de importar.`);
            const ubicacion = g ? g.ubicacion : ''; // Ubicación del grupo
            const direccion = typeof event.location === 'string' && event.location.trim() ? event.location.trim() : (g ? g.sitio : '');
            
            // Calcular horas y total (misma lógica que el formulario)
            let horasCalc = 1;
            
            if (horaInicio && horaFin) {
                // Calcular horas reales si tenemos horas específicas
                const [h1, m1] = horaInicio.split(':').map(Number);
                const [h2, m2] = horaFin.split(':').map(Number);
                const minutosInicio = h1 * 60 + m1;
                const minutosFin = h2 * 60 + m2;
                horasCalc = (minutosFin - minutosInicio) / 60;
                
                if (horasCalc <= 0) horasCalc = 1; // Mínimo 1 hora
            }
            
            // Para la columna H siempre guardamos 1, y el total se calcula en base a Precio * 1
            const horasParaColumnaH = 1;
            const totalStr = precio.toFixed(2).replace(".",",") + " €";
            
            // Crear fila para spreadsheet con el mismo orden que el formulario
            const fila = [
                '', // Columna A: pagado
                '', // Columna B: realizado
                boloCole, // Columna C: boloCole
                clase, // Columna D: clase ("" para Maracuya, "X" para otros)
                precio, // Columna E: precio hora
                fFormat, // Columna F: fecha
                totalStr, // Columna G: total
                horasParaColumnaH, // Columna H: horas (siempre 1)
                grupo, // Columna I: grupo
                ubicacion, // Columna J: ubicacion
                event.id, // Columna K: calEventId
                direccion, // Columna L: direccion (sitio)
                horaInicio, // Columna M: horaInicio
                horaFin // Columna N: horaFin
            ];
            
            return fila;
        }

        
        // Función auxiliar para formatear tiempo
        function formatTime(date) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        window.onload = async () => {
            await window.horasConfigReady;
            gapiLoaded();
            gisLoaded();
            ensureAuthButtonVisible();
            lucide.createIcons();
        };
    