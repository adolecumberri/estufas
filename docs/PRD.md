# PRD — Catálogo de productos y gestión comercial

**Versión:** 0.3  
**Estado:** Borrador actualizado para validación  
**Tipo:** Aplicación web adaptable  
**Base de datos:** PostgreSQL  
**Mercado:** Empresas y particulares  
**Moneda inicial:** Euro (pendiente de confirmar formalmente)  
**Idioma inicial:** Español (pendiente de confirmar formalmente)

## 1. Resumen ejecutivo

La aplicación permitirá publicar un catálogo de productos y gestionar clientes, comerciales, precios, descuentos y pedidos desde una plataforma web adaptable a ordenador, tableta y móvil.

Habrá un catálogo público, un área privada de clientes, un portal comercial y un área de administración.

La empresa venderá tanto a empresas como a particulares. Ambos utilizarán una misma tarifa base de productos. Las condiciones comerciales dependerán de los descuentos generales que configure el administrador y de los descuentos específicos que se apliquen a cada cliente o producto.

Los pedidos comenzarán como solicitudes pendientes de confirmación. Se conservarán los precios y descuentos aplicados al crearlas, aunque un comercial autorizado podrá añadir descuentos adicionales a productos concretos conforme a las reglas definidas en este documento.

Los impuestos no se mostrarán en las fichas del catálogo. Se mostrarán en la sección fiscal del documento de factura asociado al pedido, una vez definidos los requisitos de facturación.

## 2. Objetivos

1. Publicar un catálogo de productos con información comercial y técnica.
2. Permitir la gestión de varias familias de productos.
3. Gestionar clientes particulares y empresas.
4. Asignar comerciales responsables a los clientes que corresponda.
5. Mantener el historial de precios y descuentos.
6. Permitir crear, consultar, editar, cancelar y confirmar pedidos con permisos diferenciados.
7. Conservar el histórico comercial y la trazabilidad de los cambios.
8. Preparar el proyecto para un desarrollo modular y verificable mediante asistentes de programación con IA.

## 3. Usuarios y permisos

### 3.1. Visitante

Puede:
- Consultar productos publicados.
- Buscar y filtrar el catálogo.
- Consultar características técnicas, imágenes y precios públicos.
- Ver el precio público sin descuentos.

No puede consultar pedidos, condiciones comerciales privadas ni datos de clientes.

### 3.2. Cliente

Un cliente puede ser una empresa o un particular. El tipo de cliente no constituye por sí mismo un rol de acceso diferente.

Puede:
- Iniciar sesión.
- Consultar el catálogo y sus condiciones comerciales aplicables.
- Crear pedidos.
- Consultar sus propios pedidos.
- Editar o cancelar sus solicitudes mientras sigan en el estado permitido por las reglas de pedidos.
- Consultar el estado y el historial que tenga autorizado.

No puede:
- Modificar los descuentos por su cuenta.
- Consultar pedidos de otros clientes.
- Acceder a la cartera comercial de otros usuarios.
- Confirmar pedidos, salvo que se apruebe una excepción futura.

### 3.3. Comercial

Puede:
- Consultar sus clientes asignados.
- Consultar las condiciones comerciales de esos clientes.
- Crear pedidos en nombre de un cliente autorizado.
- Editar o cancelar solicitudes pendientes.
- Confirmar pedidos de su cartera cuando tenga autorización.
- Aplicar descuentos autorizados.
- Añadir descuentos adicionales a productos concretos de un pedido existente, con trazabilidad.
- Consultar el historial de pedidos y cambios comerciales de sus clientes.

No puede acceder automáticamente a todos los clientes ni modificar configuraciones globales sin autorización.

### 3.4. Administrador

Puede gestionar:
- Usuarios, roles y asignaciones comerciales.
- Productos, marcas, categorías y características.
- Precios e históricos.
- Descuentos generales de la tienda.
- Descuentos por cliente y producto.
- Pedidos y sus estados.
- Recursos e iconos.
- Auditoría y configuración general.

Los permisos deberán comprobarse en el backend. Ocultar botones en la interfaz no se considera una medida de autorización suficiente.

## 4. Catálogo de productos

### 4.1. Datos generales

Cada producto podrá contener:
- Identificador interno.
- Referencia comercial.
- Nombre.
- Descripción.
- Marca.
- Tipo de producto.
- Una o varias categorías.
- Imagen principal y, si se aprueba, galería de imágenes.
- Plano o esquema técnico.
- Clasificación energética cuando corresponda.
- Características técnicas.
- Precio público vigente.
- Estado de publicación.
- Fechas de creación y modificación.
- Información de borrado lógico.

