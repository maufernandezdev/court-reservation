## Purpose

Separa el ajuste de precios, horario de la noche y señas de la lista de canchas: Canchas es un panorama rápido y los ajustes se hacen en un modal, sin sumar secciones al menú. Da la bienvenida a un club recién creado y lo guía a cargar sus precios iniciales.

## ADDED Requirements

### Requirement: Modal de Precios
El `admin` SHALL abrir desde el botón "Precios" de Canchas un modal con el horario de inicio de la noche y, por tipo de cancha del club, los precios de día y de noche (público y profe), la seña del público, la seña de profes y el resumen de un turno de ejemplo. Los precios SHALL ajustarse únicamente desde ese modal: NO SHALL existir una ruta ni una entrada de menú para Precios. Los demás roles NO SHALL acceder a Canchas.

#### Scenario: Ajustar precios
- **WHEN** el admin toca "Precios" en Canchas
- **THEN** se abre un modal con el horario de la noche y una tarjeta por cada tipo de cancha del club con sus precios y señas

#### Scenario: Guardar sin salir de Canchas
- **WHEN** el admin cambia el precio del público de tenis y guarda
- **THEN** el modal confirma el guardado y, al cerrarlo, las tarjetas de Canchas muestran el valor nuevo

#### Scenario: Club sin canchas
- **WHEN** el admin abre Precios en un club sin canchas
- **THEN** el modal indica que primero tiene que crear una cancha

### Requirement: Canchas muestra solo las canchas
La pantalla de Canchas SHALL mostrar las tarjetas de las canchas con el resumen de sus precios y seña, las acciones de cada una (editar y dar de baja), el botón "Nueva cancha" y el botón "Precios". NO SHALL incluir los formularios de precios, del horario de la noche ni de las señas.

#### Scenario: Entrar a Canchas
- **WHEN** el admin abre Canchas
- **THEN** ve las tarjetas de sus canchas y los botones "Precios" y "Nueva cancha", sin formularios de precios y sin ningún modal abierto

### Requirement: Bienvenida y precios iniciales
Al terminar de crear el club, la persona SHALL llegar a Canchas con un modal de bienvenida abierto. Con "Siguiente" el mismo modal SHALL mostrar la configuración de precios inicial; con "Más tarde" o "Listo" SHALL cerrarse. La bienvenida NO SHALL volver a aparecer al recargar la página.

#### Scenario: Club recién creado
- **WHEN** una persona termina de crear su club
- **THEN** llega a Canchas y ve el modal "¡Bienvenido a saque!" con el nombre de su club

#### Scenario: Siguiente
- **WHEN** toca "Siguiente" en la bienvenida
- **THEN** el modal muestra los precios iniciales del club, con "Atrás" para volver y "Listo" para cerrar

#### Scenario: Recarga
- **WHEN** cierra el modal y recarga la página
- **THEN** la bienvenida no aparece de nuevo
