
## ✅ Modulo de productos
> ✅ **Aplicado (12/10/2026).** Productos ya no aparece en el menú y `/dashboard/productos` redirige a Hoy. El código queda intacto: se vuelve a mostrar poniendo `products: true` en `lib/features.ts`.

Lo que es la parte del kiosco, es decir, de los productos, por ahora será un módulo que no vamos a mostrar. Hagamos algo para que quede el desarrollo ya hecho, pero por ahora no lo mostraremos para no abrumar a mi cliente. Además, no es algo que haya pedido. Después le podemos agregar este módulo. 

## ✅ Modulo socios
> ✅ **Aplicado (12/10/2026).** Socios tiene alta, edición, baja y búsqueda (nombre, DNI, teléfono, correo opcional), sin cuota, para admin y operador. Al cargar un turno, el campo de nombre es un buscador: escribís "Mau", aparece "Mauricio Fernández" y con Enter queda fijado; se pueden fijar hasta 4 personas (socios o no) y la primera es quien reserva.

Este es un módulo que va a seguir estando, pero hay que agregarle algo. No hay ningún botón para agregar un nuevo socio y debería estar. Hoy veo que tiene nombre, DNI, teléfono y está la cuota. En el club donde vamos a iniciar no tienen cuota, así que eso lo vamos a sacar. Pero nombre, DNI, teléfono, mail opcional, esas cosas sí deberían estar. 

¿Y en dónde se integra esto? ¿En dónde se integra esto de los socios? Bueno, cuando se va a generar un turno, la idea es que hay un input para escribir el nombre del socio o del equipo, es decir, la persona que reserva o las dos personas que van a jugar, que pueden ser hasta cuatro si es un dobles. Entonces se podría hacer algo para que se agreguen estas personas que van a jugar o la persona que reserva. Tengo duda de eso porque no lo quiero hacer muy complicado.

En esta etapa del proyecto es complicado, pero intentémoslo sin complicarle la vida al operador o al administrador. En esta fase es difícil rastrear a todas las personas que estarán dentro de la cancha, porque no son ellas quienes tienen la aplicación, sino el socio. Si fueran los usuarios los que reservan, cada uno tendría que confirmar en su aplicación. El problema es que eso no ocurrirá ahora; será el dueño quien reserve, a nombre de un solo socio por ahora, salvo que encontremos otra solución.

## ✅ Torneos
> ✅ **Aplicado (12/10/2026).** Al cargar un turno se elige el tipo: estándar, profe o torneo. El torneo pide al menos 2 jugadores (singles) o 4 (dobles) y en la planilla se ve como "A vs B" con un trofeo. Los turnos fijos (todas las semanas, hasta darlos de baja) también están: se marca "Repetir todas las semanas" al crear el turno.

Bueno, este es otro tema, porque al crear, no es que se van a crear los torneos aquí, sino que una cancha puede ser de torneo. Puede ser una reserva convencional, puede ser un torneo, puede ser un profesor que reserve la cancha, lo cual es casi como una reserva convencional, solo que podríamos señalar que la cancha es de profesor, o podría ser una reserva fija de todos los lunes a las nueve de la mañana, por ejemplo, que es una reserva convencional, solo que se le agrega el condimento de que sea fija siempre, hasta que en algún momento se quiera dar de baja esa reserva fija, ¿no? 

Entonces, en la parte de la reserva de torneo habría que poner las dos o las cuatro personas que van a jugar. En la planilla se marcan las personas que participan en el torneo. Cuando la cancha es de tipo torneo, en la hora, dos horas o una hora y media que se reserva, ya aparecen los dos nombres. Por lo tanto, si la cancha es de tipo torneo, sí hay que agregar a las dos personas, que pueden ser socios o no socios. 

Quizás la idea sea que en la búsqueda del input, por ejemplo en la nueva reserva donde se escribe el nombre del socio o del equipo, pueda ser un input de búsqueda. Por ejemplo, al escribir “Mau” aparece Mauricio Fernández; al hacer clic o presionar Enter queda fijado. Así se puede poner más de una persona, pero al menos una para la reserva de la cancha. 

Entonces, ahí quizás ya quedaría cubierto también lo de los socios, porque podría poner, si quisiera, dos socios, pero por lo menos uno es el que tiene que reservar la cancha. ¿Se entiende? 

## ✅ Tiempo estandar de cancha de torneos
> ✅ **Aplicado (12/10/2026).** La duración estándar de torneo se configura en Políticas → Torneos. Al cargar un torneo arranca con ese tiempo y se puede cambiar en ese turno (de a 30 minutos).

Esto lo vamos a encadenar con la reserva de torneos del módulo anterior, porque los torneos siempre tendrán un tiempo fijo de reserva. Por ejemplo, los torneos de singles, por decir un número, en general se reserva una hora y media de cancha. No se puede saber exactamente cuánto será, pero siempre se reserva un tiempo fijo y, después, se va manejando, porque pueden pasar o tardar menos. Entonces, en alguna parte se tiene que poder configurar el tiempo fijo de reservas para los torneos. 

