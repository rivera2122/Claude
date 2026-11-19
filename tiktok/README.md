# TikTok · Trucos de Claude en 3D

Canal de videos verticales diarios (1080×1920) que enseñan a usar Claude, con la mascota 3D low-poly **Byte** (robot original, no es el logo de Anthropic).

## Cómo generar un video

```bash
cd tiktok
npm install
node engine/render.js episodes/001-3-trucos.json                 # → out/001-3-trucos.mp4
node engine/render.js episodes/001-3-trucos.json --stills 2,10   # vista previa rápida (JPG)
```

- `engine/scene.html`: mundo 3D en Three.js (ciudad nocturna, robot y utilería animada), con textos superpuestos.
- `engine/render.js`: abre la escena en Chromium sin ventana, captura cada fotograma, arma el MP4 con ffmpeg y le agrega una pista ambiental.
- `episodes/*.json`: el guion. Cada segmento tiene `kind` (`hook`, `intro`, `tip` o `cta`), `dur` en segundos y textos (`chip`, `kicker`, `title` y `sub`). Los `tip` llevan además un `prop`: `docs` (archivos que entran a un proyecto), `screen` (una app que se arma sola) o `prompt` (tarjeta con un prompt que se escribe).
- Zonas seguras: los textos van en el tercio superior y fuera de los ~150 px de la derecha, donde están los botones de TikTok.

Renderizar tarda ~10–15 min por cada 30 s de video en el servidor (sin GPU).

## Rutina de publicación (5 min/día)

1. Descarga el MP4 del día.
2. En TikTok: súbelo, **cambia la música por un sonido en tendencia** (volumen bajo) y, si quieres, añade la voz de texto a voz de TikTok sobre los subtítulos.
3. Activa **"Contenido generado por IA"** en la configuración avanzada. Es una animación generada por código, así que el riesgo es bajo, pero declararlo evita penalizaciones.
4. Pega la descripción y los hashtags del episodio (abajo).
5. Publica entre 7 y 9 p. m. de tu zona horaria y responde los comentarios de la primera hora.

## Episodio 001: descripción para pegar

> Estás usando Claude a la mitad 😳 Estos 3 trucos me ahorran horas cada semana. ¿Cuál no conocías? 👇 Sígueme: un truco de Claude cada día.
>
> #claude #claudeai #inteligenciaartificial #ia #productividad #trucosia #chatgpt #aprendeentiktok #tecnologia

## Calendario de 30 días

| Día | Tema | Formato |
|---|---|---|
| 1 | 3 trucos que casi nadie usa (Proyectos, Artifacts, ejemplos) | tips |
| 2 | Cómo pedirle a Claude que te haga preguntas antes de responder | prompt |
| 3 | Convierte un PDF de 50 páginas en un resumen de 5 puntos | docs |
| 4 | Crea una mini-app (calculadora, quiz) sin programar | screen |
| 5 | El prompt de "rol + contexto + formato" | prompt |
| 6 | Claude para negocios: responde reseñas de clientes | prompt |
| 7 | Recap semanal: los 5 trucos de la semana (versión de más de 1 min) | tips |
| 8 | Analiza una hoja de Excel y saca gráficas | docs |
| 9 | Pídele que critique tu trabajo como un experto | prompt |
| 10 | Planifica tu semana con Claude | screen |
| 11 | Escribe correos difíciles (cobrar, decir que no) | prompt |
| 12 | Estilos: haz que Claude escriba como tú | prompt |
| 13 | Claude para estudiantes: tarjetas de estudio interactivas | screen |
| 14 | Recap + 3 errores que cometen todos | tips |
| 15 | Qué es Claude Code (explicado con el robot) | screen |
| 16 | Landing page en 2 minutos con Artifacts | screen |
| 17 | Investigación: compara 3 productos con una tabla | docs |
| 18 | Prompt para guiones de TikTok (meta 😉) | prompt |
| 19 | Claude para restaurantes: menú + posts de la semana | docs |
| 20 | "Piensa paso a paso": cuándo sí y cuándo no | prompt |
| 21 | Recap + Q&A con preguntas de los comentarios | tips |
| 22 | Automatiza tareas repetitivas | screen |
| 23 | Convierte notas de voz en un plan | docs |
| 24 | Claude para vendedores: guion de llamada y objeciones | prompt |
| 25 | Juego interactivo hecho en Artifacts | screen |
| 26 | Cómo darle tu marca (colores, tono) a todo lo que crea | docs |
| 27 | 5 prompts que guardo en notas | prompt |
| 28 | Recap + anuncio del recurso gratis (lead magnet) | tips |
| 29 | Caso real: de idea a producto en un día | screen |
| 30 | 30 días de trucos: los 3 mejores | tips |

Regla de oro: hook en el primer segundo, un solo concepto por video y una llamada a la acción para el siguiente.

## Monetización: plan por etapas

1. **Ahora (0–1k seguidores): construir audiencia y capturar contactos.** Link en la bio a un recurso gratis ("50 prompts de Claude para negocios") a cambio del correo o WhatsApp. Se puede montar en GoHighLevel (ver `../ghl/`).
2. **Ingresos directos (antes de los 10k):**
   - Producto digital propio (pack de prompts o *skills*, mini-curso) por $9–$50. Es lo que hace la cuenta de ejemplo del robot.
   - Servicio: implementar Claude y automatizaciones para negocios. Probablemente sea la fuente más rentable.
   - LIVEs con regalos y suscripciones, cuando TikTok habilite esas funciones en la cuenta.
3. **Creator Rewards Program:** pide 10k seguidores, 100k vistas en los últimos 30 días, videos de **más de 1 minuto**, ser mayor de 18 años y vivir en un país elegible (EE. UU., Reino Unido, Alemania, Francia, Japón, Corea y algunos más). Revisa en *Herramientas para creadores* si tu país califica. Desde la semana 2 conviene publicar 2–3 videos de más de 60 s por semana (los recaps).
4. **Marcas:** con más de 10k seguidores, TikTok One (Creator Marketplace) y patrocinios de herramientas de IA.

## Reglas de marca

- La cuenta debe verse como **creador independiente**: no uses "Claude oficial" ni "Anthropic" en el nombre, la foto o la bio. Algo como "Byte · trucos de IA" funciona.
- No uses el logo de Anthropic. La mascota y su emblema hexagonal son propios.
