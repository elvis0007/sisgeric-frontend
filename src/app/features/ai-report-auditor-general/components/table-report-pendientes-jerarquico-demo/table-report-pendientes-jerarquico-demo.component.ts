import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { StatusColorPipe } from '@shared/pipe/status-color.pipe';
import * as XLSX from 'xlsx';

export interface ResponsableDemo {
  id: number;
  nombre: string;
  cargo: string;
  departamento: string;
  estadoVerificable: 'JUSTIFICA' | 'VERIFICABLE NO CREADO' | 'NO JUSTIFICA' | 'PENDIENTE';
  fechaEntregaLimit?: string;
  observaciones?: string;
}

export interface RecomendacionDemo {
  id: number;
  codigo: string;
  descripcion: string; // Texto de la Recomendación
  estadoRecomendacion: 'EN PROCESO' | 'CUMPLIDA' | 'NO CUMPLIDA' | 'NO APLICA';
  fechaMaximaCumplimiento: string;
  progresoPercent: number;
  responsables: ResponsableDemo[];
}

export interface InformeDemo {
  id: number;
  tituloInforme: string;
  organismoControl: string;
  memoAuditoria: string; // Identificador principal (e.g. EEASA-DAI-2022-015-M)
  memoAprobacion: string; // Memo aprobación Presidencia (e.g. MEM-PE-2022-045)
  auditorAsignado: string; // e.g. Ing. Carlos Alberto Mendoza
  fechaEmision: string; // YYYY-MM-DD
  anioEmision: number; // e.g. 2022, 2024, 2025, 2026
  fechaAprobacionPresidencia: string; // YYYY-MM-DD
  progresoGlobal: number; // e.g., 60%
  esArrastreHistorico: boolean; // Si es de años anteriores a 2026
  recomendaciones: RecomendacionDemo[];
  expanded?: boolean; // Para expandir/colapsar en la UI
}

@Component({
  selector: 'app-table-report-pendientes-jerarquico-demo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusColorPipe],
  templateUrl: './table-report-pendientes-jerarquico-demo.component.html',
  styleUrl: './table-report-pendientes-jerarquico-demo.component.css'
})
export class TableReportPendientesJerarquicoDemoComponent implements OnInit {

  filterForm!: FormGroup;

