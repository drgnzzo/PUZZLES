# PUZZLES — GitHub Pages

Shell público de la tienda PUZZLES.

## Arquitectura

GitHub Pages carga mediante iframe la Web App de Google Apps Script. Los datos continúan en Google Sheets.

## Archivos permanentes

- `index.html`
- `sw.js`
- `assets/puzzles-app.js`
- `assets/puzzles-app.css`

Los siguientes cambios deben reemplazar esos mismos nombres. No se deben crear CSS o JavaScript numerados.

## Entrada actual

Splash breve → confirmación +18 → tour inmersivo → catálogo.

El Service Worker actual sólo elimina cachés antiguas y se desregistra para evitar mezclas de versiones.
