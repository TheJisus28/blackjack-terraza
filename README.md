# Blackjack Terraza

Blackjack multijugador en tiempo real con estética **3D pixel art**: Next.js 16 + React Three Fiber + Firebase Realtime Database.

- **Mesas en tiempo real** con lobby, 8 mesas oficiales (de 10 a 100.000 fichas) y mesas creadas por jugadores (públicas o privadas).
- **Todas las mecánicas**: pedir, plantarse, doblar, dividir (con ases y redivisión), rendición tardía, seguro y pago a la par, revisión del crupier (peek), H17/S17, 3:2 o 6:5, zapato de 1 a 8 mazos con carta de corte.
- **Apuestas laterales**: Pares perfectos (25:1), 21+3 (100:1), Hot 3 (100:1) y Bust It (250:1).
- **Crupier y jugadores animados**: avatares vóxel sentados con reacciones (celebran, se lamentan, beben, hablan), expresiones faciales y parpadeo; el crupier reparte, recoge y gira hacia quien juega.
- **Cartas, fichas y sonidos reales**: reparto animado desde el zapato, volteo del hole card, pagos con fichas que vuelan; efectos de Kenney, música chiptune generativa, ambiente de casino y voz del crupier en español.
- **Perfiles**: nombre y avatar (35 personajes), nivel/XP, estadísticas, bono diario con racha, rescate de fichas y ranking.
- **Bots (IA)** que llenan la mesa cuando hay pocas personas y ceden su asiento.
- **Cámaras**: mesa, mi asiento y cenital; **mantén el clic derecho y arrastra** para mirar libremente (rueda para acercar).
- Chat de mesa, emotes con animaciones y burbujas sobre los avatares.

## Cómo correrlo

```bash
npm install
```

### Opción A — Emuladores locales (sin credenciales)

Necesita Java 11+.

```bash
npm run emulators   # Auth :9099, Database :9000, UI :4000
npm run dev:emu     # Next.js apuntando a los emuladores
```

Abre http://localhost:3000. Las reglas de `database.rules.json` se aplican también en el emulador.

### Opción B — Firebase real (proyecto `blackjack-terraza`)

La configuración web ya apunta al proyecto. El servidor necesita credenciales de administrador para escribir en la base; usa **una** de estas:

1. **Clave de cuenta de servicio** (recomendado, también para producción): Firebase Console → Configuración del proyecto → Cuentas de servicio → *Generar nueva clave privada*. Pon el JSON (o su base64) en `.env.local`:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```
2. **Application Default Credentials** para desarrollo local: `gcloud auth application-default login`.

```bash
npm run dev
```

Reglas de la base: `npm run deploy:rules` (requiere `npx firebase login`).

### Producción (Vercel)

- `vercel.json` fija las funciones en `iad1` (Washington), cerca de la base (us-central1) y de los jugadores en América.
- Variable `FIREBASE_SERVICE_ACCOUNT_KEY` con la clave de servicio (JSON o base64).
- Agrega el dominio del despliegue en Firebase Console → Authentication → Configuración → Dominios autorizados (para el login con Google).

## Arquitectura

El servidor es **autoritativo**: los clientes solo leen el estado y envían acciones.

```
Cliente (React + R3F) ──POST /api/tables/[id] {acción}──▶ Route Handler (Admin SDK)
        ▲                                                  │ transacción en tables/{id}
        └──────────── onValue(tables/{id}/state) ◀─────────┘ (motor puro src/lib/game/engine.ts)
```

- `src/lib/game/` — motor de blackjack puro y determinista (tipos, cartas, reglas, laterales, estrategia básica, bots). Probado con Vitest.
- `src/lib/server/` — transacciones, cobros idempotentes (outbox `secret/pending` + `users/{uid}/ops`), perfiles, barrido de mesas.
- El mazo y el hole card viven en `tables/{id}/secret`, ilegible para los clientes. Las fichas solo las escribe el servidor.
- Los plazos (turnos, apuestas) se guardan en el estado; cualquier cliente pide `tick` cuando vencen y la transacción hace que los duplicados no tengan efecto.
- `src/components/three/` — escena: mesa procedural con paño pixel, avatares con animaciones transferidas, cartas y fichas desde atlas de sprites, y `RenderPixelatedPass` para el look pixel art.

Datos principales: `users/{uid}` (privado), `publicProfiles/{uid}`, `lobby/{id}`, `tables/{id}/{config,state,secret}`, `presence/{id}/{uid}`, `chat/{id}`, `emotes/{id}`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm test` | Pruebas del motor (Vitest) |
| `node scripts/e2e-api.mjs` | Prueba end-to-end de la API contra los emuladores (**borra** los datos del emulador) |
| `node scripts/e2e-sidebets.mjs` | Prueba end-to-end de apuestas laterales (no borra nada) |
| `npm run assets:fetch` / `npm run assets:build` | Descarga los assets originales y regenera `public/assets` |
| `npm run deploy:rules` | Publica `database.rules.json` |

## Créditos (todos CC0)

- Avatares vóxel: [100Avatars](https://github.com/toxsam/open-source-avatars) de Polygonal Mind.
- Animaciones: [Universal Animation Library](https://opengameart.org/content/universal-animation-library-2) de Quaternius y personajes de [KayKit](https://github.com/KayKit-Game-Assets) (Kay Lousberg).
- Muebles y props: KayKit Furniture Bits y Restaurant Bits.
- Cartas, fichas y sonidos: [Kenney](https://kenney.nl) (Playing Cards Pack, Boardgame Pack, Casino Audio).
