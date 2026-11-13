# github-actions-ci-demo

[![CI con Matriz](https://github.com/MariaM0325/github-actions-ci-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/MariaM0325/github-actions-ci-demo/actions/workflows/ci.yml)

Aplicación mínima en **Node.js + Express** con CRUD de usuarios en memoria y pruebas automatizadas mediante **Jest** y **Supertest**, utilizada para demostrar la creación de un pipeline de Integración Continua (CI) con **GitHub Actions**.

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

## Pipeline de CI

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) se ejecuta en cada `push` y `pull_request` sobre `main`. Incluye:

1. Checkout del código.
2. Configuración de Node.js (matriz con las versiones 18 y 20).
3. Instalación de dependencias con `npm ci`.
4. Linting con ESLint.
5. Ejecución de las pruebas con Jest y generación del reporte de cobertura, publicado como artifact.

## Protección de rama

La rama `main` está protegida: exige que los checks `build-and-test (18)` y `build-and-test (20)` pasen antes de permitir un merge. El force push y la eliminación de la rama están bloqueados. La regla se configuró mediante la API de GitHub.

## Documentación del Laboratorio

Puedes encontrar el informe completo con capturas de pantalla y evidencias en el siguiente enlace:

- [Ver informe del laboratorio](./INFORME.md)
