        function renderAll() {
            populateGroupFilter();
            renderEventos();
            renderGrupos();
            renderCalendar();
            populateSelects();
            lucide.createIcons();
            document.dispatchEvent(new Event('horas:data-rendered'));
        }

        function renderEventos() {
            const SHOW_SESSION_TYPES = true;
            const container = document.getElementById('lista-eventos');
            const fCobrados = document.getElementById('filter-cobrados').value;
            const fRealizados = document.getElementById('filter-realizados').value;
            const fGrupo = document.getElementById('filter-grupo').value;

            const filtered = eventos.filter(ev => {
                let pasaCobro = true;
                if (fCobrados === 'cobrado') pasaCobro = ev.pagado;
                if (fCobrados === 'pendiente') pasaCobro = !ev.pagado;

                let pasaRealizado = true;
                if (fRealizados === 'realizado') pasaRealizado = ev.realizado;
                if (fRealizados === 'futuro') pasaRealizado = !ev.realizado;

                return pasaCobro && pasaRealizado && (!fGrupo || GroupIdentity.id(ev.grupo) === fGrupo);
            });

            if (filtered.length === 0) {
                container.innerHTML = '<div class="text-center py-10 text-slate-400 font-medium">No hay sesiones que coincidan con los filtros.</div>';
                return;
            }

            container.innerHTML = filtered.map(ev => {
                const isBolo = ev.boloCole === 'X';
                const typeClass = SHOW_SESSION_TYPES ? (isBolo ? 'session-card--typed session-card--bolo' : 'session-card--typed') : '';
                const icon = ev.realizado ? 'check-circle' : 'clock';
                const iconColor = ev.realizado ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600';
                return `
                <div class="card-modern pm-session-card p-5 flex flex-wrap md:flex-nowrap justify-between items-center gap-4 ${ev.realizado ? 'bg-emerald-50/30' : ''} ${typeClass}">
                    <div role="button" tabindex="0" aria-label="Editar sesión" class="session-card-main flex items-center gap-4 cursor-pointer flex-1" data-ui-action="edit-session" data-row="${ev.rowIdx}">
                        <div class="session-card-icon w-12 h-12 rounded-2xl flex items-center justify-center ${iconColor}" aria-hidden="true">
                            <i data-lucide="${icon}"></i>
                        </div>
                        <div class="session-card-details">
                            <h4 class="session-card-title font-extrabold text-slate-900"><span>${SafeHTML.escape(sessionGroupName(ev))}</span>${SHOW_SESSION_TYPES ? `<span class="session-type-label">${isBolo ? 'Bolo' : 'Clase'}</span>` : ''}</h4>
                            <div class="session-card-meta flex gap-3 mt-1">
                                <span class="text-xs font-bold text-slate-500 flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${SafeHTML.escape(ev.fechaStr||'Fecha pendiente')}${ev.dateWarning ? ' · Revisar fecha' : ''}${ev.paymentSaving?' · Guardando pago…':ev.paymentError?' · Pago no guardado; vuelve a intentarlo':''}</span>
                                <span class="pm-session-time"><i data-lucide="clock-3" class="w-3 h-3" aria-hidden="true"></i> ${ev.horaInicio && ev.horaFin ? SafeHTML.escape(ev.horaInicio + ' – ' + ev.horaFin) : 'Horario sin indicar'}</span>
                                <span class="text-xs font-bold ${ev.realizado ? 'text-blue-500' : 'text-slate-400'} flex items-center gap-1">
                                    <i data-lucide="${ev.realizado ? 'flag' : 'hourglass'}" class="w-3 h-3"></i>
                                    ${ev.realizado ? 'Realizado' : 'Pendiente'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="session-card-actions flex items-center gap-6">
                        <div class="text-right">
                            <p class="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                            <p class="text-lg font-black text-slate-800">${ev.amountWarning ? 'Revisar importe' : LocaleData.currency(ev.total)}</p><span class="pm-payment-state ${ev.pagado ? 'is-paid' : 'is-unpaid'}">${ev.pagado ? 'Cobrado' : 'Pendiente de cobro'}</span>
                        </div>
                        <div class="flex gap-1">
                            <button aria-label="Cambiar estado de pago, fila ${ev.rowIdx}" aria-pressed="${ev.pagado}" ${ev.paymentSaving||!ev.fechaObj||!ev.grupo?.trim()?'disabled':''} data-ui-action="payment" data-row="${ev.rowIdx}" data-state="${!ev.pagado}" class="p-2.5 rounded-xl ${ev.pagado ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'} hover:scale-110 transition-all">
                                <i data-lucide="euro" class="w-5 h-5" aria-hidden="true"></i><span>${ev.paymentSaving ? 'Guardando…' : ev.pagado ? 'Marcar pendiente' : 'Marcar cobrado'}</span>
                            </button>
                            <button aria-label="Archivar sesión, fila ${ev.rowIdx}" data-ui-action="archive-session" data-row="${ev.rowIdx}" class="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                <i data-lucide="archive" class="w-5 h-5" aria-hidden="true"></i><span>Archivar</span>
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('');
            lucide.createIcons();
        }

        function renderGrupos() {
            const container = document.getElementById('lista-maestros');
            const term = document.getElementById('search-grupos').value.toLowerCase();

            const filtered = (window.horasGroupCourses ? window.horasGroupCourses.visible(grupos) : grupos).filter(g =>
                GroupIdentity.matches(g.nombre,term) ||
                (g.sitio && g.sitio.toLowerCase().includes(term))
            ).sort((a, b) => GroupIdentity.catalogLabel(a.nombre).localeCompare(GroupIdentity.catalogLabel(b.nombre), 'es', { sensitivity: 'base', numeric: true }));

            if (filtered.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400 font-medium">' + (window.horasGroupCourses ? 'No hay grupos con estos filtros. Revisa los filtros o pulsa Organizar este curso.' : 'No se han encontrado grupos.') + '</div>';
                return;
            }

            container.innerHTML = filtered.map(g => `
                <div class="card-modern pm-group-card p-5 flex justify-between items-center gap-4">
                    <div role="button" tabindex="0" aria-label="Editar grupo" class="group-card-main flex items-center gap-4 cursor-pointer flex-1" data-ui-action="edit-group" data-row="${g.rowIdx}">
                        <div class="bg-slate-900 text-white p-3 rounded-xl"><i data-lucide="users"></i></div>
                        <div>
                            <h4 class="font-bold text-slate-900">${SafeHTML.escape(GroupIdentity.catalogLabel(g.nombre)||'Grupo incompleto · fila '+g.rowIdx)}</h4>
                            <p class="text-xs text-slate-500">${SafeHTML.escape(GroupIdentity.description(g.nombre))}</p>
                            <p class="text-xs text-slate-500">${SafeHTML.escape(g.sitio || 'Sin ubicación')}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-slate-400 uppercase">Precio sesión</p>
                        <p class="font-bold text-slate-700">${g.precio === null ? 'Sin tarifa' : LocaleData.currency(g.precio)}</p>
                    </div>
                </div>`).join('');
            if (window.horasGroupCourses) container.querySelectorAll('.group-card-main').forEach((node, index) => { const badge = document.createElement('span'); badge.className = 'gc-badge'; badge.textContent = window.horasGroupCourses.label(filtered[index]); node.querySelector('h4').parentElement.append(badge); });
            lucide.createIcons();
        }

        function renderCalendar() {
            const el = document.getElementById('calendar');
            const source = eventos.filter(e=>e.fechaObj&&!Number.isNaN(+e.fechaObj)).map(e => {
                // Crear objeto de evento con horas si están disponibles
                let startDateTime = e.fechaObj;
                let endDateTime = e.fechaObj;

                // Si tenemos horas de inicio y fin, aplicarlas
                if (e.horaInicio && e.horaFin && e.horaInicio.trim() !== '' && e.horaFin.trim() !== '') {
                    const [startHour, startMin] = e.horaInicio.split(':').map(Number);
                    const [endHour, endMin] = e.horaFin.split(':').map(Number);

                    // Crear fecha local sin conversión UTC
                    const fechaLocal = new Date(e.fechaObj);
                    const year = fechaLocal.getFullYear();
                    const month = fechaLocal.getMonth();
                    const day = fechaLocal.getDate();

                    startDateTime = new Date(year, month, day, startHour, startMin, 0, 0);
                    endDateTime = new Date(year, month, day, endHour, endMin, 0, 0);
                } else {
                    // Eventos sin horas: día completo en hora local
                    const fechaLocal = new Date(e.fechaObj);
                    const year = fechaLocal.getFullYear();
                    const month = fechaLocal.getMonth();
                    const day = fechaLocal.getDate();

                    startDateTime = new Date(year, month, day, 0, 0, 0, 0);
                    endDateTime = new Date(year, month, day, 23, 59, 59, 999);
                }

                // Personalizar título según dispositivo
                let eventTitle;
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    // En móvil: mantener formato actual (solo grupo)
                    eventTitle = sessionGroupName(e) || e.sitio || 'Sesión';
                } else {
                    // En PC: mostrar grupo + horas si están disponibles
                    if (e.horaInicio && e.horaFin && e.horaInicio.trim() !== '' && e.horaFin.trim() !== '') {
                        eventTitle = `${sessionGroupName(e) || e.sitio || 'Sesión'} (${e.horaInicio}-${e.horaFin})`;
                    } else {
                        eventTitle = sessionGroupName(e) || e.sitio || 'Sesión';
                    }
                }

                return {
                    title: eventTitle + '\n' + (e.pagado ? 'Cobrado' : 'Pendiente de cobro'),
                    start: startDateTime,
                    end: endDateTime,
                    color: e.pagado ? '#10b981' : '#2563eb',
                    extendedProps: { rowIdx: e.rowIdx }
                };
            });
            const isMobile = window.innerWidth <= 768;
            if (!calendar) {
                calendar = new FullCalendar.Calendar(el, {
                    initialView: isMobile ? 'listMonth' : 'dayGridMonth',
                    locale: 'es',
                    buttonText: {
                        today: 'Hoy',
                        month: 'Mes',
                        list: 'Lista'
                    },
                    headerToolbar: isMobile
                        ? { left: 'prev,next today', center: 'title', right: '' }
                        : { left: 'prev,next today', center: 'title', right: 'dayGridMonth' },
                    events: source,
                    firstDay: 1,
                    noEventsText: 'No hay eventos este mes',
                    eventTimeFormat: {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    },
                    displayEventTime: true,
                    displayEventEnd: true,
                    eventMaxStack: 2,
                    dayMaxEvents: 4,
                    height: 'auto',
                    aspectRatio: 1.35,
                    eventClick: (info) => openEditSesionModal(info.event.extendedProps.rowIdx),
                    windowResize: function() {
                        const nowMobile = window.innerWidth <= 768;
                        calendar.changeView(nowMobile ? 'listMonth' : 'dayGridMonth');
                        calendar.setOption('headerToolbar', nowMobile
                            ? { left: 'prev,next today', center: 'title', right: '' }
                            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth' }
                        );
                    }
                });
                calendar.render();
            } else {
                calendar.removeAllEvents();
                calendar.addEventSource(source);
            }
        }
