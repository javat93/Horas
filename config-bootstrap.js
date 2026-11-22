
    if(window.top!==window.self){document.documentElement.hidden=true;throw Error('Abre PercuManager directamente en su dirección original.');}
    // Detectar si estamos en producción
    const isProduction = window.location.hostname !== 'localhost' &&
                         window.location.hostname !== '127.0.0.1';

    // Cargar configuración adecuada
    const configScript = document.createElement('script');
    const rehearsalRequested = new URLSearchParams(window.location.search).get('ensayo') === 'protegido';
    const copyRequested = new URLSearchParams(window.location.search).get('pruebas') === 'copia';
    configScript.src = rehearsalRequested ? 'release/config.rehearsal.candidate.js?v=ensayo-20261102' : copyRequested ? 'release/config.test.candidate.js?v=real-20261102' : isProduction ? 'config.production.js?v=real-20261102' : 'config.secure.js';
    window.horasConfigReady = new Promise((resolve, reject) => {
        configScript.onload = resolve;
        configScript.onerror = () => reject(new Error('No se pudo cargar la configuración.'));
    });
    document.head.appendChild(configScript);
