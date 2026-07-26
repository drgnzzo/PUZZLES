# PUZZLES 1.6.0 — GitHub Pages

Este paquete contiene únicamente la capa estática publicada en GitHub Pages. El backend, el catálogo, las cuentas, las fichas editoriales y los pedidos siguen ejecutándose en Google Apps Script.

## Arquitectura actual

1. GitHub Pages publica `index.html`, el manifiesto, el Service Worker, imágenes, CSS y JavaScript.
2. `index.html` abre la Web App de Apps Script dentro de un `iframe`.
3. La Web App carga los recursos visuales versionados desde GitHub Pages.
4. No se hacen peticiones CORS directas desde GitHub hacia funciones de Apps Script.

## Cambios 1.6.0

- Nuevo PDP editorial responsivo.
- Los nombres completos ya no usan recorte o separación forzada dentro del popup.
- Imagen protegida con `object-fit: contain`.
- Resumen, identidad del producto, precio y compra con jerarquía clara.
- Destacados específicos del producto.
- Secciones desplegables para descripción, perfil, servicio/maridaje y ficha técnica.
- Campos vacíos se ocultan.
- Compra fija y accesible en móvil.
- Nuevo JavaScript y CSS versionados como `puzzles-app-v1.6.0`.
- Caché del Service Worker renovado para retirar recursos anteriores.

## Publicación

1. Instala y despliega primero el ZIP de Apps Script.
2. Verifica que la implementación de Apps Script siga usando la URL indicada en el atributo `src` del `iframe` de `index.html`.
3. Reemplaza en el repositorio los archivos de este paquete.
4. Confirma que GitHub Pages publique desde la rama y carpeta correctas.
5. Abre la tienda en una ventana privada o realiza una recarga forzada.

Si cambias a una implementación de Apps Script con URL distinta, edita solamente el `src` del `iframe` en `index.html` y conserva `?embed=1`.

## Archivos cargados por la Web App

- `assets/puzzles-app-v1.6.0.css`
- `assets/puzzles-app-v1.6.0.js`
- logotipos, iconos y banners dentro de `assets/`

No subas aquí `Código.gs`, `Index.html`, `Imagenes.html` ni `Configuracion.html`: pertenecen al proyecto de Google Apps Script.
