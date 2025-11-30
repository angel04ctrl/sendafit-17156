-- Crear bucket para imágenes de ejercicios
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true);

-- Crear bucket para videos de ejercicios
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-videos', 'exercise-videos', true);

-- Política: Cualquiera puede ver las imágenes (público)
CREATE POLICY "Public can view exercise images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exercise-images');

-- Política: Cualquiera puede ver los videos (público)
CREATE POLICY "Public can view exercise videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exercise-videos');

-- Política: Solo usuarios autenticados pueden subir imágenes
CREATE POLICY "Authenticated users can upload exercise images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exercise-images');

-- Política: Solo usuarios autenticados pueden subir videos
CREATE POLICY "Authenticated users can upload exercise videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exercise-videos');

-- Política: Solo usuarios autenticados pueden actualizar imágenes
CREATE POLICY "Authenticated users can update exercise images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'exercise-images');

-- Política: Solo usuarios autenticados pueden actualizar videos
CREATE POLICY "Authenticated users can update exercise videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'exercise-videos');

-- Política: Solo usuarios autenticados pueden eliminar imágenes
CREATE POLICY "Authenticated users can delete exercise images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'exercise-images');

-- Política: Solo usuarios autenticados pueden eliminar videos
CREATE POLICY "Authenticated users can delete exercise videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'exercise-videos');