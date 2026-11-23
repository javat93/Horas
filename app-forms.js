        function openNewSesionModal() {
            for(const id of ['ev-fecha','ev-grupo','ev-grupo-search','ev-bolo','ev-sitio','ev-repite','ev-freq','ev-interval','ev-until'])document.getElementById(id).disabled=false;
            document.getElementById('protected-session-fields').hidden=false;
            document.getElementById('ev-total').value='';
            for(const id of ['ev-hora-inicio','ev-hora-fin'])document.getElementById(id).required=true;
            document.getElementById('modal-evento-title').innerText = "Nueva clase";
            document.getElementById('form-evento').reset();
            document.getElementById('session-performed-control').hidden = true;
            document.getElementById('ev-realizado').disabled = true;
            document.getElementById('ev-realizado').checked = false;
            document.getElementById('ev-calendar').checked=true;
            document.getElementById('ev-rowIdx').value = "";
            document.getElementById('sync-calendar-wrapper').classList.remove('hidden');
            document.getElementById('recurrence-options').classList.add('hidden');

            // Establecer duración por defecto de 1 hora
            const now = new Date();
            const horaActual = now.getHours().toString().padStart(2, '0');
            const minutosActuales = Math.floor(now.getMinutes() / 15) * 15; // Redondear a 15 minutos
            const minutosStr = minutosActuales.toString().padStart(2, '0');

            const madridParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
            document.getElementById('ev-fecha').value=['year','month','day'].map(type=>madridParts.find(p=>p.type===type).value).join('-');
            refreshGroupLabels();
            document.getElementById('ev-hora-inicio').value = `${horaActual}:${minutosStr}`;

            // Calcular hora fin (1 hora después)
            let horaFin = parseInt(horaActual) + 1;
            if (horaFin >= 24) horaFin = horaFin - 24;
            document.getElementById('ev-hora-fin').value = `${horaFin.toString().padStart(2, '0')}:${minutosStr}`;

            autoFillGrupo("");
            openModal('modal-evento');
        }

        function openEditSesionModal(rowIdx) {
            const ev = eventos.find(e => e.rowIdx === rowIdx);
            if (!ev) return;
            if(!ev.fechaObj){showErrorModal('Sesión incompleta',`La fila ${rowIdx} no tiene una fecha válida. Revísala en la hoja antes de editarla.`,'warning');return;}
            document.getElementById('modal-evento-title').innerText = "Editar Sesión";
            document.getElementById('ev-rowIdx').value = ev.rowIdx;
            document.getElementById('session-performed-control').hidden = window.horasCalendarWritesEnabled !== true;
            document.getElementById('ev-realizado').checked = !!ev.realizado;
            document.getElementById('ev-realizado').disabled = !!ev.realizado;
            document.getElementById('session-performed-hint').textContent = ev.realizado ? 'Esta sesión ya está marcada como realizada.' : 'Márcala si ya has terminado esta sesión.';
            document.getElementById('ev-grupo').value = GroupIdentity.resolve(grupos,ev.grupo)?.nombre || ev.grupo;
            document.getElementById('ev-grupo-search').value = sessionGroupName(ev);

            const offsetMS = ev.fechaObj.getTimezoneOffset() * 60 * 1000;
            const fechaLocal = new Date(ev.fechaObj.getTime() - offsetMS);

            document.getElementById('ev-fecha').value = fechaLocal.toISOString().split('T')[0];
            refreshGroupLabels();

            // Usar las horas reales guardadas en Sheets; si faltan, mantenemos el fallback anterior.
            const horaInicioGuardada = ev.horaInicio || '10:00';
            let horaFinGuardada = ev.horaFin || '';
            if (!horaFinGuardada) {
                let horaFin = 10 + ev.horas;
                let mFin = (horaFin % 1) * 60;
                horaFinGuardada = `${String(Math.floor(horaFin)).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
            }
            document.getElementById('ev-hora-inicio').value = horaInicioGuardada;
            document.getElementById('ev-hora-fin').value = horaFinGuardada;

            document.getElementById('ev-precio').value = ev.precioHora;
            document.getElementById('ev-sitio').value = ev.direccion || '';
            document.getElementById('ev-barrio').value = ev.sitio || '';

            // Cargar estado del checkbox de Bolo
            const isBolo = ev.boloCole === 'X';
            document.getElementById('ev-bolo').checked = isBolo;

            // Mostrar opciones de calendario al editar
            document.getElementById('sync-calendar-wrapper').classList.remove('hidden');
            document.getElementById('ev-repite').checked = false;
            document.getElementById('recurrence-options').classList.add('hidden');

            autoFillGrupo(ev.grupo, true);
            window.configureProtectedSession?.(ev);

            openModal('modal-evento');
        }

        function openNewGrupoModal() {
            document.getElementById('gr-nombre').disabled=false;
            document.getElementById('gr-sitio').disabled=false;
            document.getElementById('gr-name-info').textContent='';
            document.getElementById('modal-grupo-title').innerText = "Nuevo Grupo";
            document.getElementById('form-grupo').reset();
            document.getElementById('gr-rowIdx').value = "";
            openModal('modal-grupo');
        }

        function openEditGrupoModal(rowIdx) {
            const g = grupos.find(gr => gr.rowIdx === rowIdx);
            if (!g) return;
            document.getElementById('modal-grupo-title').innerText = 'Editar Grupo · ' + GroupIdentity.catalogLabel(g.nombre);
            document.getElementById('gr-rowIdx').value = g.rowIdx;
            document.getElementById('gr-nombre').value = g.nombre;
            document.getElementById('gr-name-info').textContent = GroupIdentity.description(g.nombre);
            document.getElementById('gr-precio').value = g.precio ?? '';
            document.getElementById('gr-precio-bolo').value = g.precioBolo ?? '';
            document.getElementById('gr-nombre').disabled = (CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE) && CONFIG.TEST_PHASE >= 5;
            document.getElementById('gr-sitio').disabled = (CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE) && CONFIG.TEST_PHASE >= 5 && CONFIG.TEST_PHASE < 7;
            document.getElementById('gr-sitio').value = g.sitio;
            document.getElementById('gr-ubicacion').value = g.ubicacion;
            openModal('modal-grupo');
        }

        function autoFillGrupo(nombre, ignoreOverwrite = false) {
            const isMaracuya = nombre.toLowerCase().includes('maracuyá') || nombre.toLowerCase().includes('maracuya');
            const g = GroupIdentity.resolve(grupos,nombre);

            if (isMaracuya) {
                document.getElementById('maracuya-gps-hint').classList.remove('hidden');
            } else {
                document.getElementById('maracuya-gps-hint').classList.add('hidden');
            }

            if (g && !ignoreOverwrite) {
                // Verificar si el checkbox de Bolo está marcado para aplicar precio correcto
                const isBolo = document.getElementById('ev-bolo').checked;
                if (isBolo) {
                    document.getElementById('ev-precio').value = g.precioBolo ?? '';
                } else {
                    document.getElementById('ev-precio').value = g.precio;
                }
                if(!document.getElementById('ev-sitio').value.trim())document.getElementById('ev-sitio').value = g.sitio || '';
                if(!document.getElementById('ev-barrio').value.trim())document.getElementById('ev-barrio').value = g.ubicacion || '';
            }
        }

        function toggleBolo() {
            const isBolo = document.getElementById('ev-bolo').checked;
            const precioInput = document.getElementById('ev-precio');
            const grupo = document.getElementById('ev-grupo').value;
            const g = GroupIdentity.resolve(grupos,grupo);

            if (isBolo && g) {
                precioInput.value = g.precioBolo ?? '';
            } else if (g) {
                precioInput.value = g.precio ?? '';
            }
        }

        // Funciones para popup de error moderno
        function showErrorModal(title, message, type = 'error', focusField = null) {
            const modal = document.getElementById('modal-error');
            const iconContainer = document.getElementById('error-icon');
            const titleElement = document.getElementById('error-title');
            const messageElement = document.getElementById('error-message');
            const actionBtn = document.getElementById('error-action-btn');

            // Configurar título y mensaje
            titleElement.textContent = title;
            messageElement.textContent = message;

            // Configurar icono y colores según tipo
            let iconHtml, bgColor, textColor;
            switch(type) {
                case 'error':
                    iconHtml = '<i data-lucide="alert-circle" class="w-8 h-8"></i>';
                    bgColor = 'bg-red-100';
                    textColor = 'text-red-600';
                    break;
                case 'warning':
                    iconHtml = '<i data-lucide="alert-triangle" class="w-8 h-8"></i>';
                    bgColor = 'bg-amber-100';
                    textColor = 'text-amber-600';
                    break;
                case 'info':
                    iconHtml = '<i data-lucide="info" class="w-8 h-8"></i>';
                    bgColor = 'bg-blue-100';
                    textColor = 'text-blue-600';
                    break;
                case 'success':
                    iconHtml = '<i data-lucide="check-circle" class="w-8 h-8"></i>';
                    bgColor = 'bg-emerald-100';
                    textColor = 'text-emerald-600';
                    break;
                default:
                    iconHtml = '<i data-lucide="alert-circle" class="w-8 h-8"></i>';
                    bgColor = 'bg-red-100';
                    textColor = 'text-red-600';
            }

            iconContainer.className = `w-16 h-16 ${bgColor} rounded-full flex items-center justify-center ${textColor}`;
            iconContainer.innerHTML = iconHtml;

            // Ocultar botón de acción por defecto
            actionBtn.classList.add('hidden');

            // Mostrar modal
            modal.classList.remove('hidden');

            // Hacer focus en campo si se especifica
            if (focusField) {
                setTimeout(() => {
                    focusField.focus();
                }, 100);
            }

            // Recrear iconos de Lucide
            lucide.createIcons();
        }

        function closeErrorModal() {
            document.getElementById('modal-error').classList.add('hidden');
        }

        // Funciones para indicador de carga global
        function showLoading(message = 'Cargando...') {
            const overlay = document.getElementById('loading-overlay');
            const messageEl = document.getElementById('loading-message');
            messageEl.textContent = message;
            overlay.classList.remove('hidden');

            // Prevenir scroll del body mientras carga
            document.body.style.overflow = 'hidden';
        }

        function hideLoading() {
            const overlay = document.getElementById('loading-overlay');
            overlay.classList.add('hidden');

            // Restaurar scroll del body
            document.body.style.overflow = '';
        }

        // Función de validación para el formulario de clase
        function validarFormularioClase() {
            const grupo = document.getElementById('ev-grupo').value.trim();
            const fecha = document.getElementById('ev-fecha').value;
            const horaInicio = document.getElementById('ev-hora-inicio').value;
            const horaFin = document.getElementById('ev-hora-fin').value;
            const precio = parseFloat(document.getElementById('ev-precio').value);
            const sitio = document.getElementById('ev-sitio').value.trim();

            // Validar campos obligatorios
            if (!grupo) {
                showErrorModal('Campo Requerido', 'Por favor, selecciona un grupo.', 'error', document.getElementById('ev-grupo'));
                return false;
            }

            if (!fecha) {
                showErrorModal('Campo Requerido', 'Por favor, selecciona una fecha.', 'error', document.getElementById('ev-fecha'));
                return false;
            }

            if (!horaInicio) {
                showErrorModal('Campo Requerido', 'Por favor, introduce la hora de inicio.', 'error', document.getElementById('ev-hora-inicio'));
                return false;
            }

            if (!horaFin) {
                showErrorModal('Campo Requerido', 'Por favor, introduce la hora de fin.', 'error', document.getElementById('ev-hora-fin'));
                return false;
            }

            if (!sitio) {
                showErrorModal('Campo Requerido', 'Por favor, introduce el sitio o ubicación.', 'error', document.getElementById('ev-sitio'));
                return false;
            }

            if (isNaN(precio) || precio <= 0) {
                showErrorModal('Precio Inválido', 'Por favor, introduce un precio válido mayor que 0.', 'error', document.getElementById('ev-precio'));
                return false;
            }

            // Validar formato de horas
            const horaRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!horaRegex.test(horaInicio)) {
                showErrorModal('Formato Inválido', 'La hora de inicio debe tener formato HH:MM (ej: 10:00).', 'warning', document.getElementById('ev-hora-inicio'));
                return false;
            }

            if (!horaRegex.test(horaFin)) {
                showErrorModal('Formato Inválido', 'La hora de fin debe tener formato HH:MM (ej: 11:00).', 'warning', document.getElementById('ev-hora-fin'));
                return false;
            }

            // Validar que hora fin sea posterior a hora inicio
            const [h1, m1] = horaInicio.split(':').map(Number);
            const [h2, m2] = horaFin.split(':').map(Number);
            const minutosInicio = h1 * 60 + m1;
            const minutosFin = h2 * 60 + m2;

            if (minutosFin <= minutosInicio) {
                showErrorModal('Hora Inválida', 'La hora de fin debe ser posterior a la hora de inicio.', 'warning', document.getElementById('ev-hora-fin'));
                return false;
            }


            const fechaSeleccionada = new Date(fecha);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            if (fechaSeleccionada < hoy && !document.getElementById('ev-rowIdx').value) {
                if (!confirm('La fecha seleccionada es anterior a hoy. ¿Deseas continuar?')) {
                    document.getElementById('ev-fecha').focus();
                    return false;
                }
            }

            return true;
        }

        document.getElementById('form-evento').onsubmit = async (e) => {
            e.preventDefault();
            if ((CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE) && CONFIG.TEST_PHASE >= 3) return window.reviewSessionForm();
            if (!validarFormularioClase()) return;
            const rowIdx = document.getElementById('ev-rowIdx').value;
            const ev = eventos.find(e => e.rowIdx == rowIdx);
            const grupo = document.getElementById('ev-grupo').value;
            const isMaracuya = grupo.toLowerCase().includes('maracuyá') || grupo.toLowerCase().includes('maracuya');
            const isBolo = document.getElementById('ev-bolo').checked;

            const fecha = document.getElementById('ev-fecha').value;
            const horaInicio = document.getElementById('ev-hora-inicio').value;
            const horaFin = document.getElementById('ev-hora-fin').value;
            const precio = parseFloat(document.getElementById('ev-precio').value);
            const sitio = document.getElementById('ev-sitio').value;

            // Columna Bolo: "X" si es Bolo, vacío si no
            const boloCole = isBolo ? "X" : "";
            const clase = isMaracuya ? "" : "X";

            // Calculamos las horas usando las horas de inicio y fin introducidas
            const [h1, m1] = horaInicio.split(':').map(Number);
            const [h2, m2] = horaFin.split(':').map(Number);

            // Calcular horas reales
            const minutosInicio = h1 * 60 + m1;
            const minutosFin = h2 * 60 + m2;
            let horasCalc = (minutosFin - minutosInicio) / 60;
            if (horasCalc <= 0) horasCalc = 1; // Mínimo 1 hora

            // Para la columna H siempre guardamos 1, y el total se calcula en base a Precio * 1
            const horasParaColumnaH = 1;
            const fParts = fecha.split("-");
            const fFormat = `${fParts[2]}/${fParts[1]}/${fParts[0]}`;
            const totalStr = precio.toFixed(2).replace(".",",") + " €";

            // Obtener ubicación del grupo y dirección del formulario
            const g = GroupIdentity.resolve(grupos,grupo);
            const ubicacion = document.getElementById('ev-barrio').value.trim() || ev?.sitio || g?.ubicacion || '';
            const direccion = sitio; // El campo sitio del formulario es la dirección para Maps

            // Validar que ev exista antes de acceder a calEventId
            const calEventId = (ev && ev.calEventId) ? ev.calEventId : "";
            const fila = ["", "", boloCole, clase, precio, fFormat, totalStr, horasParaColumnaH, grupo, ubicacion, calEventId, direccion, horaInicio, horaFin];

            try {
                if (ev && ev.calEventId && eventos.some(other => other.rowIdx !== ev.rowIdx && other.calEventId === ev.calEventId)) throw new Error('CalendarId compartido. Revisa el vínculo antes de editar.');
                if (rowIdx) {
                    const old = eventos.find(ev => ev.rowIdx == rowIdx);
                    fila[0] = old.pagado ? 'X' : '';
                    fila[1] = old.realizado ? 'X' : '';
                    await proxyGoogleAPI('sheets', 'update', {
                        spreadsheetId: CONFIG.SPREADSHEET_ID,
                        range: `Detalle!A${rowIdx}:N${rowIdx}`,
                        valueInputOption: 'USER_ENTERED'
                    }, {
                        values: [fila]
                    });

                    // Sincronizar con Google Calendar si existe el eventId
                    if (calEventId) {
                        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        const startDT = `${fecha}T${horaInicio}:00`;
                        const endDT = `${fecha}T${horaFin}:00`;

                        let eventResource = {
                            summary: isBolo ? `Bolo ${grupo}` : grupo,
                            location: sitio,
                            start: { dateTime: startDT, timeZone: tz },
                            end: { dateTime: endDT, timeZone: tz },
                            colorId: '5',
                            description: `Sesión de ${horasCalc.toFixed(2)}h${isBolo ? ' (Bolo)' : ''} generada desde PercuManager.`,
                            reminders: {
                                useDefault: false,
                                overrides: []
                            }
                        };

                        // Reglas de Recursividad
                        if (document.getElementById('ev-repite').checked) {
                            const freq = document.getElementById('ev-freq').value;
                            const interval = document.getElementById('ev-interval').value;
                            const untilDate = document.getElementById('ev-until').value;

                            let rrule = `RRULE:FREQ=${freq};INTERVAL=${interval}`;
                            if (untilDate) {
                                const formattedUntil = untilDate.replace(/-/g, '') + 'T235959Z';
                                rrule += `;UNTIL=${formattedUntil}`;
                            }
                            eventResource.recurrence = [rrule];
                        }

                        try {
                            await proxyGoogleAPI('calendar', 'update', {
                                calendarId: 'primary',
                                eventId: calEventId
                            }, eventResource);
                        } catch (calendarError) {
                            console.error('Error actualizando evento en Google Calendar:', calendarError);
                        }
                    }
                } else {
                    // El append devuelve el rango donde insertó, ej: "Detalle!A5:N5"
                    const appendResponse = await proxyGoogleAPI('sheets', 'append', {
                        spreadsheetId: CONFIG.SPREADSHEET_ID,
                        range: 'Detalle!A:N',
                        valueInputOption: 'USER_ENTERED',
                        insertDataOption: 'INSERT_ROWS'
                    }, {
                        values: [fila]
                    });

                    // Extraemos el número de fila del rango actualizado, ej: "Detalle!A5:N5" -> 5
                    // Manejar diferentes estructuras de respuesta (proxy vs gapi directo)
                    let updatedRange;
                    let insertedRow;

                    if (appendResponse.result && appendResponse.result.updates) {
                        updatedRange = appendResponse.result.updates.updatedRange;
                    } else if (appendResponse.updates) {
                        updatedRange = appendResponse.updates.updatedRange;
                    } else if (appendResponse.tableRange) {
                        updatedRange = appendResponse.tableRange;
                    } else {
                        // Fallback: buscar en la respuesta el rango actualizado
                        console.warn('Estructura de respuesta inesperada:', appendResponse);
                        // Intentar obtener la última fila del spreadsheet como fallback
                        const lastRowResponse = await proxyGoogleAPI('sheets', 'get', {
                            spreadsheetId: CONFIG.SPREADSHEET_ID,
                            range: 'Detalle!A2:A'
                        });
                        insertedRow = (lastRowResponse.values || []).length + 2;
                    }

                    if (updatedRange) {
                        const match = updatedRange.match(/\d+/);
                        if (match) {
                            insertedRow = parseInt(match[0]);
                        } else {
                            console.error('No se pudo extraer número de fila del rango:', updatedRange);
                        }
                    }


                    // Lógica de Google Calendar
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const startDT = `${fecha}T${horaInicio}:00`;
                    const endDT = `${fecha}T${horaFin}:00`;

                    let eventResource = {
                        summary: isBolo ? `Bolo ${grupo}` : grupo,
                        location: sitio,
                        start: { dateTime: startDT, timeZone: tz },
                        end: { dateTime: endDT, timeZone: tz },
                        colorId: '5',
                        description: `Sesión de ${horasCalc.toFixed(2)}h${isBolo ? ' (Bolo)' : ''} generada desde PercuManager.`,
                        reminders: {
                            useDefault: false,
                            overrides: []
                        }
                    };

                    // Reglas de Recursividad
                    if (document.getElementById('ev-repite').checked) {
                        const freq = document.getElementById('ev-freq').value;
                        const interval = document.getElementById('ev-interval').value;
                        const untilDate = document.getElementById('ev-until').value;

                        let rrule = `RRULE:FREQ=${freq};INTERVAL=${interval}`;
                        if (untilDate) {
                            const formattedUntil = untilDate.replace(/-/g, '') + 'T235959Z';
                            rrule += `;UNTIL=${formattedUntil}`;
                        }
                        eventResource.recurrence = [rrule];
                    }

                    try {
                        const calResponse = await proxyGoogleAPI('calendar', 'insert', {
                            calendarId: 'primary'
                        }, eventResource);

                        // Obtener eventId de forma segura
                        let calEventId;
                        if (calResponse && calResponse.result && calResponse.result.id) {
                            calEventId = calResponse.result.id;
                        } else if (calResponse && calResponse.id) {
                            calEventId = calResponse.id;
                        } else {
                            console.warn('No se pudo obtener el ID del evento, pero la operación pudo haber funcionado');
                            return; // Salimos del try si no hay ID, pero la sesión ya se guardó
                        }

                        // Guardamos el eventId en la columna K usando batchUpdate
                        try {
                            if (insertedRow) {

                                // Usar batchUpdate para actualizar la celda específica
                                await proxyGoogleAPI('sheets', 'batchUpdate', {
                                    spreadsheetId: CONFIG.SPREADSHEET_ID
                                }, {
                                    requests: [{
                                        updateCells: {
                                            range: {
                                                sheetId: 0,
                                                startRowIndex: insertedRow - 1,
                                                endRowIndex: insertedRow,
                                                startColumnIndex: 10, // Columna K (0-indexed)
                                                endColumnIndex: 11
                                            },
                                            rows: [{
                                                values: [{
                                                    userEnteredValue: { stringValue: calEventId }
                                                }]
                                            }],
                                            fields: 'userEnteredValue'
                                        }
                                    }]
                                });
                            } else {
                                }
                        } catch (updateError) {
                            console.warn('No se pudo actualizar el eventId en la columna K:', updateError.message);
                        }
                    } catch (calendarError) {
                        // No mostramos alerta para no interrumpir el flujo si funciona
                    }
                }
                closeModal('modal-evento');
                syncData();
            } catch (err) { console.error("Error sesión:", err); }
        };

        document.getElementById('form-grupo').onsubmit = async (e) => {
            e.preventDefault();
            const rowIdx = document.getElementById('gr-rowIdx').value;
            const nombre = document.getElementById('gr-nombre').value;
            const precio = document.getElementById('gr-precio').value;
            const precioBolo = document.getElementById('gr-precio-bolo').value;
            const sitio = document.getElementById('gr-sitio').value;
            const ubicacion = document.getElementById('gr-ubicacion').value;
            const sessionPrice = LocaleData.numeric(precio), gigPrice = LocaleData.numeric(precioBolo);
            if(sessionPrice === null || sessionPrice < 0 || gigPrice === null || gigPrice < 0){showErrorModal('Tarifa no válida','Introduce precios numéricos válidos. No se asignará una tarifa por defecto.','warning');return;}
            const fila = [nombre, sitio, sessionPrice, gigPrice, ubicacion];

            try {
                if (rowIdx) {
                    await proxyGoogleAPI('sheets', 'update', {
                        spreadsheetId: CONFIG.SPREADSHEET_ID,
                        range: `Coles!A${rowIdx}:E${rowIdx}`,
                        valueInputOption: 'USER_ENTERED'
                    }, {
                        values: [fila]
                    });
                } else {
                    await proxyGoogleAPI('sheets', 'append', {
                        spreadsheetId: CONFIG.SPREADSHEET_ID,
                        range: 'Coles!A:E',
                        valueInputOption: 'USER_ENTERED',
                        insertDataOption: 'INSERT_ROWS'
                    }, {
                        values: [fila]
                    });
                }
                closeModal('modal-grupo');
                syncData();
            } catch (err) { console.error("Error grupo:", err); }
        };

        // Event listener para formulario de eventos futuros
        document.getElementById('form-future-events').onsubmit = async (e) => {
            e.preventDefault();

            const month = parseInt(document.getElementById('future-month').value);
            const year = parseInt(document.getElementById('future-year').value);

            if (!month || !year) {
                showErrorModal('Error de Validación', 'Por favor selecciona mes y año.', 'error');
                return;
            }

            try {
                await importFutureEvents(month, year);
                closeModal('modal-future-events');
                syncData();
            } catch (err) {
                console.error("Error importando eventos futuros:", err);
                showErrorModal('Error', 'No se pudieron importar los eventos futuros.', 'error');
            }
        };

        let confirmCallback = null;
