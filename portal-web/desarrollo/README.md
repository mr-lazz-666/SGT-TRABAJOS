# Fuentes de trabajo por apartado

```text
formulario-vecinos/
└── FIX-PORTAL-001/                 Primera propuesta de Vecinos
    ├── diseno/                    CSS y mejoras visuales
    ├── candidato/                 Worker de aquella propuesta
    └── INSTRUCCIONES.md
portal-completo/
└── FIX-PORTAL-002/                 Diseño completo aprobado
    ├── src/
    │   ├── compartido/            Logo, encabezado, pie y temas
    │   ├── inicio/                Portada y selección de portal
    │   ├── vecinos/               Envío de solicitudes
    │   ├── presidentes/           Acceso y revisión
    │   └── seguimiento/           Consulta por código
    ├── base/                      Worker de referencia
    ├── candidato/                 Worker completo generado
    ├── pruebas/                   Contratos, flujo y temas
    ├── construir.py               Empaquetador de fuentes
    └── INSTRUCCIONES.md
```

## Trabajar en el portal completo

Desde la raíz del repositorio:

```text
python portal-web/desarrollo/portal-completo/FIX-PORTAL-002/construir.py
node portal-web/desarrollo/portal-completo/FIX-PORTAL-002/pruebas/contratos.mjs
node portal-web/desarrollo/portal-completo/FIX-PORTAL-002/pruebas/temas.cjs
node portal-web/desarrollo/portal-completo/FIX-PORTAL-002/pruebas/flujo-worker.mjs
```

La última prueba usa Python y SQLite temporales. Ninguna de estas pruebas publica en Cloudflare. Reconstruir el candidato no modifica automáticamente el ZIP ya distribuido en `entregas`; una entrega nueva se debe preparar, verificar y documentar por separado.

Los archivos de cada apartado en `src` son para mantenimiento. Para integración manual por el destinatario, usar siempre el paquete aprobado en `../entregas` desde esta carpeta, o el enlace del índice principal del portal.
