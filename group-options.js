        function sessionGroupName(ev) {
            return GroupIdentity.label(ev.grupo, LocaleData.parseSpanish(ev.fechaStr)) || 'Sesión incompleta · fila '+ev.rowIdx;
        }

        function groupOptionName(name) {
            return GroupIdentity.label(name, document.getElementById('ev-fecha').value) || name;
        }

        function populateGroupFilter() {
            const select = document.getElementById('filter-grupo'), selected = select.value;
            const names = new Map();
            for(const name of [...grupos.map(g=>g.nombre),...eventos.map(ev=>ev.grupo)])if(GroupIdentity.id(name))names.set(GroupIdentity.id(name),GroupIdentity.catalogLabel(name));
            select.replaceChildren(new Option('Todos los grupos',''));
            for(const [id,name]of [...names].sort((a,b)=>a[1].localeCompare(b[1],'es',{sensitivity:'base',numeric:true})))select.append(new Option(name,id));
            select.value = names.has(selected) ? selected : '';
        }

        function refreshGroupLabels() {
            populateSelects();
            const value = document.getElementById('ev-grupo').value;
            if(value)document.getElementById('ev-grupo-search').value = groupOptionName(value);
        }

        function sessionGroupCatalog() {
            return window.horasGroupCourses?.sessionGroups(grupos, document.getElementById('ev-grupo').value, !!document.getElementById('ev-all-groups')?.checked) || grupos.slice();
        }
        function populateSelects() {
            const sel = document.getElementById('ev-grupo');
            const selected = sel.value;
            // Ordenar grupos alfabéticamente (ignorando mayúsculas/minúsculas)
            const gruposOrdenados = sessionGroupCatalog().filter(g=>g.nombre.trim()).sort((a, b) =>
                groupOptionName(a.nombre).localeCompare(groupOptionName(b.nombre), 'es', { sensitivity: 'base', numeric: true })
            );
            sel.innerHTML = '<option value="">Selecciona grupo...</option>' +
                gruposOrdenados.map(g => `<option value="${SafeHTML.escape(g.nombre)}">${SafeHTML.escape(groupOptionName(g.nombre))}</option>`).join('');
            sel.value = selected;
            populateGrupoOptions();
        }

        // Función para poblar las opciones del dropdown de búsqueda
        function populateGrupoOptions() {
            const optionsContainer = document.getElementById('grupo-options');
            if (!optionsContainer) return;

            // Ordenar grupos alfabéticamente (ignorando mayúsculas/minúsculas)
            const gruposOrdenados = sessionGroupCatalog().filter(g=>g.nombre.trim()).sort((a, b) =>
                groupOptionName(a.nombre).localeCompare(groupOptionName(b.nombre), 'es', { sensitivity: 'base', numeric: true })
            );

            optionsContainer.innerHTML = gruposOrdenados.map(g =>
                `<div class="grupo-option px-3 py-2 hover:bg-slate-100 cursor-pointer rounded-lg transition-colors"

                       data-grupo="${SafeHTML.escape(g.nombre)}">
                    <div class="font-medium text-sm">${SafeHTML.escape(groupOptionName(g.nombre))}</div>
                </div>`
            ).join('');
        }

        // Función para mostrar/ocultar el dropdown
        let grupoHideTimer;
        function showGrupoDropdown() {
            clearTimeout(grupoHideTimer);
            const dropdown = document.getElementById('grupo-dropdown');
            const searchInput = document.getElementById('ev-grupo-search');
            if (dropdown) {
                dropdown.classList.remove('hidden');
                populateGrupoOptions();
                if (searchInput) {
                    searchInput.focus();
                }
            }
        }

        function hideGrupoDropdown() {
            const dropdown = document.getElementById('grupo-dropdown');
            if (dropdown) {
                clearTimeout(grupoHideTimer);
                grupoHideTimer = setTimeout(() => {
                    dropdown.classList.add('hidden');
                }, 200); // Pequeño delay para permitir clic en opciones
            }
        }

        // Función para filtrar grupos según búsqueda
        function filterGrupos(searchTerm) {
            const optionsContainer = document.getElementById('grupo-options');
            if (!optionsContainer) return;

            const filtered = sessionGroupCatalog().filter(g =>
                g.nombre.trim() && GroupIdentity.matches(g.nombre,searchTerm)
            ).sort((a, b) => groupOptionName(a.nombre).localeCompare(groupOptionName(b.nombre), 'es', { sensitivity: 'base', numeric: true }));

            if (filtered.length === 0) {
                optionsContainer.innerHTML = '<div class="text-slate-400 text-sm px-3 py-2">No se encontraron grupos</div>';
            } else {
                optionsContainer.innerHTML = filtered.map(g =>
                    `<div class="grupo-option px-3 py-2 hover:bg-slate-100 cursor-pointer rounded-lg transition-colors"

                           data-grupo="${SafeHTML.escape(g.nombre)}">
                        <div class="font-medium text-sm">${SafeHTML.escape(groupOptionName(g.nombre))}</div>
                    </div>`
                ).join('');
            }

            // Mostrar dropdown si hay búsqueda
            const dropdown = document.getElementById('grupo-dropdown');
            if (dropdown && searchTerm.trim() !== '') {
                clearTimeout(grupoHideTimer);
                dropdown.classList.remove('hidden');
            }
        }

        // Función para seleccionar un grupo del dropdown
        function selectGrupo(grupoNombre) {
            const searchInput = document.getElementById('ev-grupo-search');
            const hiddenSelect = document.getElementById('ev-grupo');

            if (searchInput) {
                searchInput.value = groupOptionName(grupoNombre);
            }

            if (hiddenSelect) {
                hiddenSelect.value = grupoNombre;
                // Disparar el evento onchange para mantener compatibilidad
                const event = new Event('change', { bubbles: true });
                hiddenSelect.dispatchEvent(event);
            }

            hideGrupoDropdown();
        }

        // Cerrar dropdown al hacer clic fuera
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('grupo-dropdown');
            const searchInput = document.getElementById('ev-grupo-search');
            const dropdownContainer = searchInput ? searchInput.parentElement : null;

            if (dropdown && dropdownContainer && !dropdownContainer.contains(event.target)) {
                hideGrupoDropdown();
            }
        });

        // Función principal para importar eventos futuros de Google Calendar
