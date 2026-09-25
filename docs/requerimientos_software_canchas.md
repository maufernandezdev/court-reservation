# Especificación de Requerimientos de Software (SRS) - Gestión de Canchas de Tenis

Este documento consolida las necesidades del cliente y el análisis funcional para la implementación del sistema de gestión de canchas.

---

## 1. Módulo de Autogestión de Reservas y Cobros (Mercado Pago)

### 1.1 Portal de Reservas Públicas (Autogestión)
* **Reserva Online Remota:** Permitir que los clientes/alumnos visualicen la disponibilidad en tiempo real y reserven sin necesidad de que el administrador esté presente en el club.
* **Integración con Pasarela de Pago (Mercado Pago):**
  * Soporte para Checkout Pro, API de pagos o QR.
  * Cobro automático de la seña o del total del turno al momento de reservar.

### 1.2 Configuración de Señalización
* **Toggle de Seña (Habilitar/Deshabilitar):** Opción global o por tipo de usuario/horario para activar o desactivar la obligatoriedad del cobro de seña previo a confirmar la reserva.
* **Porcentaje/Monto de Seña:** Permitir definir la seña como un monto fijo o un porcentaje del valor total de la cancha.

---

## 2. Gestión de Cancelaciones, Penalidades y Turnos Fijos

### 2.1 Políticas de Anulación Configurables
* **Ventana de Tiempo Previo:** Definir reglas de cancelación (ej. cancelación con más de 24hs vs. menos de 2hs de anticipación).
* **Esquema de Penalidades:**
  * **Cancelación en Término:** Devuelve/libera la seña de forma automática o genera saldo a favor.
  * **Cancelación Tardía / Fuera de Término:** Retención total de la seña o cobro de un porcentaje de penalidad.

### 2.2 Control Específico para Profesores y Turnos Fijos
* **Bloqueo de Borrado Directo:** Restringir el borrado directo de turnos para el perfil "Profe" dentro de la ventana de penalidad.
* **Gestión de Fichas / Canchas Fijas:** Ajuste de reglas especiales para reservas recurrentes o fijas de los entrenadores para evitar el alquiler "por las dudas" y posterior cancelación masiva.

---

## 3. Control de Acceso, Roles y Multiusuario

### 3.1 Gestión de Perfiles
* **Administrador Principal:** Acceso total a configuraciones, caja, penalidades y asignación de permisos.
* **Operadores / Empleados (Diego, Pablo, Jessica, etc.):** Perfil operativo con permisos para cargar, editar o cobrar turnos en la planilla diaria.
* **Profesores:** Perfil restringido que les permite autogestionar/reservar sus clases y visualizar sus turnos asignados sin permisos para eliminar turnos fuera de las políticas de cancelación.

### 3.2 Trazabilidad y Auditoría
* **Log de Acciones:** Registro de auditoría para identificar qué usuario creó, modificó, cobró o canceló cada reserva.

---

## 4. Visualización y Gestión Móvil (Planilla Responsive)

### 4.1 Planilla Digital Adaptativa (Mobile First)
* **Vista Grid de Canchas vs. Horarios:** Interfaz idéntica en lógica a la planilla física o de Excel tradicional para facilitar la adopción del personal.
* **Acceso Móvil 24/7:** Optimización completa para smartphones para que el administrador pueda consultar la ocupación y gestionar el club desde cualquier lugar fuera del predio.
* **Buscador Rápido de Disponibilidad:** Herramienta de consulta express para responder dudas o llamadas telefónicas en segundos.