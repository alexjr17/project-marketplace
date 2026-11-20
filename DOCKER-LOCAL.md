# Docker local

El Compose de este proyecto usa las carpetas originales `api/` y `web/`.

Desde la raíz inicia los servicios:

```sh
docker compose up --build
```

Frontend: <http://localhost:5173>. API: <http://localhost:8000>. MariaDB desde el host: `127.0.0.1:3307`.

Para detenerlos sin borrar la base de datos:

```sh
docker compose down
```
