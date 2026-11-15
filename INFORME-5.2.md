# Informe – Laboratorio 5.2: Pipeline de Despliegue Continuo con Docker

## 1. Descripción del proyecto

Se reutiliza la API CRUD de usuarios del Laboratorio 5.1 (`github-actions-ci-demo`), desarrollada con **Node.js + Express** y probada con **Jest + Supertest**. La aplicación expone `/health` (requisito para el health check del despliegue) y el CRUD completo en `/users`.

El objetivo de este laboratorio es contenerizar la aplicación con una imagen Docker optimizada y automatizar el ciclo **build → push → deploy** mediante GitHub Actions.

## 2. Arquitectura del pipeline

El workflow [`.github/workflows/cd.yml`](.github/workflows/cd.yml) se ejecuta con `push` y `pull_request` sobre `main`, además de `workflow_dispatch`. Incluye concurrencia por rama para evitar despliegues simultáneos.

| Job | Depende de | Entorno | Acciones principales |
| --- | --- | --- | --- |
| `build-and-push` | — | — | Checkout, Buildx, login en Docker Hub (solo en push), build multi-stage, push con etiquetas `github.sha` y `latest`, caché de GitHub Actions y escaneo Trivy. |
| `deploy-staging` | `build-and-push` | `staging` | Conexión SSH, `docker pull`, ejecución del contenedor nuevo en el puerto 3001, health check y activación en el puerto 8080. |
| `deploy-production` | `deploy-staging` | `production` | Conexión SSH, contenedor nuevo en el puerto 3001, health check y activación en el puerto 80. Requiere aprobación manual si se configura "Required reviewers" en el entorno. |

Flujo resultante:

```
push a main
   └─ build-and-push (build + push + Trivy)
        └─ deploy-staging (health check en 3001 → activo en 8080)
             └─ deploy-production (health check en 3001 → activo en 80)
```

En los `pull_request` solo se construye la imagen localmente (sin push ni login), de modo que el pipeline valida los cambios sin publicar artefactos desde forks.

### Puertos por entorno

| Entorno | Contenedor activo | Contenedor de validación | Puerto público |
| --- | --- | --- | --- |
| `staging` | `mi-app-staging` | `mi-app-staging-new` (3001) | 8080 |
| `production` | `mi-app` | `mi-app-new` (3001) | 80 |

Los puertos de validación se usan de forma secuencial (`staging` → `production`), por lo que no colisionan. Si cada entorno usa un servidor distinto, los puertos pueden coincidir.

## 3. Dockerfile y decisiones técnicas

[`Dockerfile`](Dockerfile) usa un build de **múltiples etapas**:

- **Etapa `builder`**: `node:20-alpine`, copia `package*.json` e instala solo dependencias de producción con `npm ci --omit=dev`, luego copia `app.js` y `server.js`.
- **Etapa runtime**: imagen `node:20-alpine` limpia que recibe únicamente `node_modules`, los archivos de paquete y el código de la aplicación. No incluye tests, ESLint ni `.github`.
- El contenedor se ejecuta con el usuario sin privilegios `node` (UID 1000) y `NODE_ENV=production`.
- [`.dockerignore`](.dockerignore) excluye `node_modules`, `.git`, `.github`, cobertura, tests, documentación y archivos de configuración para reducir el contexto de build.

Otras decisiones:

- **Etiquetado por SHA**: cada imagen se publica como `USUARIO/mi-app:<sha-completo>` y `USUARIO/mi-app:latest`. El SHA es la base del rollback; `latest` simplifica el despliegue normal.
- **Despliegue con health check**: el contenedor nuevo se levanta en el puerto 3001 y el contenedor activo no se reemplaza hasta que `/health` responde 200. Si falla, el script termina con código 1 y la versión anterior sigue sirviendo.
- **GitHub Environments**: `staging` y `production` permiten secretos SSH distintos por entorno y reglas de aprobación en `production`.
- **Trivy**: escaneo de vulnerabilidades `CRITICAL,HIGH` en el sistema operativo y librerías. Se configuró `exit-code: '0'` para que el informe no bloquee el pipeline, tal como plantea el laboratorio; en un proyecto real conviene cambiarlo a `'1'` cuando el equipo tenga un umbral de aceptación definido.
- **Caché `type=gha`**: acelera builds sucesivos reutilizando capas entre ejecuciones.
- **`vars.IMAGE_NAME` opcional**: si se define la variable de repositorio, se usa como nombre de imagen; si no, se deriva de `secrets.DOCKER_USERNAME` (`USUARIO/mi-app`).

## 4. Secretos y variables requeridos

### Secretos de repositorio (Settings > Secrets and variables > Actions)

| Nombre | Uso |
| --- | --- |
| `DOCKER_USERNAME` | Usuario de Docker Hub. |
| `DOCKER_PASSWORD` | Access Token de Docker Hub (no la contraseña principal). |

### Variable de repositorio (opcional)

