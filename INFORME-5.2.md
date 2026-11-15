# Informe – Laboratorio 5.2: Pipeline de Despliegue Continuo con Docker

## 1. Descripción del proyecto

Se reutiliza la API CRUD de usuarios del Laboratorio 5.1 (`github-actions-ci-demo`), desarrollada con **Node.js + Express** y probada con **Jest + Supertest**. La aplicación expone `/health` (requisito para el health check del despliegue) y el CRUD completo en `/users`.

El objetivo del laboratorio es contenerizar la aplicación con una imagen Docker optimizada y automatizar el ciclo **build → push → deploy** mediante GitHub Actions.

### Adaptación de infraestructura

El laboratorio propone Docker Hub y una instancia EC2. En este entorno no se dispone de cuenta de Docker Hub ni de un servidor remoto, por lo que se usaron equivalentes funcionales:

| Requisito original | Implementación realizada |
| --- | --- |
| Registro Docker Hub | **GitHub Container Registry (GHCR)** con el `GITHUB_TOKEN` integrado. |
| Servidor EC2 con Docker | **Runner self-hosted** en este PC con Docker Desktop. |
| Secretos SSH y de Docker Hub | No se requieren: GHCR usa el token efímero de GitHub y el despliegue se ejecuta en el runner local. |
| Puerto público 80 | Staging en **8080** y producción en **8081** (Windows bloquea el puerto 80 sin privilegios elevados). |

## 2. Arquitectura del pipeline

El workflow [`.github/workflows/cd.yml`](.github/workflows/cd.yml) se ejecuta con `push` y `pull_request` sobre `main`, además de `workflow_dispatch`. Incluye concurrencia por rama para evitar despliegues simultáneos.

| Job | Runner | Entorno | Acciones principales |
| --- | --- | --- | --- |
| `build-and-push` | `ubuntu-latest` | — | Checkout, Buildx, login a GHCR (solo en push), build multi-stage, push con etiquetas `github.sha` y `latest`, descarga de la imagen y escaneo Trivy. |
| `deploy-staging` | `self-hosted, docker` | `staging` | Login a GHCR, `docker pull`, contenedor nuevo en el puerto 3001, health check y activación en el puerto 8080. |
| `deploy-production` | `self-hosted, docker` | `production` | Login a GHCR, contenedor nuevo en el puerto 3001, health check y activación en el puerto 8081. |

Flujo resultante:

```
push a main
   └─ build-and-push (build + push a GHCR + Trivy)
        └─ deploy-staging (health check en 3001 → activo en 8080)
             └─ deploy-production (health check en 3001 → activo en 8081)
```

En los `pull_request` solo se construye la imagen localmente (sin push ni login), de modo que el pipeline valida los cambios sin publicar artefactos desde forks.

### Puertos por entorno

| Entorno | Contenedor activo | Contenedor de validación | URL local |
| --- | --- | --- | --- |
| `staging` | `mi-app-staging` | `mi-app-staging-new` (3001) | <http://localhost:8080/health> |
| `production` | `mi-app` | `mi-app-new` (3001) | <http://localhost:8081/health> |

Los puertos de validación se usan de forma secuencial (`staging` → `production`), por lo que no colisionan.

## 3. Dockerfile y decisiones técnicas

[`Dockerfile`](Dockerfile) usa un build de **múltiples etapas**:

- **Etapa `builder`**: `node:20-alpine`, copia `package*.json` e instala solo dependencias de producción con `npm ci --omit=dev`, luego copia `app.js` y `server.js`.
- **Etapa runtime**: imagen `node:20-alpine` limpia que recibe únicamente `node_modules`, los archivos de paquete y el código de la aplicación. No incluye tests, ESLint ni `.github`.
- El contenedor se ejecuta con el usuario sin privilegios `node` (UID 1000) y `NODE_ENV=production`.
- [`.dockerignore`](.dockerignore) excluye `node_modules`, `.git`, `.github`, cobertura, tests, documentación y archivos de configuración para reducir el contexto de build.

Otras decisiones:

- **Etiquetado por SHA**: cada imagen se publica como `ghcr.io/mariam0325/mi-app:<sha-completo>` y `ghcr.io/mariam0325/mi-app:latest`. El SHA es la base del rollback; `latest` simplifica el despliegue normal.
- **Despliegue con health check**: el contenedor nuevo se levanta en el puerto 3001 y el contenedor activo no se reemplaza hasta que `/health` responde 200. Si falla, el script termina con código 1 y la versión anterior sigue sirviendo.
- **GitHub Environments**: `staging` y `production` se crearon mediante la API de GitHub. Permiten asociar reglas o secretos propios por entorno; en esta implementación no se necesitan secretos adicionales.
- **Trivy**: escaneo de vulnerabilidades `CRITICAL,HIGH` en el sistema operativo y librerías. Se configuró `exit-code: '0'` para que el informe no bloquee el pipeline, tal como plantea el laboratorio; en un proyecto real conviene cambiarlo a `'1'`.
- **Caché `type=gha`**: acelera builds sucesivos reutilizando capas entre ejecuciones.
- **`vars.IMAGE_NAME` opcional**: si se define la variable de repositorio, se usa como nombre de imagen; si no, se usa `ghcr.io/mariam0325/mi-app`.
- **Permisos mínimos del token**: `packages: write` solo en `build-and-push` y `packages: read` en los jobs de despliegue.

