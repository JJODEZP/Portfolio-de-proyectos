-- Datos mínimos para arrancar en producción (ejecutar después de 001_schema.sql).
-- Ajusta plantas, metas y el email del primer administrador antes de correrlo.

insert into public.clases_costo (id, nombre, descripcion) values
  ('rend', 'Rendimiento',  'Rendimiento de canal y despiece, giveaway de peso'),
  ('mo',   'Mano de obra', 'MO directa, horas extra y contratistas'),
  ('ins',  'Insumos',      'Envases, films, químicos, aditivos'),
  ('mer',  'Mermas',       'Merma de proceso, reproceso, merma en cámaras'),
  ('ene',  'Energía',      'Electricidad, gas/vapor, agua y efluentes')
on conflict (id) do nothing;

insert into public.plantas (id, nombre, meta_ahorro_anual) values
  ('pl-1', 'Planta 1', 0),
  ('pl-2', 'Planta 2', 0)
on conflict (id) do nothing;

-- Primer usuario Control de Gestión: al entrar con este email queda vinculado como admin.
-- Desde la app, en «Datos y administración», agrega luego a jefes de planta y líderes.
insert into public.perfiles (id, nombre, email, rol, planta_id) values
  ('u-admin', 'Control de Gestión', 'TU_EMAIL@empresa.cl', 'admin', null)
on conflict (id) do nothing;
