-- =====================================================================
-- Comentarios por proyecto (conversación del equipo).
-- Cualquier usuario con perfil (incluida Gerencia) puede leer y comentar;
-- cada uno publica solo a su nombre y borra solo lo suyo (admin borra todo).
-- =====================================================================

create table public.comentarios (
  id           text primary key,
  proyecto_id  text not null references public.proyectos(id) on delete cascade,
  autor_id     text not null references public.perfiles(id),
  fecha        timestamptz not null default now(),
  texto        text not null check (length(texto) between 1 and 4000)
);

create index on public.comentarios (proyecto_id, fecha);

alter table public.comentarios enable row level security;

create policy lectura on public.comentarios for select to authenticated
  using (public.mi_rol() is not null);

create policy comentar on public.comentarios for insert to authenticated
  with check (public.mi_rol() is not null and autor_id = public.mi_id());

create policy borrar on public.comentarios for delete to authenticated
  using (autor_id = public.mi_id() or public.mi_rol() = 'admin');
