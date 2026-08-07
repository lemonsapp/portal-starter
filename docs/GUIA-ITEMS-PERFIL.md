# Guía: los items del perfil (avatares, banners, marcos, títulos e insignias)

Para el equipo de Holistic. Explica **qué se puede personalizar en el perfil de
un socio, qué pueden crear ustedes solos y qué hay que pedirnos**, y con qué
datos exactos pedirlo para que salga a la primera.

---

## 1. Los cinco tipos de item

| Tipo | Dónde se ve | Qué es |
|---|---|---|
| **Avatar** | la foto redonda del perfil | un emoji sobre un color de fondo (si el socio sube una foto propia, la foto gana) |
| **Marco** | el borde de esa foto | un borde de color, con brillo o degradado |
| **Banner** | la franja grande de arriba del perfil | un fondo **animado** (partículas, lluvia, aurora…) con dos colores |
| **Título** | debajo del nombre | una palabra de color: "Pro", "Leyenda"… |
| **Insignia** | al lado del nombre | un emoji chiquito con efecto; se pueden llevar hasta 4 |

Todos viven en la misma lista: el socio los consigue en **Perfil →
Personalizar → Tienda** y los equipa en **Perfil → Personalizar → Perfil**.

---

## 2. Qué pueden crear ustedes, hoy, sin pedirnos nada

### Insignias ✅

Hay un creador dentro del portal. Con la cuenta de administrador:

> **Perfil → Personalizar → Studio → pestaña "⚡ Crear Badge"**

Ahí eligen nombre, descripción, emoji, color, efecto, rareza y costo, y la
insignia queda creada y disponible al instante. Es la única que es
autoservicio.

### Banners, marcos, avatares y títulos ⏳

Hoy **no tienen pantalla para crearlos**: se cargan del lado del sistema.
Pídanlos con el formato de la sección 4 y los dejamos andando.

> Si esto les va a pasar seguido, se puede construir una pantalla de
> administración para los cinco tipos. Es trabajo aparte: avísennos y lo
> presupuestamos.

---

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

## 4. Qué mandarnos para pedir uno nuevo

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
Borde:       2px sólido, color #A7F5C8
Brillo:      sí, verde menta suave     (o "no")
Degradado:   no                        (o los colores, ej: menta → verde)
Late:        no                        (el borde puede pulsar, tipo "premium")
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

*¿Dudas o quieren pedir varios de una? Manden la lista con el formato de la
sección 4 y los cargamos juntos.*