La referencia comercial tendrá una regla de unicidad definida en el diseño técnico.

### 4.2. Familias y categorías

El catálogo comenzará con estufas y podrá incorporar productos de jardín, velas, cerillas y otras familias.

Categorías iniciales de estufas:
- Pellet.
- Leña.
- Aire.
- Insertable.
- Canalizada.
- Hidro.
- Fundición.
- Ventilada.
- Hogares.

Un producto podrá pertenecer a varias categorías.

El combustible podrá representarse como categoría o como atributo específico. La decisión se documentará en el diseño técnico para evitar duplicidades.

### 4.3. Características técnicas

Características generales iniciales:
- Potencia global.
- Potencia nominal.
- Rendimiento.
- Volumen calefactable.
- Medidas.
- Salida de humos.
- Capacidad de la tolva.
- Horario o programación.
- Peso.
- Medidas exteriores.

Características de estufas de leña:
- Aire primario.
- Horno.
- Ventilada.
- Aire secundario.
- Partes en fundición.
- Calefacción central.

Características de estufas de pellet:
- Encendido rápido.
- Canalización de aire caliente.
- Programable semanal y diariamente.
- Sistema de autolimpieza del quemador.
- Sistema de seguridad activa.
- Calefacción central.
- Protección con sobrecarga eléctrica.
- Válvula de anticondensados incluida.
- Easy Clean.
- Limpieza automática de tubuladores.
- Sistema de cristal limpio.
- Limpieza semiautomática de tubuladores.
- Brasero en fundición.
- Cámara de combustión refractaria.

Las características podrán configurarse por tipo de producto y tendrán, cuando corresponda, unidad de medida, tipo de dato, orden e icono SVG asociado.

### 4.4. Recursos

Las imágenes, planos técnicos e iconos SVG se gestionarán como recursos reutilizables. Las características podrán referenciar iconos mediante claves foráneas.

Los recursos deberán servirse de forma segura y no se ejecutará SVG arbitrario sin validación.

### 4.5. Búsqueda y publicación

El catálogo permitirá buscar por nombre y referencia y filtrar por marca, familia, categoría y características pertinentes.

Solo se mostrarán públicamente los productos publicados. La información privada no se incluirá en respuestas públicas de la API.

## 5. Clientes y asignación comercial

Se distinguirán:
- La cuenta de usuario utilizada para iniciar sesión.
- El cliente como entidad comercial.
- El tipo de cliente: empresa o particular.
- El comercial responsable, cuando exista.

Una empresa o un particular podrá comprar sin tener un comercial asignado.

La asignación de un comercial deberá validarse en el servidor. Las operaciones de asignación y reasignación deberán dejar trazabilidad cuando afecten a la gestión comercial.

Se deberá decidir si una entidad cliente puede tener varios usuarios de acceso. Hasta entonces, el diseño podrá contemplar una relación sencilla de un usuario por cliente sin impedir su futura ampliación.

## 6. Precios y descuentos

### 6.1. Tarifa base

Habrá una tarifa base común para empresas y particulares. No se crearán tarifas base distintas únicamente por el tipo de cliente.

El precio público de un producto será el precio base vigente, sin descuentos individuales.

Los precios tendrán historial de vigencia. No se sobrescribirán los precios antiguos cuando cambie el precio de un producto.

Los periodos de vigencia no podrán solaparse para la misma tarifa y producto.

### 6.2. Comportamiento según usuario

| Situación | Precio mostrado |
|---|---|
| Visitante sin sesión | Precio público sin descuentos |
| Cliente sin comercial asignado | Precio base, con posibles descuentos generales de tienda definidos por un administrador |
| Cliente con comercial asignado | Precio base con las condiciones comerciales autorizadas para ese cliente |
| Comercial | Precios y condiciones de sus clientes asignados |
| Administrador | Precios, tarifas y descuentos que esté autorizado a gestionar |

Los descuentos generales de tienda son promociones globales que configura un administrador. No deben confundirse con el descuento individual de un cliente.

La existencia de un comercial asignado no implica que un cliente tenga necesariamente un descuento: si no hay descuentos aplicables, se utilizará el precio base.

### 6.3. Prioridad de los descuentos

La regla acordada es que el descuento específico por cliente y producto sustituye al descuento general individual del cliente.

