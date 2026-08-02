-- Beta Exercise Sprint 2 - Rollback notes.
-- La importacion apply es transaccional: si falla durante ejecucion, PostgreSQL hace rollback completo.
-- No se crea tabla backup permanente para respetar la restriccion de no modificar schema.
--
-- Si todavia estas dentro de una transaccion abierta manualmente, puedes ejecutar:
ROLLBACK;
--
-- Si ya ejecutaste beta-exercise-curation-import-apply.sql y llego a COMMIT,
-- no existe un rollback automatico seguro sin una copia previa de public.exercises.
-- En ese caso usa una restauracion de backup/PITR de Supabase o un export previo verificado.