  // Colección de datos mock realistas extraídos del formato oficial del sistema EEASA S.A.
  allInformesMock: InformeDemo[] = [
    {
      id: 1,
      tituloInforme: 'Examen Especial a los procesos de administración, custodia, arqueos de valores, recaudación en ventanillas principales y agencias de la Empresa Eléctrica Ambato Regional Centro Norte S.A. EEASA por el período comprendido entre el 1 de enero de 2020 y el 31 de diciembre de 2021.',
      organismoControl: 'Contraloría General del Estado - Dirección de Auditoría Interna',
      memoAuditoria: 'EEASA-DAI-2022-015-M',
      memoAprobacion: 'MEM-PE-2022-045',
      auditorAsignado: 'Ing. Carlos Alberto Mendoza (Auditor Operativo)',
      fechaEmision: '2022-06-20',
      anioEmision: 2022,
      fechaAprobacionPresidencia: '2022-07-12',
      progresoGlobal: 40,
      esArrastreHistorico: true,
      expanded: true,
      recomendaciones: [
        {
          id: 101,
          codigo: 'REC-01',
          descripcion: 'Disponer al Director Financiero y al Jefe de Tesorería la actualización inmediata del Manual de Arqueos Sorpresivos de Caja Chica y Recaudación, disponiendo que se efectúen al menos dos inspecciones no notificadas por trimestre en cada una de las agencias zonales (Tungurahua, Cotopaxi, Chimborazo y Napo), remitiendo copia de las actas suscritas al equipo de Auditoría Interna dentro de los 5 días posteriores a la ejecución.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2023-01-15',
          progresoPercent: 50,
          responsables: [
            {
              id: 1001,
              nombre: 'Lcdo. Patricio Silva Montero',
              cargo: 'Tesorero Principal',
              departamento: 'Dirección Financiera',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2023-02-01',
              observaciones: 'Pendiente histórico arrastrado desde el 2022 por rotación de personal sin acta de entrega-recepción formal.'
            },
            {
              id: 1002,
              nombre: 'Ing. Elena Morales Villacís',
              cargo: 'Jefa de Contabilidad y Tesorería',
              departamento: 'Dirección Financiera',
              estadoVerificable: 'NO JUSTIFICA',
              fechaEntregaLimit: '2023-03-01',
              observaciones: 'Acta presentada con inconsistencias; falta la firma de responsabilidad del Cajero Recaudador de la Agencia Baños.'
            }
          ]
        },
        {
          id: 102,
          codigo: 'REC-02',
          descripcion: 'Instruir al Jefe de Tesorería y al Director Financiero la emisión de una directiva obligatoria para la liquidación de vales provisionales en un plazo máximo de 48 horas posteriores a la entrega de fondos, prohibiendo expresamente la emisión de nuevos vales a funcionarios con anticipos pendientes.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2023-02-28',
          progresoPercent: 20,
          responsables: [
            {
              id: 1003,
              nombre: 'Abg. Javier Paredes Cobo',
              cargo: 'Asesor Jurídico Institucional',
              departamento: 'Dirección de Asesoría Jurídica',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2023-04-15',
              observaciones: 'Borrador de resolución jurídica no ha sido remitido a la Presidencia Ejecutiva para su legalización.'
            }
          ]
        },
        {
          id: 103,
          codigo: 'REC-03',
          descripcion: 'Disponer al Director de Tecnología y Sistemas el desarrollo y despliegue de un módulo automatizado dentro del ERP Comercial y Financiero para el registro e imputación presupuestaria inmediata de los valores recaudados en ventanillas de agencias descentralizadas.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2023-06-30',
          progresoPercent: 50,
          responsables: [
            {
              id: 1004,
              nombre: 'Ing. Roberto Gómez Villafuerte',
              cargo: 'Jefe de Infraestructura Informática y Desarrollo',
              departamento: 'Dirección de Tecnología y Sistemas',
              estadoVerificable: 'JUSTIFICA',
              fechaEntregaLimit: '2023-07-01',
              observaciones: 'Módulo desarrollado, probado y puesto en producción en el sistema ERP institucional.'
            },
            {
              id: 1005,
              nombre: 'Lcda. Carmen Vega Mendoza',
              cargo: 'Analista de Presupuesto y Contabilidad',
              departamento: 'Dirección Financiera',
              estadoVerificable: 'PENDIENTE',
              fechaEntregaLimit: '2023-08-01',
              observaciones: 'Carga de datos efectuada; informe técnico pendiente de validación por la jefatura de auditoría operativa.'
            }
          ]
        },
        {
          id: 104,
          codigo: 'REC-04',
          descripcion: 'Requerir al Director Financiero la contratación de una póliza de fidelidad bancaria e indemnización por pérdidas pecuniarias que cubra el 100% del monto promedio custodiado por recaudadores y cajeros itinerantes.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2023-09-15',
          progresoPercent: 10,
          responsables: [
            {
              id: 1006,
              nombre: 'Ing. Fernando Mayorga',
              cargo: 'Analista de Adquisiciones y Seguros',
              departamento: 'Dirección de Administración',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2023-10-01',
              observaciones: 'Sin evidencia registrada en el repositorio de verificables.'
            }
          ]
        },
        {
          id: 105,
          codigo: 'REC-05',
          descripcion: 'Disponer al Director Comercial la implementación de cajas fuertes ignífugas con apertura retardada y doble clave de seguridad en todas las agencias de recaudación de la zona de concesión.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2023-11-30',
          progresoPercent: 40,
          responsables: [
            {
              id: 1007,
              nombre: 'Ing. Raúl Cárdenas',
              cargo: 'Director Comercial',
              departamento: 'Dirección Comercial',
              estadoVerificable: 'NO JUSTIFICA',
              fechaEntregaLimit: '2023-12-15',
              observaciones: 'Se entregaron cajas en 3 agencias; resta completar la instalación en Cotopaxi y Napo.'
            }
          ]
        }
      ]
    },
    {
      id: 2,
      tituloInforme: 'Examen Especial a la infraestructura de comercialización, instalación de medidores inteligentes trifásicos con tecnología AMI y procesos de lecturas atípicas en la Empresa Eléctrica Ambato Regional Centro Norte S.A.',
      organismoControl: 'Auditoría Interna EEASA S.A.',
      memoAuditoria: 'EEASA-DAI-2023-011-M',
      memoAprobacion: 'MEM-PRE-2023-102',
      auditorAsignado: 'Lcda. Sofía Benítez Jácome (Auditor General)',
      fechaEmision: '2023-08-14',
      anioEmision: 2023,
      fechaAprobacionPresidencia: '2023-09-01',
      progresoGlobal: 55,
      esArrastreHistorico: true,
      expanded: false,
      recomendaciones: [
        {
          id: 251,
          codigo: 'REC-01',
          descripcion: 'Disponer al Director Comercial y al Jefe del Laboratorio de Medición la elaboración del protocolo técnico unificado de homologación y contraste de medidores inteligentes de demanda antes de su instalación masiva en clientes industriales.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2024-03-30',
          progresoPercent: 60,
          responsables: [
            {
              id: 2501,
              nombre: 'Ing. Mauricio Crespo Tapia',
              cargo: 'Jefe del Laboratorio de Medidores',
              departamento: 'Dirección Comercial',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2024-04-15',
              observaciones: 'Verificable pendiente desde 2023 por falta de recalibración de la mesa patrones de laboratorio.'
            }
          ]
        },
        {
          id: 252,
          codigo: 'REC-02',
          descripcion: 'Instruir al Director de Tecnología y Sistemas y al Administrador del Sistema Comercial la implementación de alertas tempranas automatizadas que identifiquen variaciones de lectura superiores al 50% respecto al consumo promedio de los últimos 6 meses.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2024-06-30',
          progresoPercent: 40,
          responsables: [
            {
              id: 2502,
              nombre: 'Ing. Carlos Ruiz Soria',
              cargo: 'Administrador de Servidores y Base de Datos',
              departamento: 'Dirección de Tecnología y Sistemas',
              estadoVerificable: 'NO JUSTIFICA',
              fechaEntregaLimit: '2024-07-15',
              observaciones: 'El script cargado genera falsos positivos en clientes estacionales de consumo agrícola.'
            }
          ]
        },
        {
          id: 253,
          codigo: 'REC-03',
          descripcion: 'Disponer al Jefe de Facturación la ejecución de inspecciones de campo inmediatas para todas las cuentas comerciales que reporten tres períodos consecutivos con lectura cero o facturación estimada.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2024-08-31',
          progresoPercent: 65,
          responsables: [
            {
              id: 2503,
              nombre: 'Ing. Diego Holguín',
              cargo: 'Jefe de Facturación y Cobranzas',
              departamento: 'Dirección Comercial',
              estadoVerificable: 'PENDIENTE',
              fechaEntregaLimit: '2024-09-15',
              observaciones: 'Reporte mensual consolidado con 145 inspecciones de campo cargado para revisión final.'
            }
          ]
        },
        {
          id: 254,
          codigo: 'REC-04',
          descripcion: 'Normar el procedimiento de precintado y sellado de seguridad de alta resistencia en los armarios de medición trifásica ubicados en clientes comerciales y de media tensión.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2024-10-15',
          progresoPercent: 30,
          responsables: [
            {
              id: 2504,
              nombre: 'Ing. Raúl Cárdenas',
              cargo: 'Director Comercial',
              departamento: 'Dirección Comercial',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2024-11-01',
              observaciones: 'Sin respaldos documentales cargados en el aplicativo.'
            }
          ]
        }
      ]
    },
    {
      id: 3,
      tituloInforme: 'Auditoría de Gestión a los procesos de planificación, adquisición de materiales, ejecución del plan anual de mantenimiento preventivo y reparación de subestaciones y alimentadores primarios de la Empresa Eléctrica Ambato Regional Centro Norte S.A. EEASA.',
      organismoControl: 'Contraloría General del Estado - Dirección de Auditoría Interna',
      memoAuditoria: 'CGE-DNAI-AI-2024-018-M',
      memoAprobacion: 'MEM-PE-2024-188',
      auditorAsignado: 'Ing. Fernando Mayorga Solís (Auditor Operativo Senior)',
      fechaEmision: '2024-04-15',
      anioEmision: 2024,
      fechaAprobacionPresidencia: '2024-05-10',
      progresoGlobal: 65,
      esArrastreHistorico: true,
      expanded: false,
      recomendaciones: [
        {
          id: 301,
          codigo: 'REC-01',
          descripcion: 'Disponer al Director de Distribución e Ing. Jefe de Mantenimiento la implementación obligatoria de una bitácora digital de mantenimiento georreferenciada para la inspección y reemplazo de transformadores de distribución.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2024-11-30',
          progresoPercent: 75,
          responsables: [
            {
              id: 3001,
              nombre: 'Ing. Marco Vinicio Lasso',
              cargo: 'Jefe de Mantenimiento de Redes y Subestaciones',
              departamento: 'Dirección de Distribución',
              estadoVerificable: 'NO JUSTIFICA',
              fechaEntregaLimit: '2024-12-15',
              observaciones: 'Observado por falta de inclusión del inventario geográfico del cantón Salcedo y Píllaro.'
            }
          ]
        },
        {
          id: 302,
          codigo: 'REC-02',
          descripcion: 'Instruir al Director de Administración y al Analista de Compras Públicas la adquisición e integración de equipos de inspección por termografía infrarroja para las cuadrillas técnicas de mantenimiento operativo.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2025-02-15',
          progresoPercent: 60,
          responsables: [
            {
              id: 3002,
              nombre: 'Lcda. María Fernández Chango',
              cargo: 'Analista de Compras Públicas',
              departamento: 'Dirección de Administración',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2025-03-01',
              observaciones: 'El proceso de subasta inversa electrónica fue declarado desierto en primera convocatoria por inconsistencia en ofertas.'
            },
            {
              id: 3003,
              nombre: 'Ing. Gabriel Zurita Lara',
              cargo: 'Director de Distribución',
              departamento: 'Dirección de Distribución',
              estadoVerificable: 'JUSTIFICA',
              fechaEntregaLimit: '2025-03-15',
              observaciones: 'TDRs y especificaciones técnicas aprobadas por la Presidencia Ejecutiva.'
            }
          ]
        },
        {
          id: 303,
          codigo: 'REC-03',
          descripcion: 'Requerir a la Jefa de Talento Humano el diseño y ejecución del plan anual de capacitación teórica y práctica en prevención de riesgos eléctricos de alta tensión para linieros y supervisores de obra.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2025-05-30',
          progresoPercent: 30,
          responsables: [
            {
              id: 3004,
              nombre: 'Psic. Mónica Alarcón Tobar',
              cargo: 'Jefa de Talento Humano y Salud Ocupacional',
              departamento: 'Dirección de Talento Humano',
              estadoVerificable: 'PENDIENTE',
              fechaEntregaLimit: '2025-06-15',
              observaciones: 'Registro de asistencia cargado; pendiente consolidación del informe de competencias por el secap.'
            }
          ]
        },
        {
          id: 304,
          codigo: 'REC-04',
          descripcion: 'Disponer al Jefe de Operaciones la actualización del esquema de protecciones y coordinación de relés de sobrecorriente en las subestaciones Ambato Norte, Pishilata y Latacunga.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2025-07-31',
          progresoPercent: 50,
          responsables: [
            {
              id: 3005,
              nombre: 'Ing. Hernán Jácome',
              cargo: 'Jefe del Centro de Control Operativo SCADA',
              departamento: 'Dirección de Distribución',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2025-08-15',
              observaciones: 'Estudios de coordinación de protecciones en desarrollo por la consultora externa.'
            }
          ]
        }
      ]
    },
    {
      id: 4,
      tituloInforme: 'Auditoría de Gestión a los inventarios de bodega central, bodegas zonales, control de repuestos, transformadores de almacenamiento y bajas de activos en la Empresa Eléctrica Ambato Regional Centro Norte S.A.',
      organismoControl: 'Auditoría Interna EEASA S.A.',
      memoAuditoria: 'EEASA-AI-2025-014-M',
      memoAprobacion: 'MEM-PRE-2025-210',
      auditorAsignado: 'Ing. Mónica Villacís Paredes (Auditor Líder)',
      fechaEmision: '2025-10-10',
      anioEmision: 2025,
      fechaAprobacionPresidencia: '2025-11-05',
      progresoGlobal: 70,
      esArrastreHistorico: true,
      expanded: false,
      recomendaciones: [
        {
          id: 401,
          codigo: 'REC-01',
          descripcion: 'Disponer al Custodio de Bodega y a la Contadora General la ejecución semestral de la constatación física de existencias en bodegas centrales y la conciliación inmediata con los saldos contables reportados en el ERP.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2026-03-30',
          progresoPercent: 70,
          responsables: [
            {
              id: 4001,
              nombre: 'Sr. Fernando Mendoza Pazmiño',
              cargo: 'Custodio General de Bodega Central',
              departamento: 'Dirección de Logística y Abastecimiento',
              estadoVerificable: 'NO JUSTIFICA',
              fechaEntregaLimit: '2026-04-10',
              observaciones: 'Existen faltantes sin justificativo técnico en 12 líneas de conectores bimetálicos.'
            },
            {
              id: 4002,
              nombre: 'Ing. Andrea Torres Vaca',
              cargo: 'Contadora General Institucional',
              departamento: 'Dirección Financiera',
              estadoVerificable: 'JUSTIFICA',
              fechaEntregaLimit: '2026-04-15',
              observaciones: 'Asientos de provisión por deterioro de inventario procesados correctamente.'
            }
          ]
        },
        {
          id: 402,
          codigo: 'REC-02',
          descripcion: 'Instruir al Asesor Jurídico y al Director de Logística la formación del Comité de Remates para el remate público o chatarrización legal de materiales y transformadores dados de baja en actas de obsolescencia.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2026-06-30',
          progresoPercent: 50,
          responsables: [
            {
              id: 4003,
              nombre: 'Abg. Javier Paredes Cobo',
              cargo: 'Asesor Jurídico Institucional',
              departamento: 'Dirección de Asesoría Jurídica',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2026-07-15',
              observaciones: 'Publicación de la convocatoria a remate público pendiente de aprobación por el Comité.'
            }
          ]
        },
        {
          id: 403,
          codigo: 'REC-03',
          descripcion: 'Disponer al Jefe de Sistemas la implementación de cerraduras biométricas y cámaras CCTV de alta definición en las bodegas de almacenamiento de cobre y elementos de alto valor.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2026-07-31',
          progresoPercent: 20,
          responsables: [
            {
              id: 4004,
              nombre: 'Ing. Roberto Gómez Villafuerte',
              cargo: 'Jefe de Infraestructura Informática y Desarrollo',
              departamento: 'Dirección de Tecnología y Sistemas',
              estadoVerificable: 'PENDIENTE',
              fechaEntregaLimit: '2026-08-15',
              observaciones: 'Instalación física al 100%; falta entrega del informe de pruebas de acceso seguro.'
            }
          ]
        }
      ]
    },
    {
      id: 5,
      tituloInforme: 'Examen Especial a la contratación, licenciamiento de software corporativo, soporte técnico de la plataforma ERP y seguridad perimetral en la Empresa Eléctrica Ambato Regional Centro Norte S.A. EEASA.',
      organismoControl: 'Auditoría Interna EEASA S.A.',
      memoAuditoria: 'EEASA-AI-2026-003-M',
      memoAprobacion: 'MEM-PRE-2026-042',
      auditorAsignado: 'Ing. Carlos Alberto Mendoza (Auditor Operativo)',
      fechaEmision: '2026-03-15',
      anioEmision: 2026,
      fechaAprobacionPresidencia: '2026-04-02',
      progresoGlobal: 45,
      esArrastreHistorico: false,
      expanded: false,
      recomendaciones: [
        {
          id: 501,
          codigo: 'REC-01',
          descripcion: 'Disponer al Jefe de Sistemas y al Analista de Compras la actualización del manual de verificación previa de requisitos técnicos en pliegos de contratación de servicios informáticos y licencias.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2026-08-30',
          progresoPercent: 50,
          responsables: [
            {
              id: 5001,
              nombre: 'Ing. Roberto Gómez Villafuerte',
              cargo: 'Jefe de Infraestructura Informática y Desarrollo',
              departamento: 'Dirección de Tecnología y Sistemas',
              estadoVerificable: 'JUSTIFICA',
              fechaEntregaLimit: '2026-06-01',
              observaciones: 'Manual de listas de chequeo previa a adjudicación técnica entregado e implementado.'
            },
            {
              id: 5002,
              nombre: 'Lcda. María Fernández Chango',
              cargo: 'Analista de Compras Públicas',
              departamento: 'Dirección de Administración',
              estadoVerificable: 'VERIFICABLE NO CREADO',
              fechaEntregaLimit: '2026-07-15',
              observaciones: 'No ha registrado en el portal el acta de conformidad de verificación de pliegos.'
            }
          ]
        },
        {
          id: 502,
          codigo: 'REC-02',
          descripcion: 'Requerir al Administrador de Servidores la configuración de auditoría y monitoreo continuo de accesos privilegiados en los servidores de base de datos transaccionales con almacenamiento en disco inaccesible.',
          estadoRecomendacion: 'NO CUMPLIDA',
          fechaMaximaCumplimiento: '2026-09-15',
          progresoPercent: 20,
          responsables: [
            {
              id: 5003,
              nombre: 'Ing. Carlos Ruiz Soria',
              cargo: 'Administrador de Servidores y Base de Datos',
              departamento: 'Dirección de Tecnología y Sistemas',
              estadoVerificable: 'PENDIENTE',
              fechaEntregaLimit: '2026-07-20',
              observaciones: 'Logs del sistema SIEM enviados para evaluación del auditor operativo.'
            }
          ]
        },
        {
          id: 503,
          codigo: 'REC-03',
          descripcion: 'Disponer a la Asesoría Jurídica la inclusión de cláusulas de nivel de servicio (SLA) con penalización por indisponibilidad superior al 0.01% anual en los contratos de hospedaje y nube híbrida.',
          estadoRecomendacion: 'EN PROCESO',
          fechaMaximaCumplimiento: '2026-10-30',
          progresoPercent: 60,
          responsables: [
            {
              id: 5004,
              nombre: 'Abg. Javier Paredes Cobo',
              cargo: 'Asesor Jurídico Institucional',
              departamento: 'Dirección de Asesoría Jurídica',
              estadoVerificable: 'NO JUSTIFICA',
              fechaEntregaLimit: '2026-11-15',
              observaciones: 'Adenda contractual en revisión por discrepancias en la moneda de liquidación de multas.'
            }
          ]
        }
      ]
    }
  ];

