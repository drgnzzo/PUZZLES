## URL de la Web App configurada

Esta versión ya incluye la siguiente implementación de Google Apps Script en `Index.html` e `index.html`:

```text
https://script.google.com/macros/s/AKfycbzPpqH7nIKS81dk-_ZCJym-VoqpPFDicwQ-1BWzhHuL-_D5WV2Mz8wXQ0Xi7peLTcL3Dw/exec
```

## Corrección: creación automática de hojas

Esta versión incluye `crearHojasNecesarias()`.

La función crea o repara sin eliminar información:

- `Lista de precios`
- `Pedidos`
- `Detalle pedidos`
- `Config`

`setupPuzzles()` también fue corregida para crear primero las hojas y después leer el catálogo. Si encuentra una hoja `Lista de precios` incompatible, la conserva como respaldo.


# PUZZLES — Web App de vinos y licores

Proyecto listo para convertir la lista de precios en una aplicación web con:

- Catálogo en columnas y vista de tabla.
- Búsqueda por código, descripción, categoría, unidad o volumen.
- Filtros por categoría y rango de precio.
- Orden por nombre, precio o código.
- Carrito persistente en el navegador.
- Solicitud de pedido con folio.
- Registro automático en Google Sheets.
- Opción de recolección o entrega.
- Confirmación por WhatsApp, cuando se configura un número.
- Control de edad para mayores de 18 años.
- Diseño responsivo para computadora y móvil.

La aplicación usa directamente estas columnas del archivo convertido a Google Sheets:

| Producto | Descripción | U. S. | Precio sin IVA | Precio Neto |
|---|---|---|---:|---:|

Los códigos se leen como texto para conservar valores como `001`. El servidor vuelve a consultar y calcular los precios cuando se registra un pedido; el precio enviado por el navegador nunca se acepta como fuente de verdad.

## Archivos principales

- `Code.gs`: backend de Google Apps Script.
- `Index.html`: interfaz que se sirve directamente desde Apps Script.
- `index.html`: copia para GitHub Pages.
- `appsscript.json`: manifiesto de Apps Script.
- `.clasp.json.example`: plantilla para sincronizar GitHub y Apps Script con clasp.

---

## Opción A — Publicar directamente con Google Apps Script

Esta es la forma recomendada porque no necesita configurar CORS ni una URL externa dentro del HTML.

### 1. Subir el Excel a Google Sheets

1. Sube `PREMIUM_170726_LIMPIO.xlsx` a Google Drive.
2. Ábrelo con Google Sheets.
3. Confirma que exista la hoja llamada **Lista de precios**.
4. La primera fila debe contener exactamente:
   - Producto
   - Descripción
   - U. S.
   - Precio sin IVA
   - Precio Neto

### 2. Pegar el proyecto

1. En el Google Sheet, abre **Extensiones → Apps Script**.
2. Sustituye el contenido de `Code.gs` por el archivo `Code.gs` de este proyecto.
3. Crea un archivo HTML llamado exactamente **Index**.
4. Pega el contenido de `Index.html`.
5. Guarda el proyecto.

### 3. Inicializar

1. En Apps Script, selecciona la función `setupPuzzles`.
2. Presiona **Ejecutar**.
3. Autoriza el acceso solicitado.

La función:

- Valida las cinco columnas obligatorias.
- Formatea el catálogo y activa filtros en la hoja.
- Crea la hoja `Config`.
- Crea la hoja `Pedidos`.
- Crea la hoja `Detalle pedidos`.

### 4. Configurar la tienda

En la hoja `Config` puedes modificar:

| Clave | Uso |
|---|---|
| `NOMBRE_TIENDA` | Nombre visible, actualmente PUZZLES |
| `SUBTITULO` | Leyenda debajo del nombre |
| `MENSAJE_HERO` | Mensaje principal |
| `WHATSAPP` | Número con código de país, sólo dígitos |
| `CORREO_PEDIDOS` | Correo que recibirá cada pedido |
| `PERMITIR_ENTREGA` | `TRUE` o `FALSE` |
| `PERMITIR_RECOLECCION` | `TRUE` o `FALSE` |
| `PEDIDO_MINIMO` | Monto mínimo neto |
| `MOSTRAR_SIN_IVA` | `TRUE` o `FALSE` |

Ejemplo de WhatsApp México:

```text
525512345678
```

### 5. Desplegar como Web App

1. En Apps Script, presiona **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Quién tiene acceso: elige **Cualquier persona** o la opción restringida que corresponda a tu operación.
5. Presiona **Implementar**.
6. Abre la URL que termina en `/exec`.

Cuando actualices el código:

1. Ve a **Implementar → Administrar implementaciones**.
2. Edita la implementación.
3. Selecciona **Nueva versión**.
4. Implementa nuevamente.

