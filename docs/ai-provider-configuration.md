# Configuracion de proveedor IA

SendaFit usa un cliente IA compartido para las Edge Functions. El proveedor se cambia con secretos de Supabase, sin tocar codigo.

## Proveedor por defecto

Si `AI_PROVIDER` no existe o tiene un valor invalido, la app usa:

```text
AI_PROVIDER=groq
```

Funciones que usan esta configuracion:

- `coach-chat`
- `analyze-food`
- `analyze-meal`
- `analyze-machine`

## Variables soportadas

### Groq

```text
AI_PROVIDER=groq
GROQ_API_KEY=tu_api_key
```

Modelos por defecto:

```text
GROQ_MODEL_TEXT=llama-3.3-70b-versatile
GROQ_MODEL_VISION=meta-llama/llama-4-scout-17b-16e-instruct
```

### Google AI Studio / Gemini

```text
AI_PROVIDER=google
GOOGLE_API_KEY=tu_api_key
```

Modelos por defecto:

```text
GOOGLE_MODEL_TEXT=gemini-1.5-flash
GOOGLE_MODEL_VISION=gemini-1.5-flash
```

### OpenAI

```text
AI_PROVIDER=openai
OPENAI_API_KEY=tu_api_key
```

Modelos por defecto:

```text
OPENAI_MODEL_TEXT=gpt-4o-mini
OPENAI_MODEL_VISION=gpt-4o-mini
```

## Overrides rapidos

Puedes definir un modelo general para cualquier proveedor:

```text
AI_MODEL_TEXT=nombre-del-modelo-texto
AI_MODEL_VISION=nombre-del-modelo-vision
```

Si existen, estos overrides tienen prioridad sobre `GROQ_MODEL_*`, `GOOGLE_MODEL_*` u `OPENAI_MODEL_*`.

## Cambiar proveedor en Supabase

Ejemplos con CLI:

```powershell
supabase secrets set AI_PROVIDER=groq GROQ_API_KEY="..."
supabase secrets set AI_PROVIDER=google GOOGLE_API_KEY="..."
supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY="..."
```

Despues de cambiar secretos, redeploya las funciones IA para evitar que alguna instancia siga con configuracion anterior:

```powershell
supabase functions deploy coach-chat
supabase functions deploy analyze-food
supabase functions deploy analyze-meal
supabase functions deploy analyze-machine
```

## Notas de seguridad

- No guardes API keys en archivos del repo.
- La API key del proveedor anterior ya no se usa.
- Si mantienes varias API keys cargadas, solo se usa la del proveedor indicado por `AI_PROVIDER`.
