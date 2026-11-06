# Clínica Médica Pasión por la Vida — Sistema de Gestión Clínica

Aplicación web SPA para la Dra. Delia y Recepción: expedientes (ficha clínica, seguimiento, referencia),
laboratorio, cotizaciones, agenda con aviso diario a las 7:30 p. m. y caja.

**Tecnología:** React 18 + Vite · Node.js + Express 5 · PostgreSQL 16 (Neon / Supabase en producción).

## Usuarios

Solo existen estos dos usuarios (no hay registro público):

| Usuario | Contraseña inicial | Rol |
|---|---|---|
| `dra.delia` | `Delia#Vida2026` | Doctora: acceso total |
| `recepcion` | `Recepcion#2026` | Recepción: pacientes, laboratorio, cotizaciones, citas, caja, recetas (solo lectura) |

Cambie las contraseñas en producción con las variables `DOCTOR_PASSWORD` y `RECEPTION_PASSWORD` antes de ejecutar `db:seed`, o actualizando el hash en la tabla `users`.

## Ejecutar en local

Requisitos: Node.js 20+ y Docker.

```bash
docker compose up -d
```

```bash
cd server && cp .env.example .env && npm install && npm run db:reset
```

```bash
cd client && npm install && npm run build
```

```bash
cd server && npm start
```

Abra http://localhost:4000. Para desarrollo con recarga en vivo, ejecute `npm run dev` en `server/` y en `client/` y abra http://localhost:5173.

`npm run db:reset` borra todo y carga los **datos de prueba** (12 pacientes, fichas, seguimientos, referencias,
recetas, órdenes de laboratorio, cobros, cotizaciones y citas — incluidas citas para mañana).

## Funcionalidades

- **Ficha clínica (consulta #1)** con botones Adulto / Niño y Embarazada; el examen físico se adapta y calcula IMC, edad gestacional y fecha probable de parto.
- **Seguimiento**: una hoja por visita, numerada automáticamente; puede emitir receta y agendar la próxima cita en el mismo paso.
- **Hoja de referencia** prellenada con la ficha, el último seguimiento y los resultados de laboratorio.
- **Panel lateral** en la ficha con laboratorios, recetas y próximas citas, con botones para agregarlos.
- **Búsqueda** por nombre completo, iniciales (`MJLP`), teléfono o DPI (Ctrl + K desde cualquier pantalla).
- **Laboratorio**: catálogo con precios, órdenes, cobro, resultados; **cotizaciones** de varios exámenes y conversión en orden.
- **Agenda** con detección de choques y **aviso a las 7:30 p. m.** con las citas del día siguiente.
- **Impresión** de ficha, seguimiento, referencia, receta, orden/resultados, cotización y recibo.

## Seguridad

bcrypt para contraseñas · cookie HttpOnly + SameSite estricta (8 h) · bloqueo tras 5 intentos fallidos ·
límite de peticiones · permisos validados en el servidor · protección CSRF · consultas parametrizadas ·
Helmet/CSP · bitácora de auditoría (`audit_log`).

## Despliegue en Render

El repositorio incluye un Blueprint ([render.yaml](render.yaml)) que crea la app web en Render. La base de datos PostgreSQL vive en [Neon](https://neon.com) (plan gratuito, región AWS US West 2 · Oregón).

1. Abra https://render.com/deploy?repo=https://github.com/HLJDanni/clinica_de_la_vida e inicie sesión en Render con GitHub.
2. Pegue en `DATABASE_URL` la cadena de conexión de Neon (con `?sslmode=require`) y escriba las contraseñas de `DOCTOR_PASSWORD` y `RECEPTION_PASSWORD` (use contraseñas nuevas: las de este README son públicas) y pulse **Apply**.
3. Al terminar, la app queda en `https://clinica-pasion-por-la-vida.onrender.com` (o el nombre que Render asigne).

En el primer arranque se crean las tablas y los datos de prueba; los despliegues siguientes conservan los datos (`npm run start:prod`). Cada `git push` a `main` vuelve a desplegar.

Notas del plan gratuito: el servicio de Render se duerme tras 15 minutos sin uso (la primera visita tarda cerca de un minuto en despertar). Neon Free ofrece 1 GB que no vence y solo guarda 6 horas de historial: haga una copia completa de la base cada mes.

La cotización del proyecto está en [docs/Cotizacion_Clinica_Pasion_por_la_Vida.docx](docs/Cotizacion_Clinica_Pasion_por_la_Vida.docx).
