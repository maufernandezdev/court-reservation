## Purpose

Define la identidad visual compartida de la plataforma (colores, tipografías, estados de turno y marca de producto) para que todas las pantallas se vean como un mismo producto.

## ADDED Requirements

### Requirement: Paleta de la marca aplicada como tema
La app SHALL usar la paleta "saque" como tema base en todas las pantallas: fondo piso `#F6F7F3`, texto y superficies oscuras tinta `#101418`, acento pelota `#D7F04A` (siempre con texto tinta encima), acento línea `#2C55D1` para foco y turnos fijos, error `#C2361F` y "a favor" `#1F7A4D`. Los componentes de UI compartidos (botones, inputs, tarjetas, badges, diálogos) MUST tomar sus colores de este tema y no de valores sueltos.

#### Scenario: Botón principal
- **WHEN** se muestra un botón de acción principal (ej. "Nuevo turno", "Ingresar")
- **THEN** se ve con fondo tinta y texto claro, y su foco por teclado muestra un contorno color línea

#### Scenario: Página heredada sin rediseño
- **WHEN** se abre una página que no fue rediseñada (ej. Productos)
- **THEN** usa igualmente el fondo piso, la tipografía de interfaz y los colores del tema, sin estilos neutros del tema anterior

### Requirement: Tipografías de la marca
La app SHALL usar tres familias: una display expandida para títulos de página y números destacados, una sans para la interfaz y texto, y una monoespaciada para horarios, montos y registros. Las fuentes MUST cargarse sin provocar saltos de layout visibles y con fallback del sistema.

#### Scenario: Título de página
- **WHEN** se abre cualquier página del panel
- **THEN** el título principal usa la familia display expandida y el cuerpo usa la familia de interfaz

#### Scenario: Horarios y montos
- **WHEN** se muestran horarios ("19:00") o montos ("$24.000") en la planilla, Hoy o el detalle de un turno
- **THEN** se muestran con la familia monoespaciada

### Requirement: Estilo único por estado de turno
Cada estado de un turno SHALL tener un único estilo visual reutilizado en toda la app: pagada (fondo tinta, texto claro), señada (fondo pelota, texto tinta), pendiente (fondo blanco con borde punteado tinta) y cancelada (rayado gris con texto tachado). Los estados MUST distinguirse por luminosidad y no solo por tono, y cada uno MUST mostrarse con su texto (no solo color).

#### Scenario: Mismo estado en distintas pantallas
- **WHEN** un turno señado aparece en la planilla, en Hoy y en el detalle
- **THEN** se ve con el mismo estilo de señada en los tres lugares

#### Scenario: Contraste
- **WHEN** se muestra cualquier etiqueta de estado
- **THEN** su texto tiene un contraste de al menos 4.5:1 contra su fondo

### Requirement: Marca de producto centralizada
El nombre del producto ("saque", nombre de trabajo) y su logo (cuadrado pelota con la "T" de la línea de saque) SHALL definirse en un único lugar, de modo que cambiar el nombre no requiera tocar cada pantalla. El título del documento del navegador MUST usar el nombre del producto.

#### Scenario: Cambio de nombre del producto
- **WHEN** se cambia el nombre del producto en su definición central
- **THEN** login, registro, menú y título del navegador muestran el nombre nuevo
