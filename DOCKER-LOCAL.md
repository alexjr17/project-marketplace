# Desarrollo local con Docker

El frontend y el backend viven en repositorios Git independientes. En este equipo, ambos repositorios están junto a este archivo:

- `project-marketplace-web/`
- `project-marketplace-api/`

Desde la raíz de este proyecto, inicia la base de datos, prepara la clave local de Laravel, aplica migraciones e inicia API, tareas programadas y Vite:

```sh
docker compose up --build
```

Si los contenedores del Compose anterior siguen activos, detenlos antes de iniciar esta configuración para liberar los puertos `8000`, `5173` y `3307`. No hace falta borrar volúmenes.

- Frontend: <http://localhost:5173>
- API: <http://localhost:8000>
- MariaDB desde el host: `127.0.0.1:3307`

El primer arranque genera `project-marketplace-api/.env` desde `.env.example`. Ese archivo queda ignorado por Git. Las credenciales MariaDB incluidas en Compose son solo para desarrollo local. El túnel de ngrok es opcional: configura `NGROK_AUTHTOKEN` en el `.env` de esta raíz y ejecuta `docker compose --profile tunnel up --build`.

Para detener los servicios sin borrar la base de datos:

```sh
docker compose down
```

Para actualizar dependencias de cualquiera de los repositorios, reconstruye las imágenes con `docker compose up --build`.
