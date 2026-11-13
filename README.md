# github-actions-ci-demo

Aplicación mínima en **Node.js + Express** con pruebas automatizadas mediante **Jest** y **Supertest**, utilizada para demostrar la creación de un pipeline de Integración Continua (CI) con **GitHub Actions**.

## Tecnologías

- Node.js 18 / 20
- Express 5
- Jest 30
- Supertest 7
- ESLint

## Endpoints

| Método | Ruta      | Descripción                          |
| ------ | --------- | ------------------------------------ |
| GET    | `/health` | Verifica el estado del servicio       |
| GET    | `/users`  | Devuelve una lista de usuarios        |

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

## Documentación del Laboratorio

Puedes encontrar el informe completo con capturas de pantalla y evidencias en el siguiente enlace:

- [Ver informe del laboratorio](./INFORME.md)
