# Tareas pendientes de implementación

## 1. Control de duración de prestaciones (domicilio)

**Objetivo:** registrar cuánto tiempo dura cada prestación individual.

**Cambios en la app:**
- Agregar botón "Iniciar" con validación de ubicación en domicilio del paciente (igual que el cierre actual)
- Setear `started_at` al iniciar (columna ya existe en DB, nunca se usa para AT)
- Cambiar `CompletarPrestacionModal`: eliminar validación de ubicación al cerrar, agregar validación de mínimo 30 minutos (`completed_at - started_at >= 30 min`)
- Mostrar horas acumuladas del mes por paciente en el listado de prestaciones
- **No aplica a prestaciones de tipo Transporte** (ya tienen flujo separado)

**Cambios en la DB:**
- Ninguno — `started_at` y `completed_at` ya existen

---

## 2. Jornadas en residencias (geriátricos)

**Objetivo:** registrar las horas que el AT estuvo en la residencia (es la unidad de facturación en residencias).

**Cambios en la DB:**
- Nueva tabla `jornadas_residencia`:
  ```
  id | user_id | centro_id | fecha | entrada_at | salida_at | estado ('iniciada' | 'completada') | ubicacion_entrada
  ```
- La duración se calcula como `salida_at - entrada_at` (no hace falta columna extra)
- El vínculo con las prestaciones del día es implícito: `user_id + centro_id + fecha` (sin FK en prestaciones)

**Cambios en la app (`validar-centro.tsx`):**
- Agregar flujo "Iniciar jornada" al llegar al centro (geo-validación del centro)
- Las prestaciones individuales se completan igual que ahora dentro de la jornada
- Agregar flujo "Finalizar jornada" al salir
- Mostrar horas usadas en el mes vs. horas autorizadas para esa residencia

**Tabla adicional opcional (para el saldo de horas):**
```
autorizaciones_residencia: user_id | centro_id | mes | año | horas_autorizadas
```

---

## 3. Manejo de sesión offline (JWT vencido sin internet)

**Problema:** el JWT de Supabase dura 1 hora. Si el AT abre la app sin internet 1+ hora después del login, Supabase intenta renovar el token, falla por falta de red y desloguea al usuario — dejándolo sin acceso aunque tenga prestaciones en caché.

**Solución:** en la app, interceptar el fallo de refresh de sesión cuando no hay conectividad y mantener al usuario logueado con los datos del caché en lugar de redirigir al login.

**Nota:** no se puede cambiar el JWT expiry desde el dashboard porque el proyecto está en plan Free (requiere Pro). La solución correcta es a nivel de código de la app.

**Archivos a modificar:** revisar la inicialización del cliente Supabase y el manejo de `onAuthStateChange` / `SIGNED_OUT` cuando no hay internet.

---

## 4. Ubicaciones en backoffice

**Estado:** ya se guardan — `ubicacion_cierre` y `distancia_validacion` están en la tabla `prestaciones` y tienen datos (97% de prestaciones completadas). `ubicacion_inicio` queda vacío hasta implementar el punto 1.

**Para mostrar en backoffice:** usar `ST_Y(ubicacion_cierre::geometry) AS lat` y `ST_X(ubicacion_cierre::geometry) AS lng` en las queries o crear una vista:
```sql
CREATE VIEW v_prestaciones_con_coordenadas AS
SELECT 
  id, user_id, paciente_id, estado, completed_at,
  ST_Y(ubicacion_cierre::geometry) AS cierre_lat,
  ST_X(ubicacion_cierre::geometry) AS cierre_lng,
  distancia_validacion
FROM prestaciones;
```
