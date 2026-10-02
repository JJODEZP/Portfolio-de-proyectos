-- =====================================================================
-- Gestión de portafolio: potencial calculado de oportunidades,
-- complejidad y probabilidad de éxito de proyectos (priorización y
-- ahorro ponderado por riesgo).
-- =====================================================================

alter table public.oportunidades
  add column costo_base  numeric(14,2) not null default 0,   -- costo anual afectado (MM)
  add column mejora_pct  numeric(6,2)  not null default 0 check (mejora_pct between 0 and 100),
  add column referencia  text          not null default '';  -- benchmark / estándar / cotización

-- potencial = costo_base × mejora_pct / 100 (la app lo guarda calculado; aquí se garantiza)
create or replace function public.calcular_potencial() returns trigger language plpgsql as
$$ begin
  if new.costo_base > 0 then new.potencial := round(new.costo_base * new.mejora_pct / 100); end if;
  return new;
end $$;
create trigger oportunidades_potencial before insert or update on public.oportunidades
  for each row execute function public.calcular_potencial();

alter table public.proyectos
  add column complejidad  int not null default 3 check (complejidad between 1 and 5),
  add column probabilidad int check (probabilidad between 0 and 100);   -- null = estándar de la etapa

-- Probabilidad estándar por etapa y ahorro ponderado por riesgo (para Power BI)
create or replace view public.vw_portafolio_ponderado as
select p.id, p.codigo, p.nombre, pl.nombre as planta, p.etapa, p.complejidad,
       coalesce(p.probabilidad, case p.etapa when 'Idea' then 20 when 'Evaluación' then 50
         when 'En ejecución' then 80 when 'Implementado' then 95 else 100 end) as probabilidad,
       p.ahorro_comprometido_anual,
       round(p.ahorro_comprometido_anual * coalesce(p.probabilidad, case p.etapa when 'Idea' then 20
         when 'Evaluación' then 50 when 'En ejecución' then 80 when 'Implementado' then 95 else 100 end) / 100.0, 1)
         as ahorro_ponderado
from public.proyectos p join public.plantas pl on pl.id = p.planta_id;

revoke all on public.vw_portafolio_ponderado from anon, authenticated;