---

## Opción B — Interfaz en GitHub Pages y backend en Apps Script

GitHub Pages sólo aloja archivos estáticos. Los precios y pedidos seguirán conectados al backend de Google Apps Script.

### 1. Despliega primero el backend

Sigue la Opción A hasta obtener la URL que termina en `/exec`.

### 2. Configura `index.html`

Busca esta línea:

```javascript
const GITHUB_GAS_URL = 'https://script.google.com/macros/s/AKfycbzPpqH7nIKS81dk-_ZCJym-VoqpPFDicwQ-1BWzhHuL-_D5WV2Mz8wXQ0Xi7peLTcL3Dw/exec';
```

Sustitúyela por tu URL:

```javascript
const GITHUB_GAS_URL = 'https://script.google.com/macros/s/AKfycbzPpqH7nIKS81dk-_ZCJym-VoqpPFDicwQ-1BWzhHuL-_D5WV2Mz8wXQ0Xi7peLTcL3Dw/exec';
```

### 3. Sube a GitHub

```bash
git init
git add .
git commit -m "PUZZLES web app inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

### 4. Activa GitHub Pages

1. Abre el repositorio en GitHub.
2. Ve a **Settings → Pages**.
3. Source: **Deploy from a branch**.
4. Branch: `main`.
5. Carpeta: `/root`.
6. Guarda.

GitHub publicará el archivo `index.html`.

---

## Sincronizar Apps Script desde GitHub con clasp

### Requisitos

- Node.js instalado.
- Un proyecto de Apps Script ya creado.

### Instalar clasp

```bash
npm install -g @google/clasp
clasp login
```

### Vincular el proyecto

1. Copia `.clasp.json.example` como `.clasp.json`.
2. Sustituye `PEGA_AQUI_EL_SCRIPT_ID` por el ID del proyecto de Apps Script.
3. Ejecuta:

```bash
clasp push
```

Para descargar los cambios hechos en Apps Script:

```bash
clasp pull
```

Para abrir el proyecto:

```bash
clasp open
```

> `.claspignore` evita subir a Apps Script el `README.md` y la copia minúscula `index.html` que se usa en GitHub Pages.

---

## Columnas opcionales del catálogo

Puedes añadir estas columnas a la hoja `Lista de precios` sin modificar el backend:

| Columna | Comportamiento |
|---|---|
| `Categoría` | Sustituye la categoría inferida por el prefijo del producto |
| `Imagen_URL` | Muestra una imagen HTTPS en la tarjeta |
| `Stock` | Valida y descuenta existencias al registrar pedidos |
| `Activo` | `FALSE` oculta el producto del catálogo |

Si no agregas `Stock`, la app muestra los productos sin prometer una existencia específica y registra la solicitud para confirmación posterior.

## Categorías inferidas

El backend reconoce los prefijos del documento, entre ellos:

- `TEQ` → Tequila
- `MEZ` → Mezcal
- `WHI` → Whisky
- `RON` → Ron
- `VOD` → Vodka
- `GIN` → Ginebra
- `BRA` → Brandy
- `COG` → Cognac
- `CHA` → Champagne
- `LIC` → Licores
- `V.T.` → Vino tinto
- `V.B.` → Vino blanco
- `V.R.` → Vino rosado
- `V.E.` → Espumosos

La descripción original siempre se conserva completa.

## Cómo se guardan los pedidos

### Hoja `Pedidos`

Una fila por pedido con:

- Folio
- Fecha
- Cliente
- Teléfono
- Correo
- Modalidad
- Dirección
- Notas
- Número de productos
- Unidades
- Subtotal sin IVA
- Total neto
- Estado
- Origen
- JSON del detalle

### Hoja `Detalle pedidos`

Una fila por producto para facilitar filtros, reportes y tablas dinámicas.

## Alcance de esta versión

- Registra solicitudes de pedido; no cobra tarjetas ni procesa pagos.
- Los productos con precio neto `$0.00` aparecen como **Precio a consultar** y no se pueden comprar directamente.
- La disponibilidad final se confirma antes de surtir cuando no existe una columna `Stock`.
- El control de edad es una barrera de interfaz y no sustituye una revisión legal o comercial para la venta de alcohol en tu operación.

## Prueba rápida antes de publicar

1. Ejecuta `setupPuzzles`.
2. Ejecuta `testCatalog` y confirma el total de registros.
3. Abre la Web App.
4. Busca el código `001` y confirma que conserve los ceros.
5. Busca un artículo con precio de cuatro decimales sin IVA.
6. Agrega dos productos al carrito.
7. Registra un pedido de prueba.
8. Confirma que se creó una fila en `Pedidos` y sus líneas en `Detalle pedidos`.
9. Elimina el pedido de prueba antes de usarlo en producción.