| Nombre | Uso |
| --- | --- |
| `IMAGE_NAME` | Nombre completo de la imagen, por ejemplo `USUARIO/mi-app`. |

### Secretos por entorno (Settings > Environments)

Configurados de forma independiente en `staging` y `production`:

| Nombre | Uso |
| --- | --- |
| `SSH_HOST` | IP pública o dominio del servidor. |
| `SSH_USER` | Usuario SSH (`ubuntu`, `ec2-user`, etc.). |
| `SSH_PRIVATE_KEY` | Contenido completo de la llave privada `.pem`. |

> **Estado actual:** estos secretos aún no están configurados en el repositorio y no se dispone de una instancia EC2 ni de una cuenta de Docker Hub validada en el equipo local. Por eso el despliegue remoto queda pendiente; el código y la validación local sí están completos.

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
| Sintaxis del workflow | `cd.yml` validado con Prettier (parser YAML). |

## 6. Evidencias del pipeline en GitHub Actions

> Pendientes de capturar tras configurar Docker Hub, los entornos y el servidor remoto.

| Evidencia | Archivo sugerido |
| --- | --- |
| Secretos creados (valores ocultos) | `img/lab52_creacion_secretos.png` |
| Entornos `staging` y `production` | `img/lab52_environments.png` |
| Job `build-and-push` exitoso con etiquetas SHA y `latest` | `img/lab52_build_push.png` |
| Resultado del escaneo Trivy | `img/lab52_trivy.png` |
| Jobs `deploy-staging` y `deploy-production` exitosos | `img/lab52_deploy.png` |
| API respondiendo desde la IP pública (`/health`) | `img/lab52_api_ec2.png` |

## 7. Prueba de cambio desplegado (Ejercicio 3.4)

Procedimiento pendiente de ejecutar cuando el despliegue esté operativo:

1. Modificar `/health` en `app.js` para incluir una versión:

   ```javascript
   app.get('/health', (req, res) => {
     res.status(200).json({ status: 'ok', version: '2.0.0' });
   });
   ```

2. Hacer commit y push a `main`; el workflow de CD se dispara automáticamente.
3. Verificar el cambio en `http://IP_PUBLICA/health`.
4. **Simulación de fallo**: romper el endpoint `/health` o el arranque del servidor y hacer push. El job de despliegue falla en el health check y el contenedor anterior continúa atendiendo en el puerto 80. Corregir y volver a desplegar.

## 8. Rollback

Gracias al etiquetado con el SHA del commit, cualquier versión publicada puede restaurarse en el servidor remoto:

```bash
# Reemplazar SHA_ANTERIOR por el SHA del commit al que se desea volver
docker pull TU_USUARIO/mi-app:SHA_ANTERIOR
docker stop mi-app
docker rm mi-app
docker run -d --name mi-app --restart unless-stopped -p 80:3000 TU_USUARIO/mi-app:SHA_ANTERIOR
```

El comando de limpieza del pipeline (`docker system prune -f`) elimina imágenes colgantes y contenedores detenidos, pero **no** borra las imágenes etiquetadas con SHA, por lo que siguen disponibles para un rollback.

El health check y el etiquetado por SHA son estrategias complementarias: el primero evita desplegar una versión que no arranca; el segundo permite revertir rápidamente un problema detectado después del despliegue.

## 9. Checklist para completar el despliegue

1. Crear la cuenta en Docker Hub y un **Access Token** (Account Settings > Security > New Access Token).
2. Crear los secretos `DOCKER_USERNAME` y `DOCKER_PASSWORD` en GitHub.
3. Crear los entornos `staging` y `production` en **Settings > Environments**; en `production` agregar *Required reviewers*.
4. Crear los secretos `SSH_HOST`, `SSH_USER` y `SSH_PRIVATE_KEY` en cada entorno.
5. En el servidor: instalar Docker y `curl`, abrir los puertos 22 (SSH), 80 (producción) y 8080 (staging) en el Security Group, y verificar que el usuario SSH pueda ejecutar Docker.
6. Hacer commit y push de `Dockerfile`, `.dockerignore` y `.github/workflows/cd.yml`.
7. Verificar ambos jobs en la pestaña **Actions** y capturar las evidencias de la sección 6.
8. Ejecutar la prueba de cambio y de fallo de la sección 7.
9. Actualizar este informe con las capturas y la URL pública final.

## 10. Conclusiones

- El build multi-stage y la ejecución como usuario sin privilegios reducen superficie de ataque y tamaño de la imagen final.
- El health check antes de reemplazar el contenedor evita cortes de servicio por versiones defectuosas.
- El etiquetado por SHA permite trazabilidad y rollback inmediato; `latest` simplifica la operación diaria.
- Los GitHub Environments separan credenciales y permiten aprobaciones manuales antes de producción.
- El escaneo Trivy incorpora seguridad al pipeline y puede endurecerse para bloquear vulnerabilidades críticas.
- La validación local confirma que la imagen construye y responde correctamente; el despliegue remoto queda a la espera de la infraestructura (Docker Hub y servidor con Docker).