  filteredInformes: InformeDemo[] = [];

  // KPIs
  totalInformesPendientes = 0;
  totalInformesCumplidos = 0;
  totalRecomendacionesPendientes = 0;
  totalRecomendacionesCumplidas = 0;
  totalArrastreHistorico = 0;
  totalAsignaciones = 0;

  // Filtros dinámicos
  departamentosDisponibles: string[] = [];
  aniosDisponibles: number[] = [];
  organismosControlDisponibles: string[] = [];

  constructor(private fb: FormBuilder) {}

  // Años seleccionados para filtrar (vacío = todos)
  aniosSeleccionados: number[] = [];

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      fechaCorte: ['2026-12-31'],
      departamento: ['0'], // Departamento del Responsable
      organismoControl: ['0'], // Ente / Organismo de Control
      soloVerificablesPendientes: [true], // Excluye responsables con 'JUSTIFICA'
      incluirCompletados: [false], // Excluye informes al 100%
      searchTerm: ['']
    });

    this.extractOptions();
    this.applyFilters();

    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  extractOptions(): void {
    const setDept = new Set<string>();
    const setAnios = new Set<number>();
    const setOrgCtrl = new Set<string>();

    this.allInformesMock.forEach(inf => {
      if (inf.anioEmision) setAnios.add(inf.anioEmision);
      if (inf.organismoControl) setOrgCtrl.add(inf.organismoControl);

      inf.recomendaciones.forEach(rec => {
        rec.responsables.forEach(resp => {
          if (resp.departamento) setDept.add(resp.departamento);
        });
      });
    });

    this.departamentosDisponibles = Array.from(setDept).sort();
    this.aniosDisponibles = Array.from(setAnios).sort((a, b) => a - b);
    this.organismosControlDisponibles = Array.from(setOrgCtrl).sort();
  }

  applyFilters(): void {
    const { fechaCorte, departamento, organismoControl, soloVerificablesPendientes, incluirCompletados, searchTerm } = this.filterForm.value;

    const fechaCorteDate = fechaCorte ? new Date(fechaCorte) : new Date('2099-12-31');
    const cutoffYear = fechaCorteDate.getFullYear();
    const termClean = (searchTerm || '').toLowerCase().trim();

    let result: InformeDemo[] = JSON.parse(JSON.stringify(this.allInformesMock));

    // 1. Filtrar por Fecha de Corte (Emisión <= Fecha Corte)
    result = result.filter(inf => {
      const fEmision = new Date(inf.fechaEmision);
      return fEmision <= fechaCorteDate;
    });

    // 2. Definir dinámicamente si es arrastre histórico respecto al año de la fecha de corte
    result.forEach(inf => {
      inf.esArrastreHistorico = inf.anioEmision < cutoffYear;
    });

    // 3. Filtrar por Años Anteriores seleccionados (multi-selección)
    if (this.aniosSeleccionados.length > 0) {
      result = result.filter(inf => this.aniosSeleccionados.includes(inf.anioEmision));
    }

    // 4. Filtrar por Organismo / Ente de Control (multi-selección)
    if (this.organismosSeleccionados && this.organismosSeleccionados.length > 0) {
      result = result.filter(inf => this.organismosSeleccionados.includes(inf.organismoControl));
    }

    // 5. Filtrar Informes < 100% a menos que se fuerce incluirCompletados
    if (!incluirCompletados) {
      result = result.filter(inf => inf.progresoGlobal < 100);
    }

    // 6. Filtrar por Departamento del Responsable Asignado
    if (departamento && departamento !== '0') {
      result = result.filter(inf => 
        inf.recomendaciones.some(rec => rec.responsables.some(resp => resp.departamento === departamento))
      );
    }

    // 7. Filtrar Recomendaciones y Responsables
    result.forEach(inf => {
      if (!incluirCompletados) {
        inf.recomendaciones = inf.recomendaciones.filter(rec => rec.estadoRecomendacion !== 'CUMPLIDA');
      }

      inf.recomendaciones.forEach(rec => {
        if (soloVerificablesPendientes) {
          // EXCLUIR los responsables que ya tienen estado "JUSTIFICA"
          rec.responsables = rec.responsables.filter(resp => resp.estadoVerificable !== 'JUSTIFICA');
        }

        if (departamento && departamento !== '0') {
          // Mantener sólo los responsables pertenecientes al departamento seleccionado
          rec.responsables = rec.responsables.filter(resp => resp.departamento === departamento);
        }
      });

      // Filtrar recomendaciones sin responsables resultantes si hay filtro de departamento o soloVerificablesPendientes
      if ((departamento && departamento !== '0') || soloVerificablesPendientes) {
        inf.recomendaciones = inf.recomendaciones.filter(rec => rec.responsables.length > 0);
      }
    });

    // Remover informes sin recomendaciones resultantes tras los filtros
    result = result.filter(inf => inf.recomendaciones.length > 0);

    // 7. Filtrar por término de búsqueda (Palabra Clave)
    if (termClean) {
      result = result.filter(inf => 
        inf.tituloInforme.toLowerCase().includes(termClean) ||
        inf.organismoControl.toLowerCase().includes(termClean) ||
        inf.memoAuditoria.toLowerCase().includes(termClean) ||
        inf.memoAprobacion.toLowerCase().includes(termClean) ||
        inf.auditorAsignado.toLowerCase().includes(termClean) ||
        inf.anioEmision.toString().includes(termClean) ||
        inf.recomendaciones.some(rec => 
          rec.codigo.toLowerCase().includes(termClean) ||
          rec.descripcion.toLowerCase().includes(termClean) ||
          rec.responsables.some(resp => 
            resp.nombre.toLowerCase().includes(termClean) || 
            resp.cargo.toLowerCase().includes(termClean) ||
            resp.departamento.toLowerCase().includes(termClean)
          )
        )
      );
    }

    // 8. Ordenar desde el año más antiguo hasta el actual (ascendente)
    result.sort((a, b) => a.anioEmision - b.anioEmision);

    this.filteredInformes = result;
    this.calculateKPIs();
  }

  calculateKPIs(): void {
    let infPendientesCount = 0;
    let infCumplidosCount = 0;
    let recPendientesCount = 0;
    let recCumplidasCount = 0;
    let arrastreCount = 0;
    let asignacionesCount = 0;

    this.filteredInformes.forEach(inf => {
      if (inf.progresoGlobal >= 100) {
        infCumplidosCount++;
      } else {
        infPendientesCount++;
      }

      if (inf.esArrastreHistorico) {
        arrastreCount++;
      }

      inf.recomendaciones.forEach(rec => {
        if (rec.estadoRecomendacion === 'CUMPLIDA' || rec.estadoRecomendacion === 'NO APLICA') {
          recCumplidasCount++;
        } else {
          recPendientesCount++;
        }
      });
    });

    const activeInformeKeys = new Set(
      this.filteredInformes.map(inf => `${inf.memoAuditoria}___${inf.auditorAsignado}___${inf.tituloInforme}`)
    );

    this.allInformesMock.forEach((inf: InformeDemo) => {
      const key = `${inf.memoAuditoria}___${inf.auditorAsignado}___${inf.tituloInforme}`;
      if (activeInformeKeys.has(key)) {
        inf.recomendaciones.forEach((rec: RecomendacionDemo) => {
          if (rec.responsables && rec.responsables.length > 0) {
            const realAsignaciones = rec.responsables.filter(r => r.nombre !== 'Por Asignar').length;
            asignacionesCount += realAsignaciones;
          }
        });
      }
    });

    this.totalInformesPendientes = infPendientesCount;
    this.totalInformesCumplidos = infCumplidosCount;
    this.totalRecomendacionesPendientes = recPendientesCount;
    this.totalRecomendacionesCumplidas = recCumplidasCount;
    this.totalArrastreHistorico = arrastreCount;
    this.totalAsignaciones = asignacionesCount;
  }

  toggleExpand(informe: InformeDemo): void {
    informe.expanded = !informe.expanded;
  }

  expandAll(): void {
    this.filteredInformes.forEach(inf => inf.expanded = true);
  }

  collapseAll(): void {
    this.filteredInformes.forEach(inf => inf.expanded = false);
  }

  protected organismosSeleccionados: string[] = [];

  clearFilters(): void {
    this.aniosSeleccionados = [];
    this.organismosSeleccionados = [];
    this.filterForm.patchValue({
      fechaCorte: '2026-12-31',
      departamento: '0',
      organismoControl: '0',
      soloVerificablesPendientes: true,
      incluirCompletados: false,
      searchTerm: ''
    });
    this.applyFilters();
  }

  toggleOrganismo(org: string): void {
    const idx = this.organismosSeleccionados.indexOf(org);
    if (idx >= 0) {
      this.organismosSeleccionados.splice(idx, 1);
    } else {
      this.organismosSeleccionados.push(org);
    }
    this.applyFilters();
  }

  toggleAllOrganismos(): void {
    this.organismosSeleccionados = [];
    this.applyFilters();
  }

  getOrganismosSeleccionadosLabel(): string {
    if (!this.organismosSeleccionados || this.organismosSeleccionados.length === 0) {
      return 'Todos los Entes';
    }
    if (this.organismosSeleccionados.length === 1) {
      return this.organismosSeleccionados[0];
    }
    return `${this.organismosSeleccionados.length} Entes Seleccionados`;
  }

  toggleAnio(anio: number): void {
    const idx = this.aniosSeleccionados.indexOf(anio);
    if (idx >= 0) {
      this.aniosSeleccionados.splice(idx, 1);
    } else {
      this.aniosSeleccionados.push(anio);
    }
    this.applyFilters();
  }

  toggleAllAnios(): void {
    this.aniosSeleccionados = [];
    this.applyFilters();
  }

  getAniosSeleccionadosLabel(): string {
    if (this.aniosSeleccionados.length === 0) {
      return 'Todos los Años';
    }
    const sorted = [...this.aniosSeleccionados].sort((a, b) => a - b);
    return sorted.join(', ');
  }

  exportToExcel(): void {
    const flatRows: any[] = [];

    this.filteredInformes.forEach(inf => {
      const tipoPendiente = inf.esArrastreHistorico ? 'INFORME EMITIDO' : 'AÑO ACTUAL';

      inf.recomendaciones.forEach(rec => {
        if (rec.responsables.length === 0) {
          flatRows.push({
            'Categoría Arrastre': tipoPendiente,
            'Año Emisión': inf.anioEmision,
            'Memorando Auditoría': inf.memoAuditoria,
            'Fecha Memo': this.formatDateToDisplay(inf.fechaEmision),
            'Memo Aprobación Presidencia': inf.memoAprobacion,
            'Fecha Aprobación': this.formatDateToDisplay(inf.fechaAprobacionPresidencia),
            'Auditor Asignado': inf.auditorAsignado,
            'Organismo Control': inf.organismoControl,
            'Título Informe': inf.tituloInforme,
            'Código Rec.': rec.codigo,
            'Recomendación': rec.descripcion,
            'Fecha Máx. Cumplimiento': this.formatDateToDisplay(rec.fechaMaximaCumplimiento),
            'Estado Seguimiento Rec.': rec.estadoRecomendacion,
            '% Progreso Rec.': `${rec.progresoPercent}%`,
            'Nombre Responsable': '— (Sin pendientes por justificar)',
            'Cargo Responsable': '—',
            'Departamento Responsable': '—',
            'Estado Verificable': '—',
            'Observación Auditor': 'Todos los responsables están JUSTIFICA o no hay asignación'
          });
        } else {
          rec.responsables.forEach(resp => {
            flatRows.push({
              'Categoría Arrastre': tipoPendiente,
              'Año Emisión': inf.anioEmision,
              'Memorando Auditoría': inf.memoAuditoria,
              'Fecha Memo': this.formatDateToDisplay(inf.fechaEmision),
              'Memo Aprobación Presidencia': inf.memoAprobacion,
              'Fecha Aprobación': this.formatDateToDisplay(inf.fechaAprobacionPresidencia),
              'Auditor Asignado': inf.auditorAsignado,
              'Organismo Control': inf.organismoControl,
              'Título Informe': inf.tituloInforme,
              'Código Rec.': rec.codigo,
              'Recomendación': rec.descripcion,
              'Fecha Máx. Cumplimiento': this.formatDateToDisplay(rec.fechaMaximaCumplimiento),
              'Estado Seguimiento Rec.': rec.estadoRecomendacion,
              '% Progreso Rec.': `${rec.progresoPercent}%`,
              'Nombre Responsable': resp.nombre,
              'Cargo Responsable': resp.cargo,
              'Departamento Responsable': resp.departamento,
              'Estado Verificable': resp.estadoVerificable,
              'Observación Auditor': resp.observaciones || '—'
            });
          });
        }
      });
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(flatRows);
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendientes_Fecha_Corte');
    XLSX.writeFile(workbook, `reporte_pendientes_corte_${this.filterForm.value.fechaCorte}.xlsx`);
  }

  getBadgeClass(estado: string): string {
    switch (estado) {
      case 'JUSTIFICA':
        return 'bg-emerald-700 text-white';
      case 'VERIFICABLE NO CREADO':
        return 'bg-purple-700 text-white';
      case 'OBSERVADO':
        return 'bg-amber-600 text-white';
      case 'EN REVISIÓN':
        return 'bg-blue-600 text-white';
      case 'PENDIENTE':
        return 'bg-amber-700 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  }

  getRecBadgeClass(estado: string): string {
    switch (estado) {
      case 'EN PROCESO':
        return 'bg-blue-700 text-white';
      case 'CUMPLIDA':
        return 'bg-emerald-700 text-white';
      case 'NO CUMPLIDA':
        return 'bg-rose-700 text-white';
      case 'PENDIENTE':
        return 'bg-amber-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  }

  getPendingResponsablesCount(inf: InformeDemo): number {
    let count = 0;
    inf.recomendaciones.forEach(r => count += r.responsables.length);
    return count;
  }

  formatDateToDisplay(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '') return '—';
    const cleanStr = dateStr.trim();
    const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    return cleanStr;
  }
}
