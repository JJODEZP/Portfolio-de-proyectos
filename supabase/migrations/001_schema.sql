-- =====================================================================
-- Control Tower · Proyectos estratégicos multi-planta
-- Esquema PostgreSQL / Supabase con seguridad a nivel de fila (RLS).
-- Las tablas y columnas son idénticas a app/src/lib/types.ts y a los CSV
-- exportados por la app. Montos en millones de CLP (MM).
-- Ejecutar completo en Supabase → SQL Editor (o `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------- tablas
create table public.plantas (
  id                 text primary key,
  nombre             text not null,
  meta_ahorro_anual  numeric(14,2) not null default 0
);

create table public.perfiles (
  id         text primary key,
  nombre     text not null,
  email      text not null unique,
  rol        text not null check (rol in ('admin','gerencia','jefe_planta','lider')),
  planta_id  text references public.plantas(id) on delete set null,
  user_id    uuid unique references auth.users(id) on delete set null   -- se completa al primer login
);

create table public.clases_costo (
  id           text primary key,
  nombre       text not null,
  descripcion  text not null default ''
);

create table public.oportunidades (
  id         text primary key,
  clase_id   text not null references public.clases_costo(id),
  nombre     text not null,
  potencial  numeric(14,2) not null default 0
);

create table public.proyectos (
  id                         text primary key,
  codigo                     text not null unique,
  nombre                     text not null,
  descripcion                text not null default '',
  tipo                       text not null check (tipo in ('Kaizen','Proyecto','Reducción de costo')),
  etapa                      text not null check (etapa in ('Idea','Evaluación','En ejecución','Implementado','Cerrado')),
  planta_id                  text not null references public.plantas(id),
  clase_id                   text not null references public.clases_costo(id),
  oportunidad_id             text references public.oportunidades(id) on delete set null,
  lider_id                   text not null references public.perfiles(id),
  sponsor                    text not null default '',
  fecha_inicio               date not null,
  fecha_fin_plan             date not null,
  fecha_fin_real             date,
  avance_manual              int not null default 0 check (avance_manual between 0 and 100),
  linea_base                 text not null default '',
  tipo_beneficio             text not null default 'Ahorro duro' check (tipo_beneficio in ('Ahorro duro','Ahorro blando','Costo evitado')),
  ahorro_comprometido_anual  numeric(14,2) not null default 0,
  inversion_capex            numeric(14,2) not null default 0,
  inversion_opex             numeric(14,2) not null default 0,
  aprobado                   boolean not null default false,
  aprobado_por               text references public.perfiles(id),
  aprobado_en                date,
  constraint ejecucion_requiere_aprobacion
    check (aprobado or etapa in ('Idea','Evaluación'))
);

create table public.hitos (
  id           text primary key,
  proyecto_id  text not null references public.proyectos(id) on delete cascade,
  nombre       text not null,
  fecha_plan   date not null,
  fecha_real   date,
  peso         numeric(8,2) not null default 1
);

create table public.checkins (
  id              text primary key,
  proyecto_id     text not null references public.proyectos(id) on delete cascade,
  fecha           date not null,
  autor_id        text not null references public.perfiles(id),
  avance          int not null,
  salud           text not null check (salud in ('verde','amarillo','rojo')),
  comentario      text not null default '',
  riesgos         text not null default '',
  proximos_pasos  text not null default ''
);

create table public.beneficios_mensuales (
  id           text primary key,
  proyecto_id  text not null references public.proyectos(id) on delete cascade,
  anio         int not null,
  mes          int not null check (mes between 1 and 12),
  ahorro_plan  numeric(14,2) not null default 0,
  ahorro_real  numeric(14,2),
  unique (proyecto_id, anio, mes)
);

create table public.kpis (
  id           text primary key,
  proyecto_id  text not null references public.proyectos(id) on delete cascade,
  nombre       text not null,
  unidad       text not null default '',
  linea_base   numeric not null default 0,
  meta         numeric not null default 0,
  actual       numeric,
  sentido      text not null check (sentido in ('menor','mayor'))
);

create table public.replicaciones (
  id           text primary key,
  proyecto_id  text not null references public.proyectos(id) on delete cascade,
  planta_id    text not null references public.plantas(id) on delete cascade,
  estado       text not null check (estado in ('Potencial','En curso','Replicado')),
  unique (proyecto_id, planta_id)
);

create table public.costos_mensuales (
  id           text primary key,
  planta_id    text not null references public.plantas(id) on delete cascade,
  clase_id     text not null references public.clases_costo(id),
  anio         int not null,
  mes          int not null check (mes between 1 and 12),
  presupuesto  numeric(14,2) not null default 0,
  costo_real   numeric(14,2),
  estandar     numeric(14,2) not null default 0,
  unique (planta_id, clase_id, anio, mes)
);

create table public.causas_raiz (
  id          text primary key,
  planta_id   text not null references public.plantas(id) on delete cascade,
  clase_id    text not null references public.clases_costo(id),
  anio        int not null,
  mes         int not null check (mes between 1 and 12),
  impacto     numeric(14,2) not null default 0,
  causa       text not null,
  tipo_causa  text not null default '',
  estado      text not null check (estado in ('Abierta','En plan','Cerrada'))
);

create table public.acciones (
  id                 text primary key,
  descripcion        text not null,
  responsable_id     text references public.perfiles(id) on delete set null,
  fecha_vencimiento  date not null,
  estado             text not null check (estado in ('Pendiente','En curso','Hecha')),
  proyecto_id        text references public.proyectos(id) on delete cascade,
  causa_id           text references public.causas_raiz(id) on delete cascade
);

create index on public.proyectos (planta_id);
create index on public.proyectos (lider_id);
create index on public.hitos (proyecto_id);
create index on public.checkins (proyecto_id);
create index on public.beneficios_mensuales (proyecto_id);
create index on public.acciones (proyecto_id);
create index on public.acciones (causa_id);

-- ---------------------------------------------------------------- helpers de sesión
-- security definer: leen perfiles sin pasar por RLS (evita recursión de políticas)
create or replace function public.mi_perfil() returns public.perfiles
  language sql stable security definer set search_path = public as
$$ select * from public.perfiles where user_id = auth.uid() $$;

create or replace function public.mi_rol() returns text
  language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where user_id = auth.uid() $$;

create or replace function public.mi_planta() returns text
  language sql stable security definer set search_path = public as
$$ select planta_id from public.perfiles where user_id = auth.uid() $$;

create or replace function public.mi_id() returns text
  language sql stable security definer set search_path = public as
$$ select id from public.perfiles where user_id = auth.uid() $$;

create or replace function public.puede_editar_proyecto(pid text) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.proyectos p
    where p.id = pid and (
      public.mi_rol() = 'admin'
      or (public.mi_rol() = 'jefe_planta' and p.planta_id = public.mi_planta())
      or (public.mi_rol() = 'lider' and p.lider_id = public.mi_id())
    )
  )
$$;

create or replace function public.puede_editar_planta(plid text) returns boolean
  language sql stable security definer set search_path = public as
$$ select public.mi_rol() = 'admin' or (public.mi_rol() = 'jefe_planta' and public.mi_planta() = plid) $$;

-- ---------------------------------------------------------------- vincular login ↔ perfil
-- Control de Gestión crea el perfil con el email; al primer login se asocia el usuario.
create or replace function public.vincular_perfil() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  update public.perfiles set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.vincular_perfil();

-- ---------------------------------------------------------------- regla de aprobación
-- Solo admin o el jefe de la planta pueden marcar/desmarcar la aprobación.
create or replace function public.validar_aprobacion() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  if (tg_op = 'INSERT' and new.aprobado) or (tg_op = 'UPDATE' and new.aprobado is distinct from old.aprobado) then
    if not public.puede_editar_planta(new.planta_id) then
      raise exception 'Solo el jefe de planta o Control de Gestión pueden aprobar proyectos';
    end if;
    if new.aprobado then
      new.aprobado_por := coalesce(new.aprobado_por, public.mi_id());
      new.aprobado_en := coalesce(new.aprobado_en, current_date);
    end if;
  end if;
  return new;
end
$$;

create trigger proyectos_aprobacion
  before insert or update on public.proyectos for each row execute function public.validar_aprobacion();

-- ---------------------------------------------------------------- RLS
alter table public.plantas              enable row level security;
alter table public.perfiles             enable row level security;
alter table public.clases_costo         enable row level security;
alter table public.oportunidades        enable row level security;
alter table public.proyectos            enable row level security;
alter table public.hitos                enable row level security;
alter table public.checkins             enable row level security;
alter table public.beneficios_mensuales enable row level security;
alter table public.kpis                 enable row level security;
alter table public.replicaciones        enable row level security;
alter table public.costos_mensuales     enable row level security;
alter table public.causas_raiz          enable row level security;
alter table public.acciones             enable row level security;

-- Lectura: cualquier usuario con perfil ve todo el portafolio (transparencia entre plantas).
do $$
declare t text;
begin
  foreach t in array array['plantas','perfiles','clases_costo','oportunidades','proyectos','hitos','checkins',
                           'beneficios_mensuales','kpis','replicaciones','costos_mensuales','causas_raiz','acciones']
  loop
    execute format('create policy lectura on public.%I for select to authenticated using (public.mi_rol() is not null)', t);
  end loop;
end $$;

-- Maestros: solo Control de Gestión
create policy admin_escribe on public.plantas      for all to authenticated using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');
create policy admin_escribe on public.perfiles     for all to authenticated using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');
create policy admin_escribe on public.clases_costo for all to authenticated using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

-- Árbol de oportunidades: Control de Gestión y jefes de planta
create policy gestion_escribe on public.oportunidades for all to authenticated
  using (public.mi_rol() in ('admin','jefe_planta')) with check (public.mi_rol() in ('admin','jefe_planta'));

-- Proyectos
create policy crear on public.proyectos for insert to authenticated with check (
  public.mi_rol() = 'admin'
  or (public.mi_rol() = 'jefe_planta' and planta_id = public.mi_planta())
  or (public.mi_rol() = 'lider' and lider_id = public.mi_id())
);
create policy editar on public.proyectos for update to authenticated
  using (public.puede_editar_proyecto(id))
  with check (
    public.mi_rol() = 'admin'
    or (public.mi_rol() = 'jefe_planta' and planta_id = public.mi_planta())
    or (public.mi_rol() = 'lider' and lider_id = public.mi_id())
  );
create policy eliminar on public.proyectos for delete to authenticated using (public.puede_editar_planta(planta_id));

-- Detalle del proyecto: quien puede editar el proyecto
do $$
declare t text;
begin
  foreach t in array array['hitos','checkins','beneficios_mensuales','kpis','replicaciones'] loop
    execute format('create policy editar on public.%I for all to authenticated
      using (public.puede_editar_proyecto(proyecto_id)) with check (public.puede_editar_proyecto(proyecto_id))', t);
  end loop;
end $$;

-- Costos y causas raíz: admin o jefe de la planta
create policy editar on public.costos_mensuales for all to authenticated
  using (public.puede_editar_planta(planta_id)) with check (public.puede_editar_planta(planta_id));
create policy editar on public.causas_raiz for all to authenticated
  using (public.puede_editar_planta(planta_id)) with check (public.puede_editar_planta(planta_id));

-- Acciones: admin, responsable, o quien pueda editar el proyecto/causa vinculada
create or replace function public.puede_editar_accion(a public.acciones) returns boolean
  language sql stable security definer set search_path = public as
$$
  select public.mi_rol() = 'admin'
      or (public.mi_rol() <> 'gerencia' and a.responsable_id = public.mi_id())
      or (a.proyecto_id is not null and public.puede_editar_proyecto(a.proyecto_id))
      or (a.causa_id is not null and exists (
            select 1 from public.causas_raiz c where c.id = a.causa_id and public.puede_editar_planta(c.planta_id)))
$$;
create policy editar on public.acciones for all to authenticated
  using (public.puede_editar_accion(acciones)) with check (public.puede_editar_accion(acciones));

-- ---------------------------------------------------------------- vistas para Power BI
-- Las vistas corren con los permisos de su dueño: otorgarlas a un rol de solo lectura
-- (ver README) para que Power BI lea el consolidado sin pasar por RLS.

create view public.vw_proyectos as
select p.id, p.codigo, p.nombre, p.tipo, p.etapa, pl.nombre as planta, k.nombre as clase_costo,
       o.nombre as oportunidad, l.nombre as lider, p.sponsor, p.fecha_inicio, p.fecha_fin_plan, p.fecha_fin_real,
       p.aprobado, p.tipo_beneficio, p.ahorro_comprometido_anual,
       p.inversion_capex + p.inversion_opex as inversion_total,
       coalesce(h.avance_hitos, p.avance_manual) as avance_pct,
       coalesce(h.hitos_atrasados, 0) as hitos_atrasados,
       coalesce(b.ahorro_plan_acum, 0) as ahorro_plan_acum,
       coalesce(b.ahorro_real_acum, 0) as ahorro_real_acum,
       case when p.inversion_capex + p.inversion_opex > 0
            then round(p.ahorro_comprometido_anual * 100.0 / (p.inversion_capex + p.inversion_opex), 1) end as roi_esperado_pct,
       case when p.inversion_capex + p.inversion_opex > 0 and p.ahorro_comprometido_anual > 0
            then round((p.inversion_capex + p.inversion_opex) / (p.ahorro_comprometido_anual / 12), 1) end as payback_plan_meses,
       c.salud as ultima_salud_reportada, c.fecha as ultimo_checkin
from public.proyectos p
join public.plantas pl on pl.id = p.planta_id
join public.clases_costo k on k.id = p.clase_id
join public.perfiles l on l.id = p.lider_id
left join public.oportunidades o on o.id = p.oportunidad_id
left join lateral (
  select round(sum(peso) filter (where fecha_real is not null) * 100.0 / nullif(sum(peso), 0)) as avance_hitos,
         count(*) filter (where fecha_real is null and fecha_plan < current_date) as hitos_atrasados
  from public.hitos where proyecto_id = p.id
) h on true
left join lateral (
  -- hasta el último mes cerrado (mes anterior al actual)
  select sum(ahorro_plan) as ahorro_plan_acum, sum(ahorro_real) as ahorro_real_acum
  from public.beneficios_mensuales
  where proyecto_id = p.id
    and make_date(anio, mes, 1) < date_trunc('month', current_date)
) b on true
left join lateral (
  select salud, fecha from public.checkins where proyecto_id = p.id order by fecha desc limit 1
) c on true;

create view public.vw_beneficios_mensuales as
select b.proyecto_id, p.codigo, p.nombre as proyecto, pl.nombre as planta, b.anio, b.mes,
       make_date(b.anio, b.mes, 1) as periodo, b.ahorro_plan, b.ahorro_real,
       b.ahorro_real - b.ahorro_plan as desviacion
from public.beneficios_mensuales b
join public.proyectos p on p.id = b.proyecto_id
join public.plantas pl on pl.id = p.planta_id;

create view public.vw_desviacion_costos as
select c.anio, c.mes, make_date(c.anio, c.mes, 1) as periodo, pl.nombre as planta, k.nombre as clase_costo,
       c.presupuesto, c.costo_real, c.estandar,
       c.costo_real - c.presupuesto as desv_vs_presupuesto,
       case when c.presupuesto = 0 then null else round((c.costo_real - c.presupuesto) * 100.0 / c.presupuesto, 2) end as desv_pct,
       c.costo_real - c.estandar as desv_vs_estandar
from public.costos_mensuales c
join public.plantas pl on pl.id = c.planta_id
join public.clases_costo k on k.id = c.clase_id
where c.costo_real is not null;

create view public.vw_cobertura_oportunidades as
select o.id as oportunidad_id, k.nombre as clase_costo, o.nombre as oportunidad, o.potencial,
       coalesce(sum(p.ahorro_comprometido_anual), 0) as identificado,
       o.potencial - coalesce(sum(p.ahorro_comprometido_anual), 0) as brecha_sin_proyecto,
       count(p.id) as n_proyectos
from public.oportunidades o
join public.clases_costo k on k.id = o.clase_id
left join public.proyectos p on p.oportunidad_id = o.id
group by o.id, k.nombre, o.nombre, o.potencial;

-- Las vistas no se exponen a la API pública (la app lee las tablas con RLS)
revoke all on public.vw_proyectos, public.vw_beneficios_mensuales, public.vw_desviacion_costos,
              public.vw_cobertura_oportunidades from anon, authenticated;