## 4. Secretos y entornos

Con GHCR y el runner self-hosted **no se requieren secretos manuales**:

| Recurso | Estado |
| --- | --- |
| Entorno `staging` | Creado en el repositorio. |
| Entorno `production` | Creado en el repositorio. |
| `GITHUB_TOKEN` | Proporcionado automáticamente por GitHub en cada ejecución. |
| Variable opcional `IMAGE_NAME` | No definida; se usa el valor por defecto del workflow. |

> La autenticación en GHCR usa `secrets.GITHUB_TOKEN` con el permiso `packages: write` para publicar y `packages: read` para descargar en los jobs de despliegue. Al ser un token efímero y de alcance mínimo, es más seguro que almacenar credenciales de un registro externo.

## 5. Verificación local

Comandos ejecutados en la raíz del repositorio:

```bash
docker build -t mi-app:local .
docker run -d -p 3000:3000 --name app-local mi-app:local
curl http://localhost:3000/health
curl http://localhost:3000/users
docker exec app-local id
docker stop app-local && docker rm app-local
```

Resultados obtenidos:

| Verificación | Resultado |
| --- | --- |
| Build multi-stage | Exitoso, imagen `mi-app:local` de 199 MB. |
| `GET /health` | `200` con `{"status":"ok"}`. |
| `GET /users` | `200` con la lista de usuarios. |
| Usuario del contenedor | `uid=1000(node) gid=1000(node)`. |
| Pruebas unitarias | 12 de 12 aprobadas. |
| Linting | Sin errores. |
| Puerto 8080 | Disponible y respondiendo con la imagen local. |
| Puerto 80 | Bloqueado por permisos de Windows; se usa 8081 para producción. |
| Sintaxis del workflow | `cd.yml` validado con Prettier (parser YAML). |
| Runner self-hosted | `ryzen5-docker` en línea con etiquetas `self-hosted, Windows, X64, docker, local`. |

## 6. Evidencias del pipeline en GitHub Actions

### 6.1 Ejecución exitosa

- Workflow: [CD - Build, Push and Deploy #43729673176](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43729673176)
- Commit desplegado: `bd13538b781035b33b09d2cdaaebf811e5bf1d2d`
- Resultado: `success` en los tres jobs.

| Job | Duración | Resultado | Enlace |
| --- | --- | --- | --- |
| `build-and-push` | 45 s | ✅ success | [job 132859126086](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43729673176/job/132859126086) |
| `deploy-staging` | 42 s | ✅ success | [job 132859354955](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43729673176/job/132859354955) |
| `deploy-production` | 34 s | ✅ success | [job 132859573886](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43729673176/job/132859573886) |

El job `build-and-push` publicó la imagen `ghcr.io/mariam0325/mi-app` con las etiquetas `bd13538b781035b33b09d2cdaaebf811e5bf1d2d` y `latest`, descargó la imagen y ejecutó el escaneo Trivy sin bloquear el pipeline (`exit-code: 0`).

### 6.2 Verificación en el equipo local

```text
$ docker ps
NAMES            IMAGE                              PORTS                                         STATUS
mi-app           ghcr.io/mariam0325/mi-app:latest   0.0.0.0:8081->3000/tcp, [::]:8081->3000/tcp   Up
mi-app-staging   ghcr.io/mariam0325/mi-app:latest   0.0.0.0:8080->3000/tcp, [::]:8080->3000/tcp   Up

$ curl http://localhost:8080/health
{"status":"ok"} HTTP 200

$ curl http://localhost:8081/health
{"status":"ok"} HTTP 200

$ curl http://localhost:8081/users
[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}] HTTP 200
```

### 6.3 Capturas pendientes

| Evidencia | Archivo sugerido |
| --- | --- |
| Job `build-and-push` con etiquetas SHA y `latest` | `img/lab52_build_push.png` |
| Resultado del escaneo Trivy | `img/lab52_trivy.png` |
| Jobs `deploy-staging` y `deploy-production` exitosos | `img/lab52_deploy.png` |
| API desplegada en staging | `img/lab52_staging.png` |
| API desplegada en producción | `img/lab52_produccion.png` |

## 7. Prueba de cambio desplegado y simulación de fallo (Ejercicio 3.4)

### 7.1 Cambio desplegado

Se modificó `/health` en `app.js` para incluir la versión y se actualizó la prueba correspondiente:

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '2.0.0' });
});
```

- Commit: `461a46a` (`feat: agrega version 2.0.0 al endpoint de health`).
- Ejecución: [CD #43730324264](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43730324264), exitosa.
- Verificación en producción:

```text
$ curl http://localhost:8081/health
{"status":"ok","version":"2.0.0"} HTTP 200
```

### 7.2 Simulación de fallo del health check

Se cambió temporalmente el puerto interno del servidor a 4000 (`const PORT = process.env.PORT || 4000`) y se hizo push:

- Commit: `eefe997` (`test: simula fallo en el health check del despliegue`).
- Ejecución: [CD #43730583071](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43730583071).
  - `build-and-push`: ✅ success.
  - `deploy-staging`: ❌ failure en el paso "Desplegar en staging" (health check en 3001).
  - `deploy-production`: ⏭️ skipped por depender de staging.
- Los contenedores anteriores **siguieron sirviendo** la versión estable:

```text
$ curl http://localhost:8080/health
{"status":"ok","version":"2.0.0"} HTTP 200