Orden de aplicación propuesto:
1. Determinar el precio base vigente.
2. Identificar los descuentos aplicables al cliente.
3. Si existe un descuento específico vigente para ese cliente y producto, utilizarlo en lugar del descuento general del cliente.
4. Si no existe un descuento específico, utilizar el descuento general individual del cliente, si corresponde.
5. Evaluar los descuentos generales de tienda configurados por el administrador según las reglas que se aprueben.
6. Calcular el importe final y guardar el desglose aplicado.

**Pendiente:** definir cómo interactúan los descuentos generales de tienda con los descuentos comerciales individuales. No se asumirá que se acumulan automáticamente.

Un descuento específico del 0 % se tratará como una excepción válida que sustituye al descuento general individual, salvo que se decida otra regla.

### 6.4. Descuentos sin comercial

Los clientes sin comercial asignado:
- No tendrán descuentos individuales por cliente o producto por defecto.
- Podrán beneficiarse de descuentos generales de tienda configurados por un administrador.
- No podrán asignarse descuentos a sí mismos.

### 6.5. Descuentos adicionales en pedidos existentes

Un comercial autorizado podrá añadir un descuento adicional a uno o varios productos de un pedido ya creado.

La aplicación deberá:
- Registrar el descuento original.
- Registrar el descuento adicional aplicado y el resultado.
- Guardar el usuario que realizó el cambio y la fecha.
- Conservar el precio y el descuento anteriores en el historial de modificaciones.
- Recalcular los importes afectados de forma consistente.
- Evitar que el cambio altere otros pedidos.

Como regla provisional, los descuentos adicionales se permitirán mientras el pedido no esté confirmado. Permitir cambios después de la confirmación requerirá una decisión específica.

### 6.6. Importes y precisión

Los importes y porcentajes se almacenarán con tipos decimales adecuados, como `NUMERIC` en PostgreSQL.

No se utilizarán tipos de coma flotante binaria para cálculos monetarios.

La fórmula básica será:

`Precio neto = Precio base × (1 − descuento / 100)`

La fórmula final deberá considerar la prioridad de descuentos y las reglas fiscales aprobadas.

## 7. Impuestos y factura

Los impuestos no aparecerán en las fichas del catálogo ni junto a los precios de los productos públicos.

Cada pedido deberá disponer de la información necesaria para mostrar una sección fiscal en su documento de factura asociado.

La sección fiscal podrá contener, según las reglas que se definan:
- Base imponible.
- Tipo impositivo.
- Cuota de impuesto.
- Totales.
- Importe final.

La lógica fiscal deberá implementarse en el backend y conservar los datos históricos necesarios para reproducir los importes de un pedido.

**Pendiente:** confirmar si la aplicación generará facturas legales completas o si solo mostrará un resumen fiscal del pedido o un documento previo a la facturación. Hasta aclararlo, el término “factura” no implica que exista ya un módulo fiscal completo.

También quedan pendientes los tipos impositivos, el tratamiento de descuentos en la base imponible, el redondeo, los posibles portes y las reglas aplicables a ventas nacionales e internacionales.

## 8. Pedidos

### 8.1. Creación

Los pedidos podrán ser creados por:
- Clientes desde su área privada.
- Comerciales en nombre de clientes autorizados.
- Administradores, si se habilita esa función.

Los pedidos comenzarán en estado `solicitado`.

La creación guardará:
- Cliente comprador.
- Usuario creador.
- Comercial responsable, cuando corresponda.
- Fecha de creación.
- Líneas del pedido.
- Precios y descuentos aplicados.
- Totales calculados.
- Estado inicial.
- Registro de historial.

Los pedidos registrados por un comercial en nombre de un cliente también comenzarán como solicitados, salvo que se apruebe una excepción.

### 8.2. Congelación de precios

Al crear la solicitud, el sistema guardará una instantánea del precio y descuento de cada línea.

Al confirmar el pedido, esos importes se mantendrán, excepto los cambios expresamente autorizados y registrados en el historial, como descuentos adicionales introducidos por un comercial antes de la confirmación.

No se recalcularán silenciosamente los importes de solicitudes ya creadas por cambios posteriores en el catálogo.

### 8.3. Estados

Estados iniciales:
- Solicitado.
- Confirmado.
- En preparación.
- Completado.
- Cancelado.

Flujo principal:

`Solicitado → Confirmado → En preparación → Completado`

La cancelación dependerá del estado y los permisos. No se permitirá cambiar libremente cualquier pedido a cualquier estado.

### 8.4. Confirmación

Solo el comercial responsable o un administrador autorizado podrán confirmar un pedido.

La confirmación deberá:
- Validar el estado actual.
- Comprobar los permisos.
- Guardar quién confirmó y cuándo.
- Registrar el cambio en el historial.
- Mantener los importes acordados y las modificaciones autorizadas.