## ✅ Alquiler de profes
> ✅ **Aplicado (12/10/2026).** Si reserva un profe con su cuenta, el turno queda como turno de profe a su nombre; el staff también puede cargar un turno de profe eligiendo el profe. Cada profe tiene un color (se asigna solo y el admin lo cambia en Equipo) y sus turnos se ven con ese color en la planilla. Cuando esté "Editar perfil", el profe podrá elegirlo él mismo.


En el caso de los profes, cuando se reserve una cancha y el usuario que la reservó sea profe, esa cancha queda marcada como profe y con el nombre del profe. Lo único que cambiaría quizás en la planilla, a nivel visual, es el color para identificar quién es. Cada profe puede tener un color asociado en su perfil, algo estándar que solo él verá. Ese color aparecerá en la planilla. Básicamente, además de tener su propio color, la cancha queda como cancha de profe. 

## ✅ Mejora visual para los tipos de alquileres
> ✅ **Aplicado (12/10/2026).** En la planilla (escritorio y celular), Hoy y el detalle: estándar con el color del estado de pago, profe con el color del profe, torneo en azul con trofeo y los jugadores, y fijo con un ícono de repetición. El estado de pago se sigue viendo en todos. La leyenda de la planilla explica cada uno.

En resumen, algo tiene que distinguir visualmente las canchas que son de los profes, las que son alquileres estándar, las que son alquileres fijos y las que son torneos. 

## ✅ Valor del alquiler
> ✅ **Aplicado (12/10/2026).** El precio ya no se edita cancha por cancha: en Canchas → Precios hay una tarjeta por tipo de cancha (tenis, pádel, fútbol) con precio público, precio profe y seña. Cada turno guarda su valor al reservarse, así que cambiar los precios no altera turnos ya reservados.


Otra cosa. La cancha, el valor de la cancha para los profes es diferente del valor abierto al público, con lo cual tiene que haber un lugar donde se configure el valor de la cancha para el público y el valor de la cancha para los profes. 

Hoy en día la edición del precio de la cancha se está haciendo por cancha. Es como que yo voy a las canchas, pongo editar y ahí puedo editar el valor por hora. La verdad es que este no es un valor que una cancha salga más que otra. No existe esa problemática hoy en día; todas deben tener el mismo valor, así que hay que ajustar algo. Desde un solo lugar se debería poder editar el valor de la cancha y que quede para todas. 

Lo mismo, las canchas de los profes van a tener un valor. El alquiler de cancha para profe también se tiene que setear en algún lugar. 

## ✅ Notificaciones
> ✅ **Aplicado (12/10/2026).** Notificaciones ya no aparece en el menú y su ruta redirige a Hoy. Se vuelve a mostrar con `notifications: true` en `lib/features.ts`.


por ahora vamos a ocultar esta seccion, una vez en funcionamiento la v1 vamos a ver que notificaciones podemos agregar.

## ✅ Ajuste en "Nuevo turno"
> ✅ **Aplicado (12/10/2026).** En Hoy, "Nuevo turno" abre el mismo diálogo que la planilla (primera cancha, próxima franja libre) sin redirigir. Además, "Reservar" en los huecos libres abre el diálogo con esa cancha y ese horario.


Hoy en día, cuando estás en la parte del dashboard principal, que tienes como resumen del día y el botón “Nuevo turno”, al tocar ese botón te lleva a las reservas y tienes que volver a tocarlo, lo que implica un doble trabajo. Ambos botones “Nuevo turno” deberían funcionar igual, levantando el mismo modal. No debería ser una redirección;

## ✅ Valor de la caja harcode
> ✅ **Aplicado (12/10/2026).** Caja muestra lo cobrado de verdad en el día elegido (con flechas y selector de fecha): total, por método (efectivo, transferencia, otro) y la lista de movimientos con turno y quién cobró. El saldo a favor aplicado se muestra aparte porque no es plata nueva. Se sacó la tarjeta de kiosco.


El valor de la caja esta harcodeado parece. Deberia ya ser el real para podes probarlo bien

## Editar perfil

Tanto el operador, tanto el administrador como los profesores podrían cambiar su perfil. Es decir, podrían editar su perfil en algún lado: cambiar su nombre, si quisieran cambiar el mail, la contraseña. Por ahora eso. 

¿Y dónde vamos a guardar la imagen? Porque al final, si le vamos a agregar imagen al perfil de los usuarios, creé un bucket en Cloudflare para que puedas conectar y subir las imágenes de los usuarios, asociadas a ellos. 

Lo que necesites de Cloudflare me decis, el bucket se llama "court-reservation"