$ curl http://localhost:8081/health
{"status":"ok","version":"2.0.0"} HTTP 200

$ docker ps
mi-app           Up 2 minutes   0.0.0.0:8081->3000/tcp
mi-app-staging   Up 3 minutes   0.0.0.0:8080->3000/tcp
```

El script de despliegue eliminó el contenedor de validación (`mi-app-staging-new`) y terminó con código 1 sin tocar los contenedores activos. El gate de staging impidió además que una imagen defectuosa llegara a producción.

### 7.3 Recuperación

Se restauró el puerto 3000 en `server.js` y se hizo un nuevo push. El pipeline volvió a ejecutarse y desplegó correctamente la versión estable en ambos entornos:

- Commit: `d724dc8` (`fix: restaura el puerto 3000 y documenta la simulacion de fallo`).
- Ejecución: [CD #43730837239](https://github.com/MariaM0325/github-actions-ci-demo/actions/runs/43730837239), con `build-and-push`, `deploy-staging` y `deploy-production` en ✅ success.

```text
$ curl http://localhost:8080/health
{"status":"ok","version":"2.0.0"} HTTP 200

$ curl http://localhost:8081/health
{"status":"ok","version":"2.0.0"} HTTP 200
```

## 8. Rollback

Gracias al etiquetado con el SHA del commit, cualquier versión publicada puede restaurarse en el servidor local:

```bash
# Autenticarse en GHCR (si el paquete no es público)
echo "$GH_TOKEN" | docker login ghcr.io -u MariaM0325 --password-stdin

# Reemplazar SHA_ANTERIOR por el SHA del commit al que se desea volver
docker pull ghcr.io/mariam0325/mi-app:SHA_ANTERIOR
docker stop mi-app
docker rm mi-app
docker run -d --name mi-app --restart unless-stopped -p 8081:3000 ghcr.io/mariam0325/mi-app:SHA_ANTERIOR
```

El comando de limpieza del pipeline (`docker system prune -f`) elimina imágenes colgantes y contenedores detenidos, pero **no** borra las imágenes etiquetadas con SHA, por lo que siguen disponibles para un rollback.

El health check y el etiquetado por SHA son estrategias complementarias: el primero evita desplegar una versión que no arranca; el segundo permite revertir rápidamente un problema detectado después del despliegue.

## 9. Checklist del despliegue

1. ~~Crear entornos `staging` y `production`~~ (completado).
2. ~~Registrar el runner self-hosted `ryzen5-docker`~~ (completado, en línea).
3. ~~Hacer commit y push del workflow actualizado y este informe~~ (completado, commit `bd13538`).
4. ~~Verificar la ejecución exitosa en la pestaña Actions~~ (completado).
5. ~~Validar `http://localhost:8080/health` y `http://localhost:8081/health`~~ (completado, ambos 200).
6. ~~Ejecutar la prueba de cambio y de fallo de la sección 7~~ (completado; ver 7.1, 7.2 y 7.3).
7. Capturar las evidencias de la sección 6.3.

## 10. Conclusiones

- El build multi-stage y la ejecución como usuario sin privilegios reducen superficie de ataque y tamaño de la imagen final.
- El health check antes de reemplazar el contenedor evita cortes de servicio por versiones defectuosas.
- El etiquetado por SHA permite trazabilidad y rollback inmediato; `latest` simplifica la operación diaria.
- GHCR con `GITHUB_TOKEN` elimina la necesidad de almacenar credenciales de registro y mantiene permisos mínimos por job.
- Los GitHub Environments separan la configuración de staging y producción y permiten añadir aprobaciones manuales en el futuro.
- El escaneo Trivy incorpora seguridad al pipeline y puede endurecerse para bloquear vulnerabilidades críticas.
- El runner self-hosted permite desplegar en un servidor propio con Docker; en un entorno real se recomienda ubicarlo en una máquina dedicada y no en un equipo de uso personal.
