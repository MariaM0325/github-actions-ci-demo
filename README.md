# github-actions-ci-demo

[![CI con Matriz](https://github.com/MariaM0325/github-actions-ci-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/MariaM0325/github-actions-ci-demo/actions/workflows/ci.yml)
[![CD - Build, Push and Deploy](https://github.com/MariaM0325/github-actions-ci-demo/actions/workflows/cd.yml/badge.svg)](https://github.com/MariaM0325/github-actions-ci-demo/actions/workflows/cd.yml)

Aplicación mínima en **Node.js + Express** con CRUD de usuarios en memoria y pruebas automatizadas mediante **Jest** y **Supertest**, utilizada para demostrar la creación de un pipeline de Integración Continua (CI) y Despliegue Continuo (CD) con **GitHub Actions** y **Docker**.

## Tecnologías

- Node.js 18 / 20
- Express 5
- Jest 30
- Supertest 7
- ESLint

## Endpoints

| Método | Ruta          | Descripción                                      |
| ------ | ------------- | ------------------------------------------------ |
| GET    | `/health`     | Verifica el estado del servicio                   |
| GET    | `/users`      | Devuelve la lista de usuarios                     |
| GET    | `/users/:id`  | Devuelve un usuario por su identificador          |
| POST   | `/users`      | Crea un usuario (`{ "name": "..." }`)             |
| PUT    | `/users/:id`  | Actualiza el nombre de un usuario                 |
| DELETE | `/users/:id`  | Elimina un usuario                                |

## Uso local

```bash
npm install
npm test
npm run lint
npm start
```

El servidor queda disponible en `http://localhost:3000`.

## Uso con Docker

```bash
docker build -t mi-app:local .
docker run -d -p 3000:3000 --name app-local mi-app:local
curl http://localhost:3000/health
docker stop app-local && docker rm app-local
```

La imagen usa un build multi-stage sobre `node:20-alpine`, instala solo dependencias de producción y se ejecuta con el usuario sin privilegios `node`.

## Pipeline de CI

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) se ejecuta en cada `push` y `pull_request` sobre `main`. Incluye:

1. Checkout del código.
2. Configuración de Node.js (matriz con las versiones 18 y 20).
3. Instalación de dependencias con `npm ci`.
4. Linting con ESLint.
5. Ejecución de las pruebas con Jest y generación del reporte de cobertura, publicado como artifact.

## Pipeline de CD

El workflow [`.github/workflows/cd.yml`](.github/workflows/cd.yml) se ejecuta con `push` y `pull_request` sobre `main`, además de `workflow_dispatch`. Incluye:

1. Build de la imagen Docker multi-stage y push a **GitHub Container Registry (GHCR)** con etiquetas `github.sha` y `latest`.
2. Escaneo de vulnerabilidades con Trivy (`CRITICAL,HIGH`).
3. Despliegue en el entorno `staging` con health check previo.
4. Despliegue en el entorno `production` tras validar staging.

El contenedor nuevo se valida en el puerto 3001 y solo reemplaza al activo si `/health` responde 200. Si el health check falla, se conserva la versión anterior.

Los jobs de despliegue se ejecutan en un **runner self-hosted** (`ryzen5-docker`) con Docker Desktop. Tras un push a `main`:

- Staging: <http://localhost:8080/health>
- Producción: <http://localhost:8081/health>

### Runner self-hosted

El runner `ryzen5-docker` se inicia automáticamente al iniciar sesión mediante `github-runner.vbs` en la carpeta Startup del usuario. El script espera a que Docker Desktop esté disponible y reinicia el listener si se detiene. Registro: `C:\actions-runner\startup.log`.

### Credenciales

No se requieren secretos manuales: GHCR usa el `GITHUB_TOKEN` automático con permisos `packages: write` (build) y `packages: read` (deploy). Los entornos `staging` y `production` ya están creados en el repositorio.

La variable opcional `IMAGE_NAME` permite personalizar el nombre de la imagen (por defecto `ghcr.io/mariam0325/mi-app`).

## Protección de rama

La rama `main` está protegida: exige que los checks `build-and-test (18)` y `build-and-test (20)` pasen antes de permitir un merge. El force push y la eliminación de la rama están bloqueados. La regla se configuró mediante la API de GitHub.

## Documentación del Laboratorio

Los informes de ambos laboratorios están en el repositorio, con las capturas y las evidencias de cada ejecución:

- [Laboratorio 5.1: Integración Continua con GitHub Actions](./INFORME-5.1.md)
- [Laboratorio 5.2: Despliegue Continuo con Docker, GHCR y runner self-hosted](./INFORME.md)
