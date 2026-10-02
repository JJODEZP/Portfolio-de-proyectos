// Modelo de datos. Los nombres de tablas y columnas son idénticos a los de
// supabase/migrations/001_schema.sql para no tener capa de mapeo.
// Montos en millones de CLP (MM).

export type Rol = 'admin' | 'gerencia' | 'jefe_planta' | 'lider';

export const ROLES: Record<Rol, string> = {
  admin: 'Control de Gestión',
  gerencia: 'Gerencia (lectura)',
  jefe_planta: 'Jefe de Planta',
  lider: 'Líder de Proyecto',
};

export const ETAPAS = ['Idea', 'Evaluación', 'En ejecución', 'Implementado', 'Cerrado'] as const;
export type Etapa = (typeof ETAPAS)[number];

export const TIPOS = ['Kaizen', 'Proyecto', 'Reducción de costo'] as const;
export type TipoProyecto = (typeof TIPOS)[number];

export const TIPOS_BENEFICIO = ['Ahorro duro', 'Ahorro blando', 'Costo evitado'] as const;
export type TipoBeneficio = (typeof TIPOS_BENEFICIO)[number];

export type Salud = 'verde' | 'amarillo' | 'rojo';

export interface Planta {
  id: string;
  nombre: string;
  meta_ahorro_anual: number;
}

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  planta_id: string | null;
  user_id?: string | null;
}

export interface ClaseCosto {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Oportunidad {
  id: string;
  clase_id: string;
  nombre: string;
  potencial: number;
}

export interface Proyecto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: TipoProyecto;
  etapa: Etapa;
  planta_id: string;
  clase_id: string;
  oportunidad_id: string | null;
  lider_id: string;
  sponsor: string;
  fecha_inicio: string;
  fecha_fin_plan: string;
  fecha_fin_real: string | null;
  avance_manual: number;
  linea_base: string;
  tipo_beneficio: TipoBeneficio;
  ahorro_comprometido_anual: number;
  inversion_capex: number;
  inversion_opex: number;
  aprobado: boolean;
  aprobado_por: string | null;
  aprobado_en: string | null;
}

export interface Hito {
  id: string;
  proyecto_id: string;
  nombre: string;
  fecha_plan: string;
  fecha_real: string | null;
  peso: number;
}

export interface Checkin {
  id: string;
  proyecto_id: string;
  fecha: string;
  autor_id: string;
  avance: number;
  salud: Salud;
  comentario: string;
  riesgos: string;
  proximos_pasos: string;
}

export interface BeneficioMensual {
  id: string;
  proyecto_id: string;
  anio: number;
  mes: number;
  ahorro_plan: number;
  ahorro_real: number | null;
}

export interface Kpi {
  id: string;
  proyecto_id: string;
  nombre: string;
  unidad: string;
  linea_base: number;
  meta: number;
  actual: number | null;
  sentido: 'menor' | 'mayor';
}

export interface Replicacion {
  id: string;
  proyecto_id: string;
  planta_id: string;
  estado: 'Potencial' | 'En curso' | 'Replicado';
}

export interface CostoMensual {
  id: string;
  planta_id: string;
  clase_id: string;
  anio: number;
  mes: number;
  presupuesto: number;
  costo_real: number | null;
  estandar: number;
}

export interface CausaRaiz {
  id: string;
  planta_id: string;
  clase_id: string;
  anio: number;
  mes: number;
  impacto: number;
  causa: string;
  tipo_causa: string;
  estado: 'Abierta' | 'En plan' | 'Cerrada';
}

export interface Accion {
  id: string;
  descripcion: string;
  responsable_id: string | null;
  fecha_vencimiento: string;
  estado: 'Pendiente' | 'En curso' | 'Hecha';
  proyecto_id: string | null;
  causa_id: string | null;
}

export interface Comentario {
  id: string;
  proyecto_id: string;
  autor_id: string;
  fecha: string; // ISO con hora
  texto: string;
}

export interface Tables {
  plantas: Planta[];
  perfiles: Perfil[];
  clases_costo: ClaseCosto[];
  oportunidades: Oportunidad[];
  proyectos: Proyecto[];
  hitos: Hito[];
  checkins: Checkin[];
  beneficios_mensuales: BeneficioMensual[];
  kpis: Kpi[];
  replicaciones: Replicacion[];
  costos_mensuales: CostoMensual[];
  causas_raiz: CausaRaiz[];
  acciones: Accion[];
  comentarios: Comentario[];
}

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T][number];

export const TABLE_NAMES: TableName[] = [
  'plantas', 'perfiles', 'clases_costo', 'oportunidades', 'proyectos', 'hitos', 'checkins',
  'beneficios_mensuales', 'kpis', 'replicaciones', 'costos_mensuales', 'causas_raiz', 'acciones', 'comentarios',
];

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const TIPOS_CAUSA = ['Operación', 'Mantención', 'Proveedor / Precio', 'Planificación', 'Calidad', 'Personas'];