### 8.5. Edición y cancelación

El cliente, el comercial autorizado o el administrador podrán editar o cancelar solicitudes pendientes, con las siguientes restricciones:
- El cliente solo podrá actuar sobre sus pedidos.
- El comercial solo podrá actuar sobre pedidos de clientes autorizados.
- El administrador podrá actuar según sus permisos.
- Cada cambio relevante deberá registrarse.
- La edición no deberá borrar el historial previo.

Las reglas para editar o cancelar pedidos ya confirmados quedan pendientes.

### 8.6. Líneas de pedido

Cada línea conservará:
- Referencia y nombre históricos del producto.
- Cantidad.
- Precio unitario.
- Descuento aplicado.
- Base imponible e impuestos, cuando corresponda.
- Total calculado.

Los importes enviados por el navegador nunca se considerarán fiables sin validación del backend.

### 8.7. Transacciones

La creación del pedido, las líneas y el historial inicial se guardarán dentro de una transacción de PostgreSQL. Los cambios de descuento deberán actualizar los importes relacionados de forma atómica.

## 9. Administración

El administrador podrá gestionar productos, categorías, características, marcas, recursos, usuarios, asignaciones comerciales, precios, descuentos y pedidos.

También podrá configurar los descuentos generales de tienda y consultar los registros de auditoría.

Las acciones sensibles deberán tener permisos específicos y trazabilidad.

## 10. Requisitos técnicos y seguridad

### 10.1. Arquitectura

La arquitectura deberá separar:
- Frontend web adaptable.
- Backend o API con reglas de negocio.
- PostgreSQL.
- Almacenamiento de imágenes y recursos, si se requiere.

La tecnología de frontend y backend está pendiente de decisión.

El frontend no se conectará directamente a PostgreSQL con credenciales privilegiadas.

### 10.2. PostgreSQL

El diseño deberá incluir:
- Claves primarias y foráneas.
- Restricciones `CHECK`.
- Índices para consultas frecuentes.
- Historial de precios.
- Historial de pedidos y descuentos.
- Borrado lógico en las entidades correspondientes.
- Transacciones para operaciones comerciales.
- Migraciones versionadas.

El esquema SQL existente será el punto de partida, pero deberá revisarse frente a este PRD antes de considerarlo definitivo.

### 10.3. Autorización

El backend deberá comprobar:
- Identidad del usuario.
- Rol.
- Relación con el cliente.
- Asignación comercial.
- Permiso para consultar o modificar el recurso.
- Estado del pedido y transición solicitada.

No se confiará en los identificadores, precios, descuentos o permisos enviados por el navegador.

### 10.4. Borrado lógico y auditoría

Los registros históricos se conservarán mediante borrado lógico cuando corresponda. Las operaciones de usuario no eliminarán físicamente datos comerciales históricos.

La auditoría deberá permitir identificar quién creó o modificó un pedido, quién aplicó descuentos y quién cambió estados o asignaciones.

### 10.5. Adaptabilidad y mantenimiento

La aplicación deberá funcionar en ordenador, tableta y móvil. Se mantendrán pruebas automatizadas, documentación de instalación, migraciones versionadas y una política de copias de seguridad y recuperación.

## 11. Requisitos para desarrollo asistido por IA

El PRD será la referencia funcional principal para las herramientas de programación.

Los asistentes deberán:
- Leer la documentación antes de modificar el proyecto.
- No inventar reglas de negocio pendientes.
- Identificar supuestos explícitamente.
- No ejecutar cambios destructivos sin aprobación.
- Mantener coherencia entre backend, interfaz y base de datos.
- Añadir pruebas a cada funcionalidad.
- Actualizar la documentación al cambiar reglas.
- Conservar los históricos comerciales.
- Validar permisos en el servidor.
- No considerar terminada una tarea hasta superar sus criterios de aceptación.

Cada tarea de desarrollo incluirá objetivo, requisitos relacionados, cambios de datos, permisos, validaciones, pruebas y criterios de aceptación.

## 12. Plan de entregas

### Fase 1 — Fundamentos
- Stack y arquitectura.
- Entornos y repositorio.
- Migraciones de PostgreSQL.
- Autenticación, roles y permisos.
- Usuarios y clientes.

### Fase 2 — Catálogo
- Familias, marcas y categorías.
- Productos, recursos y características.
- Fichas públicas.
- Búsqueda y filtros.

