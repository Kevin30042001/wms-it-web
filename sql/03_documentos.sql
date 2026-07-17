-- ═══════════════════════════════════════════════════════════════
-- Módulo Documentos: historial de memorandos de salida + hojas de
-- entrada escaneadas. Correr en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

-- Historial de memorandos generados
create table if not exists public.memorandos (
  id uuid primary key default gen_random_uuid(),
  fecha_generado timestamptz not null default now(),
  cd_destino text not null,
  asunto text,
  num_equipos int not null default 0,
  series_texto text,          -- series concatenadas, para buscar "¿cuándo envié este equipo?"
  datos jsonb not null,       -- todos los campos del memo, permite regenerar el .docx idéntico
  archivo_path text,          -- ruta del .docx en Storage (bucket "documentos")
  generado_por uuid default auth.uid()
);

-- Hojas de entrada (recepción de equipo, foto/PDF desde el teléfono)
create table if not exists public.entradas (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  origen text,                -- de dónde viene el equipo (CD, proveedor…)
  notas text,
  archivo_path text not null, -- ruta de la imagen/PDF en Storage
  subido_por uuid default auth.uid()
);

alter table public.memorandos enable row level security;
alter table public.entradas enable row level security;

drop policy if exists "memorandos_autenticados" on public.memorandos;
create policy "memorandos_autenticados" on public.memorandos
  for all to authenticated using (true) with check (true);

drop policy if exists "entradas_autenticados" on public.entradas;
create policy "entradas_autenticados" on public.entradas
  for all to authenticated using (true) with check (true);

-- Bucket privado para los archivos
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists "documentos_leer" on storage.objects;
create policy "documentos_leer" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');

drop policy if exists "documentos_subir" on storage.objects;
create policy "documentos_subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');

drop policy if exists "documentos_borrar" on storage.objects;
create policy "documentos_borrar" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos');
