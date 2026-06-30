# Nutrition Data Sources

## Fuente inicial: USDA FoodData Central

SendaFit usa USDA FoodData Central como fuente inicial recomendada para alimentos verificados de beta. FoodData Central publica sus datos como dominio publico bajo CC0 1.0; aun asi, USDA solicita atribuir FoodData Central como fuente cuando se usen sus datos.

Metadatos que debe conservar cada alimento importado desde USDA:

- `source = USDA_FDC`
- `source_license = CC0_1_0`
- `fdc_id`
- `data_type`
- `source_url`
- `source_version` o fecha de publicacion/importacion
- `is_verified = true`

## SMAE

SendaFit no importa, copia ni reconstruye datos de SMAE, libros, PDFs o sitios protegidos sin licencia. La fuente `SMAE_licensed` queda reservada para un futuro en el que exista permiso/licencia explicita.

## Tipos de alimentos

- `USDA_FDC`: alimento verificado importado desde FoodData Central.
- `ai_estimated`: ingrediente detectado por IA sin alimento base confirmado.
- `user_custom`: alimento o ingrediente personalizado por el usuario; no esta verificado.
- `legacy_seed`: alimento de la base antigua pendiente de normalizacion/verificacion.
- `SMAE_licensed`: reservado, no usado sin licencia.

## Limitaciones

Los valores nutricionales son aproximados. Pueden variar por marca, método de cocción, porción real, madurez del alimento, drenado, pérdida de agua y preparación. Para beta se priorizan alimentos genéricos/no de marca y porciones en gramos para mantener trazabilidad.

## Importador

El script `scripts/import-usda-foods.ts` importa una lista controlada de alimentos frecuentes para SendaFit. Requiere:

- `FDC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Ejemplo:

```bash
npx tsx scripts/import-usda-foods.ts
```

No debe ejecutarse con datos inventados ni con fuentes no autorizadas.