### Fase 3 — Precios y descuentos
- Tarifa base.
- Historial de precios.
- Descuentos generales de tienda.
- Descuentos individuales.
- Descuentos específicos por producto.
- Historial de modificaciones comerciales.

### Fase 4 — Portal privado
- Cartera comercial.
- Área de clientes.
- Permisos y condiciones comerciales.
- Consulta de precios aplicables.

### Fase 5 — Pedidos
- Creación de solicitudes.
- Edición y cancelación.
- Confirmación.
- Descuentos adicionales por comercial.
- Estados e historial.
- Resumen fiscal y definición del alcance de facturación.

### Fase 6 — Preparación para producción
- Pruebas de seguridad.
- Pruebas de regresión.
- Copias de seguridad.
- Supervisión y registros.
- Documentación de despliegue.

## 13. Criterios de aceptación del MVP

- Los visitantes ven los precios públicos sin descuentos.
- Empresas y particulares pueden registrarse como clientes.
- Los clientes sin comercial solo reciben descuentos individuales si se les asignan expresamente; los descuentos generales de tienda se rigen por la configuración del administrador.
- Los descuentos específicos por cliente y producto sustituyen al descuento general individual.
- Los precios y descuentos se guardan al crear la solicitud.
- Los comerciales autorizados pueden añadir descuentos a productos de solicitudes existentes con trazabilidad.
- Los pedidos comienzan como solicitados.
- Solo el comercial responsable o el administrador autorizado puede confirmar pedidos.
- Los clientes pueden editar o cancelar solicitudes pendientes propias.
- Los cambios de precios no alteran los pedidos históricos.
- Los impuestos no aparecen en las fichas de producto.
- Las acciones sensibles quedan registradas.
- Los permisos se verifican en el backend.
- No existe gestión de stock en el MVP.
- Las pruebas funcionales y de autorización esenciales pasan.

## 14. Decisiones pendientes

### Prioridad alta

1. ¿Los descuentos generales de tienda se acumulan con los descuentos individuales o tienen prioridad propia?
2. ¿Puede un comercial añadir descuentos únicamente antes de la confirmación o también después?
3. ¿Qué límites de descuento tendrá cada comercial?
4. ¿Qué tipos impositivos y reglas fiscales deben aplicarse?
5. ¿La aplicación generará facturas legales o solo un resumen fiscal o documento previo?
6. ¿Qué información fiscal y de facturación debe guardarse en cada pedido?
7. ¿Se permite editar o cancelar un pedido después de confirmarlo?

### Prioridad media

8. ¿Un cliente podrá tener varias cuentas de usuario?
9. ¿Se necesitarán direcciones de facturación y entrega distintas?
10. ¿Se permitirán pedidos con productos descatalogados?
11. ¿Se necesitan mínimos de pedido, portes o múltiplos de embalaje?
12. ¿Se requiere importar productos desde Excel o CSV?
13. ¿Se necesitarán varios idiomas?
14. ¿Se enviarán notificaciones por email?

### Prioridad técnica

15. ¿Qué frontend y backend se utilizarán?
16. ¿Dónde se alojará la aplicación?
17. ¿Qué sistema de autenticación se utilizará?
18. ¿Dónde se almacenarán las imágenes y los planos?
19. ¿Qué volumen de productos, clientes y pedidos se espera?
20. ¿Qué objetivos de copias de seguridad y recuperación se requieren?

## 15. Supuestos vigentes

- El catálogo público no requiere autenticación.
- La tarifa base es común para empresas y particulares.
- El visitante ve el precio público sin descuentos.
- El cliente sin comercial no tiene descuentos individuales por defecto, pero puede beneficiarse de promociones generales de tienda configuradas por el administrador.
- El descuento específico por cliente y producto sustituye al descuento general individual.
- Los pedidos comienzan en estado solicitado.
- El precio y el descuento se guardan al crear la solicitud.
- Los cambios comerciales posteriores deben dejar trazabilidad.
- Los impuestos no aparecen en las fichas del catálogo.
- No se gestionará stock en el MVP.
- La aplicación utilizará PostgreSQL.
- La aplicación inicial será web y adaptable.
- Los detalles fiscales, el stack y las reglas comerciales pendientes no se consideran aprobados.

## 16. Definición de terminado

El MVP estará listo para validación cuando el catálogo, las cuentas, los permisos, los precios, los descuentos y los pedidos funcionen conforme a este documento; los cambios comerciales estén auditados; las reglas de acceso se prueben en el servidor; las migraciones sean reproducibles; y exista documentación de instalación, configuración, pruebas y despliegue.

**Fin del PRD v0.3.**
