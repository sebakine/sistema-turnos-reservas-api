# Sistema Backend de Turnos y Reservas — API de Servicios

API REST construida con **Node.js + Express (ESM)** para gestionar el recurso `services` del Sistema Backend de Turnos y Reservas. Las rutas se definen con `express.Router()` y se conectan con el `ServiceManager`, que concentra toda la lógica del recurso y persiste los datos en un archivo JSON.

## Tecnologías

- Node.js 18 o superior
- Express 5
- dotenv
- Módulos ES (`"type": "module"`)

## Estructura del proyecto

```
src/
  config/env.config.js        # Lee las variables de entorno (.env) con dotenv
  data/services.json          # Persistencia de los servicios (datos de ejemplo)
  managers/ServiceManager.js  # Lógica del recurso services (CRUD, filtros, validación, id)
  routes/services.router.js   # Endpoints REST con express.Router()
  app.js                      # Configuración de Express y montaje del router
  server.js                   # Arranque del servidor en el puerto definido en .env
package.json
.env.example
.gitignore
README.md
```

## Instalación y ejecución

```bash
git clone https://github.com/sebakine/sistema-turnos-reservas-api.git
cd sistema-turnos-reservas-api
npm install
cp .env.example .env   # En Windows (PowerShell): Copy-Item .env.example .env
npm start              # o npm run dev para reiniciar automáticamente al guardar
```

El servidor queda disponible en `http://localhost:8080` (o en el puerto definido en `PORT`).

### Variables de entorno

| Variable        | Descripción                                            | Valor por defecto        |
|-----------------|--------------------------------------------------------|--------------------------|
| `PORT`          | Puerto en el que escucha el servidor                    | `8080`                   |
| `SERVICES_FILE` | Ruta del archivo JSON de persistencia (desde la raíz)   | `src/data/services.json` |

## Modelo de un servicio

| Campo         | Tipo    | Obligatorio | Descripción                                   |
|---------------|---------|-------------|-----------------------------------------------|
| `id`          | string  | —           | UUID generado internamente con `crypto.randomUUID()` |
| `name`        | string  | Sí          | Nombre del servicio                           |
| `description` | string  | Sí          | Descripción del servicio                      |
| `category`    | string  | Sí          | Categoría (se guarda en minúsculas, ej. `salud`) |
| `price`       | number  | Sí          | Precio, mayor o igual a 0                     |
| `duration`    | integer | Sí          | Duración en minutos, mayor a 0                |
| `available`   | boolean | No          | Disponibilidad. Por defecto `true`            |

## Endpoints

Ruta base: `/api/services`

| Método | Ruta                 | Comportamiento | Códigos |
|--------|----------------------|----------------|---------|
| GET    | `/api/services`      | Devuelve todos los servicios. Acepta filtros por query params `?category=salud` y `?available=true` (combinables). | 200, 400 si el filtro es inválido |
| GET    | `/api/services/:sid` | Devuelve el servicio por id. | 200 si existe, 404 si no |
| POST   | `/api/services`      | Crea un servicio con los datos del body. El id se genera automáticamente. | 201 si se crea, 400 si faltan campos o son inválidos |
| PUT    | `/api/services/:sid` | Actualiza el servicio. No permite modificar el id. | 200 si existe, 404 si no, 400 si los datos son inválidos |
| DELETE | `/api/services/:sid` | Elimina el servicio. | 200 si existe, 404 si no |

### Uso de las partes de la petición

- **`req.params`**: lectura de `:sid` en GET, PUT y DELETE por id.
- **`req.query`**: lectura de los filtros `category` y `available` en `GET /api/services`.
- **`req.body`**: lectura de los datos del servicio en POST y PUT.

### Formato de respuesta

Respuesta exitosa:

```json
{ "status": "success", "payload": { } }
```

Respuesta con error:

```json
{ "status": "error", "error": "Descripción del error" }
```

## Ejemplos de uso

### Listar servicios

```bash
curl http://localhost:8080/api/services
curl "http://localhost:8080/api/services?category=salud"
curl "http://localhost:8080/api/services?available=true"
curl "http://localhost:8080/api/services?category=salud&available=true"
```

### Obtener un servicio por id

```bash
curl http://localhost:8080/api/services/b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50
```

### Crear un servicio (sin enviar id)

```bash
curl -X POST http://localhost:8080/api/services \
  -H "Content-Type: application/json" \
  -d '{"name":"Control dental","description":"Revisión y limpieza dental","category":"salud","price":30000,"duration":40,"available":true}'
```

Respuesta `201 Created`:

```json
{
  "status": "success",
  "message": "Servicio creado",
  "payload": {
    "id": "8f0e1c7a-2b3d-4e5f-9a6b-7c8d9e0f1a2b",
    "name": "Control dental",
    "description": "Revisión y limpieza dental",
    "category": "salud",
    "price": 30000,
    "duration": 40,
    "available": true
  }
}
```

Si faltan campos obligatorios la respuesta es `400 Bad Request`:

```json
{
  "status": "error",
  "error": "Faltan campos obligatorios: description, price, duration",
  "details": ["description", "price", "duration"]
}
```

### Actualizar un servicio

```bash
curl -X PUT http://localhost:8080/api/services/b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50 \
  -H "Content-Type: application/json" \
  -d '{"price":27000,"available":false}'
```

Si el body incluye un `id`, se ignora: el servicio conserva siempre su id original.

### Eliminar un servicio

```bash
curl -X DELETE http://localhost:8080/api/services/b3f1c2a4-5d6e-4f70-8a91-0b1c2d3e4f50
```

## Decisiones de diseño

- **Separación de responsabilidades:** `app.js` solo configura Express y monta el router; la lógica del recurso vive en `ServiceManager` y las rutas solo leen la petición, llaman al manager y responden con el código HTTP correspondiente.
- **Id autogenerado:** el `ServiceManager` descarta cualquier `id` recibido en el body y genera uno nuevo con `crypto.randomUUID()`.
- **Id inmutable:** en PUT el `id` del body se ignora y se conserva el original.
- **Campos permitidos:** solo se aceptan `name`, `description`, `category`, `price`, `duration` y `available`; los campos desconocidos se descartan.
- **Escrituras en serie:** las operaciones que modifican el archivo se encolan para evitar que peticiones simultáneas se sobrescriban.
- **Manejo de errores:** rutas inexistentes responden 404, un JSON mal formado responde 400 y los errores inesperados responden 500.

## Autor

Sebastián Muñoz
