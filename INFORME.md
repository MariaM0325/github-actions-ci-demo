# Informe – Laboratorio 5.1: Workflow de GitHub Actions para CI

## 1. Descripción del proyecto

`github-actions-ci-demo` es una API mínima desarrollada con **Node.js** y **Express** que expone dos endpoints:

- `GET /health`: responde `{ "status": "ok" }`.
- `GET /users`: responde una lista con dos usuarios.

Las pruebas unitarias/de integración se implementan con **Jest** y **Supertest**.

## 2. Pipeline configurado

El workflow se encuentra en `.github/workflows/ci.yml` y se dispara con eventos `push` y `pull_request` sobre la rama `main`.

| Etapa | Descripción |
| ----- | ----------- |
| Checkout | Descarga el código con `actions/checkout@v6`. |
| Setup | Configura Node.js con `actions/setup-node@v6` usando una matriz de versiones 18 y 20. |
| Instalación | Ejecuta `npm ci` para instalar las versiones exactas del `package-lock.json`. |
| Linting | Ejecuta `npm run lint` con ESLint. |
| Pruebas | Ejecuta `npm test` con Jest. |

La matriz genera dos jobs en paralelo, uno por cada versión de Node.js.

> Nota: se fijó ESLint en la versión 9 porque ESLint 10 requiere Node.js ≥ 20 y el job de Node 18 de la matriz fallaría.

## 3. Verificación local

| Comando | Resultado |
| ------- | --------- |
| `npm test` | 2 pruebas aprobadas, 0 fallidas. |
| `npm run lint` | Sin errores. |
| `npm run lint` con una variable no utilizada | Falla con `no-unused-vars`, como se espera. |
| `npm run test:coverage` | 100 % en sentencias, ramas, funciones y líneas. |

## 4. Evidencias

> Sustituye cada marcador por la captura correspondiente una vez subido el repositorio a GitHub.

### 4.1 Historial de ejecuciones en la pestaña Actions

_(Pendiente: captura del historial de workflows exitosos y fallidos.)_

### 4.2 Detalle de un workflow exitoso con cobertura

_(Pendiente: ejecutar `npm run test:coverage` en CI o localmente y capturar el reporte de cobertura.)_

### 4.3 Detalle de un workflow fallido

_(Pendiente: captura del job fallido. Para reproducirlo se puede introducir una variable no utilizada en `app.js` y ejecutar `npm run lint`.)_

### 4.4 Regla de protección de rama

_(Pendiente: captura de Settings > Branches > regla sobre `main` con "Require status checks to pass before merging" habilitado.)_

## 5. Conclusiones

- GitHub Actions permite automatizar la verificación del código en cada cambio sin infraestructura propia.
- El linting detecta errores de estilo y variables no utilizadas antes de llegar a producción.
- Las matrices de ejecución garantizan compatibilidad con varias versiones de Node.js.
- La protección de rama obliga a que el pipeline pase antes de integrar cambios, mejorando la calidad del repositorio.
