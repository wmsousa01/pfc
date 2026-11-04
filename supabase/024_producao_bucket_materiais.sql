-- O bucket producao nasceu (011) só para as thumbs: PNG/JPEG/WebP até 10 MB.
-- Os materiais da agenda (018) passaram a subir para ele foto de celular,
-- vídeo e PDF (o roteiro do apresentador) de até 50 MB, e o Storage recusava
-- ("mime type application/pdf is not supported"). Já aplicado em 04/11/2026.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/*', 'video/*', 'application/pdf']
 where id = 'producao';
