# PUZZLES — GitHub Pages

Los archivos principales de interfaz tienen nombres permanentes:

- `assets/puzzles-app.css`
- `assets/puzzles-app.js`

En futuras entregas se reemplazan estos mismos archivos. No se crearán archivos `puzzles-app-v...`.

Puedes borrar con confianza del repositorio:

- `assets/puzzles-app-v1.5.8.css`
- `assets/puzzles-app-v1.5.8.js`
- `assets/puzzles-app-v1.6.0.css`
- `assets/puzzles-app-v1.6.0.js`

Sube el contenido de este ZIP a la raíz del repositorio, reemplazando los archivos existentes. El service worker usa estrategia de red para `puzzles-app.css` y `puzzles-app.js`, por lo que seguirá leyendo los mismos nombres y actualizará su contenido.
