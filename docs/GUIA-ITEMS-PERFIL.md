# Guía: los items del perfil (avatares, banners, marcos, títulos e insignias)

Para el equipo de Holistic. Explica **qué se puede personalizar en el perfil de
un socio y como lo cargan ustedes mismos desde el panel**, con los datos que
pide cada tipo.

---

## 1. Los cinco tipos de item

| Tipo | Dónde se ve | Qué es |
|---|---|---|
| **Avatar** | la foto redonda del perfil | un emoji sobre un color de fondo (si el socio sube una foto propia, la foto gana) |
| **Marco** | el borde de esa foto | un borde de color, con brillo opcional y opcion de que "lata" |
| **Banner** | la franja grande de arriba del perfil | un fondo **animado** (partículas, lluvia, aurora…) con dos colores |
| **Título** | debajo del nombre | una palabra de color: "Pro", "Leyenda"… |
| **Insignia** | al lado del nombre | un emoji chiquito con efecto; se pueden llevar hasta 4 |

Todos viven en la misma lista: el socio los consigue en **Perfil →
Personalizar → Tienda** y los equipa en **Perfil → Personalizar → Perfil**.

---

## 2. Los cargan ustedes, sin pedirnos nada

Desde el panel de administración:

> **Panel admin → pestaña "🎨 Perfil" → "+ Nuevo item"**

Sirve para **los cinco tipos**. El formulario cambia según lo que elijas (un
banner pide efecto y dos colores; un marco pide color de borde y brillo; un
avatar pide emoji y fondo) y tiene **vista previa en vivo**: ves el item
terminado —el banner incluso animado, igual que se va a ver en el perfil—
antes de guardar.

Desde la misma pantalla podés **editar**, **ocultar/mostrar** y **borrar**, y
ver **cuánta gente tiene cada item**.

> Las insignias también se pueden crear desde **Perfil → Personalizar → Studio
> → "⚡ Crear Badge"**. Es el camino viejo y sigue funcionando; el del panel es
> más completo.

## 3. Lo que hay que decidir en cada item

**Nombre y descripción.** Cortos. Es lo que lee el socio en la tienda.
Ej: *"Verde Holistic" — "El banner de la casa"*.

**Costo en puntos.** Cuántos puntos cuesta. **`0` = gratis**: aparece en la
tienda y cualquiera lo obtiene con un clic, sin gastar.

**Rareza.** Sólo cambia el color del cartelito y el orden visual. Cuatro
valores: `common` · `rare` · `epic` · `legendary`.

**Colores.** En código hexadecimal. La paleta de la marca es:

| | |
|---|---|
| Verde menta (principal) | `#A7F5C8` |
| Verde fuerte (acción) | `#25D366` |
| Fondo | `#06070A` |

> ⚠️ **Los banners y marcos que vinieron de fábrica usan amarillo `#f5e03a` y
> naranja `#ff6200`**, que son de la plantilla original y **no** son los colores
> de Holistic. Si los quieren usar, hay que repintarlos — díganlo y los pasamos
> a la paleta de la marca.

---

## 4. Los datos de cada tipo

Esto es lo que pide el formulario. Sirve también como plantilla para pedirle
los diseños a quien los haga.

### Para un **banner**

```
Tipo:        banner
Nombre:      Verde Holistic
Descripción: El banner de la casa
Efecto:      stars            ← de la lista de abajo
Color 1:     #A7F5C8
Color 2:     #25D366
Costo:       0
Rareza:      common
```

**Los 12 efectos disponibles** (no se pueden inventar otros sin desarrollo):

| Efecto | Qué se ve | Peso |
|---|---|---|
| `stars` | estrellas que flotan y titilan | liviano |
| `snow` | nieve cayendo | liviano |
| `lemon_rain` | monedas cayendo | liviano |
| `matrix` | caracteres cayendo, estilo hacker | liviano |
| `rainbow` | puntos de colores que cambian | liviano |
| `lightning` | rayos sobre el fondo | medio |
| `vortex` | partículas girando en espiral | medio |
| `fire` | llamas subiendo | medio |
| `cyber` | grilla con barridos de luz | medio |
| `aurora` | aurora boreal difusa | **pesado** |
| `pulse` | ondas que laten desde cada punto | **pesado** |
| `ocean` | olas onduladas | **pesado** |

> **Sobre el peso:** los tres pesados dibujan un degradado del tamaño de la
> pantalla por cada partícula. Ya están optimizados (en celular usan menos
> partículas, van a 30 cuadros por segundo y se frenan solos cuando el banner
> no se ve), pero si el banner va a ser el de todos, **conviene uno liviano**.
> El de la casa usa `stars` justamente por eso.

### Para un **marco**

```
Tipo:        frame
Nombre:      Marco Holistic
Descripción: El marco de la casa
Borde:       color #A7F5C8
Brillo:      sí     (o no)
Late:        no     (el borde pulsa — dejalo para los caros)
Costo:       0
Rareza:      common
```

### Para un **avatar**

```
Tipo:        avatar
Nombre:      Brote
Descripción: Para los que recién arrancan
Emoji:       🌱
Color fondo: #A7F5C8
Costo:       0
Rareza:      common
```

### Para un **título**

```
Tipo:        title
Nombre:      Cultivador
Color:       #A7F5C8
Costo:       300
Rareza:      rare
```

---

## 5. Cómo está la tienda hoy

Quedaron visibles **sólo los items gratuitos**. Los pagos siguen cargados pero
ocultos: se vuelven a mostrar cuando ustedes lo pidan, sin rehacer nada.

Hoy hay: 1 avatar, 5 insignias, **1 banner y 1 marco** (los dos con los colores
de la marca, gratis).

---

## 6. Tres cosas que conviene saber

1. **Un item se puede ocultar, no hace falta borrarlo.** Sacarlo de la tienda no
   se lo quita a quien ya lo tenía… salvo que alguien lo haya comprado: en ese
   caso, ocultarlo también le impide equiparlo. **Antes de ocultar algo pago,
   avisen** y verificamos si alguien lo compró.
2. **Cambiar el precio no devuelve puntos** a quien ya lo compró. Si van a
   bajar un precio mucho, decidan primero qué hacer con los que pagaron de más.
3. **El nombre interno de un item no se cambia nunca** una vez creado: es lo que
   ata el item a la gente que lo tiene. El nombre visible sí se puede cambiar
   cuando quieran.

---

*Si algo de esto se queda corto para lo que quieren hacer, díganlo: varias de
estas limitaciones se pueden levantar con desarrollo — por ejemplo, subir
imágenes propias como banner, que hoy no se puede.*
