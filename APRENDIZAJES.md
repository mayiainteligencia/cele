# APRENDIZAJES — Bitácora de data engineering

Bitácora personal de aprendizaje sobre **Cerebro Electoral**. No es el estado
del sistema (eso está en [CONTEXTO.md](CONTEXTO.md)) ni el criterio de
arquitectura ([ARQUITECTURA.md](ARQUITECTURA.md)). Aquí queda **el concepto
detrás de cada cosa que resolvimos**, con su nombre de industria, la
herramienta exacta que se usó y cómo se usó.

Orden: más reciente arriba.

---

## 2026-08-21 — El dato estaba bien; el que mentía era el render

**El problema real:** Las capas de distrito se veían **aplanadas** contra el
mapa oficial del INE. Entrantes de la costa que en la referencia existen, en
nuestro mapa no.

La sospecha inmediata era el pipeline: en la Fase 1 habíamos reducido de 555 a
26 peticiones asumiendo que el polígono de un distrito es idéntico se pida
desde la sección que se pida — y eso se había verificado comparando **dos**
secciones. Con esa base, "hay que rehacer el pipeline" parecía lo probable.

Era falso. El pipeline estaba bien y el problema vivía tres capas más abajo, en
el navegador.

**La solución aplicada:** Verificar por capas, de la fuente hacia la pantalla,
en vez de creer la primera hipótesis. Tres cortes:

1. **¿Deduplica de más?** Amplié la comprobación a 19 secciones cruzando 4
   municipios. MD5 idéntico siempre — incluido el caso decisivo: el mismo
   distrito local consultado desde Campeche y desde Tenabo devuelve el mismo
   polígono byte por byte. Las 26 peticiones se sostienen.
2. **¿El redondeo a 6 decimales borra vértices?** No: 1 955 en el distrito
   federal 1, tanto en la respuesta de la API como en el archivo guardado.
3. **¿Y el render?** Ahí estaba.

`smoothFactor` en Leaflet vale **1.0 por defecto** y aplica Douglas-Peucker
sobre cada trazo al dibujarlo, con tolerancia de ~1 píxel. Nuestras capas nunca
lo fijaron. Medido contando los puntos del atributo `d` del SVG, en Ciudad del
Carmen a zoom 11:

| smoothFactor | puntos dibujados |
|---|---|
| 1.0 (heredado) | **773** |
| 0.4 (corregido) | **2 606** |

**El 70 % del detalle se descartaba en el navegador**, sobre datos que en disco
estaban completos.

**Tecnología y librerías usadas:**

- **`hashlib`/`crypto` MD5 sobre la geometría serializada** — la comparación
  que decide si dos respuestas son el mismo polígono. Barato y exacto: no hay
  que comparar coordenada por coordenada ni tolerar epsilon.
- **`getAttribute('d').split(/[ML]/)`** — contar los comandos de trazo del SVG
  es la única forma de medir lo que Leaflet **realmente dibujó**, no lo que le
  dimos. La diferencia entre ambos números es justo el bug.
- **Chrome headless (`--dump-dom`, `--screenshot`)** — el navegador real como
  instrumento de medición, no sólo de inspección visual.

**El proceso paso a paso:**

1. Contar vértices en los dos extremos de la tubería
   ([build_ine_cartografia.py:359](backend/datalab/pipeline/build_ine_cartografia.py#L359)):

```js
const cuenta=(g)=>{let n=0;const w=(a)=>Array.isArray(a[0])?a.forEach(w):n++;w(g.coordinates);return n;};
// CRUDO de la API:     federal distrito 1 · 1955 vértices
// LO QUE GUARDAMOS:    distrito 1 solo:     1955 vértices
```

Idénticos. Eso elimina de un golpe el pipeline entero como sospechoso — el
redondeo, la deduplicación y la consolidación quedan descartados sin tener que
auditarlos uno por uno.

2. Medir lo que el navegador dibuja, no lo que recibe:

```js
document.querySelectorAll('#'+id+' path').forEach(p=>{
  n += (p.getAttribute('d')||'').split(/[ML]/).length - 1;
});
```

3. La corrección, con el porqué al lado
   ([mapa.js:557](frontend/js/mapa.js#L557)):

```js
// Leaflet simplifica cada trazo al dibujarlo (Douglas-Peucker) y su
// `smoothFactor` por defecto es 1.0 ≈ 1 px de tolerancia. Sobre una
// costa como la de Campeche eso recorta entrantes visibles y el
// distrito se ve aplanado contra el mapa oficial del INE — aunque el
// dato guardado tenga los 1 955 vértices exactos que da la API.
smoothFactor: 0.4,
```

**El concepto con nombre:** **Rendering-time simplification** — la
simplificación que ocurre en la capa de presentación, después de que el dato
salió correcto del almacén. Su parentela conceptual es la **lossy
transformation** silenciosa: nadie la pidió, nadie la registró, y no deja
rastro en los datos.

El patrón de diagnóstico tiene nombre propio: **binary search sobre la
tubería**. En vez de auditar el pipeline de principio a fin, se mide en dos
puntos —entrada y salida— y se descarta medio sistema por comparación. Si los
extremos coinciden, el problema está fuera de lo que hay entre ellos.

La analogía: un plano impreso que sale con las curvas suavizadas. Puedes
revisar el archivo CAD veinte veces —y estará bien— porque el que simplificó
fue el driver de la impresora.

**Por qué esta tecnología y no otra:**

- **¿Por qué contar puntos del SVG y no comparar capturas de pantalla?** Dos
  imágenes distintas no te dicen *cuánto* se perdió ni *dónde*. `773 → 2 606`
  es una magnitud que se puede citar, discutir y volver a medir; "se ve mejor"
  no lo es.
- **¿Por qué MD5 y no comparar coordenadas?** Porque la pregunta era binaria
  —¿es el mismo polígono o no?— y un hash la responde sin decidir arbitrariamente
  cuánta diferencia es "la misma".
- **¿Por qué 0.4 y no 0?** `smoothFactor: 0` desactiva la simplificación por
  completo y en un MultiPolygon de 18 000 vértices eso se paga en cada zoom.
  0.4 conserva el detalle visible y deja la optimización que sí sirve.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **rehacer el pipeline sin deduplicar** — 555 peticiones en
vez de 26. Era la hipótesis de partida y había un argumento razonable a favor:
la verificación original sólo comparaba dos secciones. Se descartó porque
ampliar la verificación cuesta 19 peticiones y decide la cuestión, mientras que
rehacer el pipeline cuesta un día y **no habría arreglado nada** — el aplanamiento
habría seguido igual, ahora con 555 peticiones.

Ésa es la lección transferible: **antes de reconstruir por sospecha, mide para
confirmar la sospecha.** El coste de medir casi siempre es una fracción del
coste de reconstruir, y a veces —como aquí— la medición manda a buscar a otro
sitio.

**Cómo lo dirías en una entrevista:**
> "Unas capas de mapa se veían simplificadas contra la referencia oficial y la
> hipótesis inicial era que nuestro pipeline perdía precisión al deduplicar
> peticiones. Antes de rehacerlo conté vértices en los dos extremos de la
> tubería: la API daba 1 955 y el archivo guardado tenía 1 955, así que el
> pipeline entero quedaba descartado sin auditarlo. Medí entonces lo que el
> navegador realmente dibujaba, contando los comandos del path SVG, y ahí
> estaba: Leaflet aplica Douglas-Peucker al renderizar con una tolerancia por
> defecto de un píxel, y descartaba el 70 % de los puntos. La corrección fue un
> parámetro. Lo que me llevo es que medir en los extremos descarta medio
> sistema más rápido que auditarlo entero."

---

## 2026-08-21 — Tres formas de no tener un dato, y por qué hay que distinguirlas

**El problema real:** Había que colorear las capas de distrito según el partido
dominante. Tres capas, y cada una llegó a una situación distinta:

- **Local (21):** el dato existe y está verificado.
- **Federal (2):** el dato **no existe** en el repositorio.
- **Judicial (1):** la pregunta **no aplica** — los cargos judiciales de
  elección popular no llevan partido en la boleta.

La tentación fácil era tratar las tres como "pinta lo que puedas". La federal
era la peligrosa: tenemos los 21 archivos de diputaciones y tenemos el catálogo
que dice qué sección cae en qué distrito federal. Agregar una cosa por la otra
produce un número, y ese número **parece un resultado electoral**.

No lo es. Los 21 archivos son de diputaciones **locales** —lo dice su propio
encabezado— y una diputación federal es otra boleta, otras candidaturas y otra
autoridad. El agregado sería un resultado de una elección que nunca ocurrió.

**La solución aplicada:** Codificar los tres estados como tres cosas distintas,
en el dato y en la pantalla:

| estado | en la ficha | en el mapa |
|---|---|---|
| hay dato | ganador, votos, %, margen | teñido del color del partido |
| falta el dato | «sin dato en el repositorio» | sin teñir |
| no aplica | «Partido: no aplica» | sin teñir, y se explica por qué |

**Tecnología y librerías usadas:**

- **`grep -ril` sobre todo el repositorio** — la comprobación negativa. Buscar
  "diputaciones federales", "Congreso de la Unión", "Cámara de Diputados" y no
  encontrar nada es lo que convierte "creo que no lo tenemos" en un hecho.
- **`openpyxl` leyendo la fila 0** — el encabezado del propio archivo como
  fuente de verdad sobre qué elección contiene, en vez de deducirlo de que
  21 archivos coinciden con 21 distritos.
- **Un gancho con contrato de tres valores** (token / `null` / no llamar) en
  vez de un booleano.

**El proceso paso a paso:**

1. Preguntarle al archivo qué es, en vez de inferirlo:

```python
t = next(ws.iter_rows(max_row=1, values_only=True))[0]
# "RESULTADOS A NIVEL SECCIÓN DE LA ELECCIÓN DE DIPUTACIONES LOCALES
#  POR EL PRINCIPIO DE MAYORÍA RELATIVA"   ← idéntico en los 21
```

El 21 = 21 era una coincidencia sugerente, no una prueba. El encabezado sí lo es.

2. El gancho, con `null` significando algo concreto
   ([mapa.js:533](frontend/js/mapa.js#L533)):

```js
const teñir = (f) => {
  if (!cfg.colorFeature) return null;
  const tok = cfg.colorFeature(f.properties || {}, capa.id);
  return tok ? token(tok) : null;
};
```

`null` es **"no hay color que corresponda"**, y la capa se queda con su trazo
normal. No existe un color por defecto al que caer: un default aquí sería
inventar una respuesta.

3. Y quien decide es quien sabe
   ([cartografia.html:452](frontend/cartografia.html#L452)):

```js
colorFeature: (props, capaId) => {
  if (capaId !== 'distritos_locales') return null;
  const g = ganadorLocal[props.numero];
  return g ? Electoral.color(g.ganador) : null;
},
```

`mapa.js` no sabe qué es un partido y no tiene por qué. Recibe un token o nada.

**El concepto con nombre:** **Null object anti-pattern, invertido.** El patrón
clásico dice: en vez de devolver `null`, devuelve un objeto neutro para que el
consumidor no tenga que comprobar. Aquí eso sería exactamente el error — un
"color neutro" es una afirmación visual sobre un territorio, y el consumidor
**sí** debe distinguir.

Debajo hay algo más general: la diferencia entre **missing data** y **not
applicable**, que en estadística se distingue desde siempre (SPSS separa
*system missing* de *user missing*; SQL discute desde los ochenta si `NULL`
debería ser dos marcadores distintos). Un distrito federal sin resultado es un
hueco que se puede llenar. Un distrito judicial sin partido **no tiene hueco**:
la pregunta no se le hace a esa demarcación.

La analogía: un formulario médico. "Fecha de última menstruación: N/A" en un
paciente varón no es un campo pendiente de llenar. Tratarlo como dato faltante
genera un recordatorio eterno para conseguir algo que no existe.

**Por qué esta tecnología y no otra:**

- **¿Por qué un gancho y no que `mapa.js` importe los resultados?** Porque el
  mapa se usa en tres páginas y sólo una habla de partidos. La dependencia
  invertida —el mapa expone un punto de extensión, el módulo lo llena— deja al
  mapa reutilizable y a los datos electorales en un solo sitio.
- **¿Por qué `null` y no `undefined` o `false`?** `null` es "hay respuesta y es
  vacía", que es exactamente el caso. `false` invitaría a interpretarlo como
  "no colorear por ahora"; `null` no invita a nada.
- **¿Por qué no una capa "federal estimada"?** Se consideró y se descartó rápido.
  Una capa marcada como estimación seguiría produciendo un mapa donde alguien
  lee "el partido X domina el distrito federal 1" — y esa frase no tiene
  referente real. La estimación es legítima cuando estimas **algo que existe**.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa concreta era **agregar los resultados locales por distrito
federal**. Técnicamente trivial: el catálogo del INE da la correspondencia
sección → distrito federal, y los resultados están por sección. Media hora.

Se descartó porque el producto de esa media hora es un artefacto que **miente
por construcción**: tiene la forma de un resultado electoral, se dibuja como un
resultado electoral, y no corresponde a ninguna elección celebrada. El coste de
producirlo era bajo; el coste de que alguien lo cite en una reunión es alto y
recae sobre quien confió en el mapa.

La segunda alternativa era **ocultar la capa federal** mientras no haya dato.
Se descartó porque esconder no es lo mismo que declarar: la capa apagada no le
dice a nadie que falta el cómputo del INE. Visible y explícitamente vacía es lo
que convierte un hueco en una tarea.

**Cómo lo dirías en una entrevista:**
> "Tenía que colorear tres capas de distrito por partido dominante y cada una
> llegó a un estado distinto: en una el dato existía, en otra faltaba y en la
> tercera la pregunta no aplicaba, porque los cargos judiciales de elección
> popular no llevan partido en la boleta. La trampa estaba en la que faltaba:
> podía agregar los resultados locales por distrito federal y producir un
> número, pero habría sido el resultado de una elección que no se celebró.
> Lo verifiqué leyendo el encabezado de los archivos en vez de deducirlo, y
> declaré la capa bloqueada. En el código lo resolví con un gancho que devuelve
> un color o `null`, donde `null` significa 'no hay color que corresponda' y no
> existe un default al que caer — un color por defecto ahí habría sido una
> afirmación sobre un territorio."

---

## 2026-08-19 — La página que documenta el sistema se genera del sistema

**El problema real:** `fuentes.html` es la página que declara de dónde viene
cada dato. Es la que valida el resto: si el sistema afirma que sus cifras son
trazables, ahí es donde se comprueba.

En la auditoría de conjunto resultó ser **la pieza más desfasada de todas**.
Citaba **un solo archivo** —`data/mock/territorio.json`, muerto desde hacía
cinco fases— mientras el sistema servía veinticuatro.

No fue descuido de nadie en particular. Es lo que le pasa **siempre** a una
lista escrita a mano: se actualiza sólo si alguien se acuerda al añadir cada
fuente nueva, y a lo largo de diez pipelines nadie se acordó ni una vez. El
modo de fallo no es que esté mal — es que **se degrada sola** mientras todo lo
demás mejora.

**La solución aplicada:** Generarla. Cada pipeline ya declaraba su `fuente`,
`fecha_corte`, `procedencia` y `generado_por` en la metadata de lo que publica.
Un décimo pipeline recorre `frontend/data/`, lee esas metadatas y arma el
manifiesto.

Y el giro que la hace útil de verdad: **lo que no está declarado no se
inventa, se lista**. El manifiesto se convierte en la auditoría del sistema
sobre sí mismo. La primera corrida delató que **17 de 24 archivos** no declaran
su `procedencia`.

**Tecnología y librerías usadas:**

- **`pathlib.Path.rglob("*.json")`** — recorre recursivamente. `rglob` es
  `glob` con `**` implícito: encuentra en subcarpetas sin construir la ruta.
- **`ruta.relative_to(base)`** — convierte la ruta absoluta en la que ve el
  navegador (`electoral/forensia_2024.json`), que es la que hay que publicar.
- **`Path.stat().st_size`** — el peso en bytes, para que el manifiesto diga qué
  tan grande es cada cosa sin abrirla.
- **`isinstance(v, (list, dict))` + `len(v)`** — cuenta registros sin saber el
  esquema de cada archivo: sirve igual para `secciones` (dict de 542) que para
  `observaciones` (lista de 175).

**El proceso paso a paso:**

1. Leer la fuente donde cada pipeline la puso
   ([build_fuentes.py:65](backend/datalab/pipeline/build_fuentes.py#L65)):

```python
CLAVES_FUENTE = ["fuente", "casa", "fuente_base", "fuente_oficial"]

def fuente_de(meta):
    for k in CLAVES_FUENTE:
        v = meta.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip(), k
    v = meta.get("fuentes")          # correlaciones publica varias: es un cruce
    if isinstance(v, dict):
        partes = [str(x) for x in v.values() if x]
        if partes:
            return " · ".join(sorted(set(partes))), "fuentes"
    return None, None
```

Cada pipeline nació en su fase y nombró el campo como le encajaba: `casa` en
encuestas porque es una casa encuestadora, `fuente_base` en la proyección
porque es la base de la simulación. **Se leen todas esas formas en vez de
migrar el esquema de nueve pipelines ya verificados.** Y se devuelve *también*
la clave usada, para que la irregularidad quede registrada en vez de
disimulada.

2. Distinguir "no declarado" de "declarado como nulo"
   ([build_fuentes.py:112](backend/datalab/pipeline/build_fuentes.py#L112)):

```python
    for campo, valor in (...):
        if valor:
            continue
        if campo in meta and meta[campo] is None:
            continue          # declarado como nulo: es una respuesta, no un hueco
        f.append(campo)
```

Ésta es la distinción que salvó al pipeline de ser injusto.
`escuelas_campeche.geojson` trae `"fecha_corte": null` **a propósito**, porque
el catálogo CCT de la SEP no publica una. Es una declaración —"la fuente no lo
dice"— y lo contrario de un descuido. Tratarlas igual castigaría al pipeline
que se tomó la molestia de ser explícito. Es el mismo criterio que el `*` del
Censo: la ausencia declarada es información.

3. Y una verificación que ata el manifiesto a la realidad:

```python
    for g in generados:
        if g not in pipes:
            raise SystemExit(
                f"Un archivo dice estar generado por '{g}', que no está en "
                f"{PIPELINES.relative_to(RAIZ)}. O se renombró el pipeline o "
                f"la metadata quedó vieja.")
```

Si alguien renombra un pipeline y no actualiza el `generado_por` de su salida,
el manifiesto lo detecta. Es exactamente la clase de desfase que produjo el
problema original, ahora imposible de que pase inadvertido.

4. Y la comprobación se cerró sobre sí misma: al correrlo después de añadir
   `cct_por_municipio.json`, el manifiesto **delató mi propio archivo nuevo**
   por no declarar `procedencia` ni `generado_por`. Se corrigió. Un instrumento
   que atrapa a quien lo construyó está funcionando.

**El concepto con nombre:** **Single source of truth** aplicado a la
documentación: el sistema se documenta a sí mismo en vez de tener una
descripción paralela que se desincroniza. En infraestructura esto es
**introspección** o *self-describing systems*; en catálogos de datos es
**metadata harvesting** — recorrer los activos y cosechar sus metadatos en vez
de mantener un inventario aparte. El problema que resuelve tiene nombre:
**documentation drift**.

La analogía: el índice de un libro. Escrito a mano se desfasa en cuanto mueves
un capítulo; generado del documento, no puede. Y la lista de "lo que falta
declarar" es el equivalente a un índice que además te dice qué capítulos no
tienen título.

**Por qué esta tecnología y no otra:**

- **¿Por qué recorrer `frontend/data/` y no listar los archivos esperados?**
  Una lista de archivos esperados es otra cosa que mantener a mano — el mismo
  problema con otro nombre. Recorrer el directorio hace que un archivo nuevo
  aparezca solo, y que uno borrado desaparezca solo.
- **¿Por qué un pipeline y no generarlo en el navegador?** El navegador no
  puede listar un directorio: tendría que pedir un índice que alguien
  mantuviera. Y el manifiesto es estable entre despliegues, así que es el caso
  de libro de "precalcular lo que no depende de la interacción".
- **¿Por qué no migrar los nueve pipelines a un esquema uniforme?** Sería más
  limpio y tocaría nueve archivos verificados para arreglar algo que un
  diccionario de cuatro claves resuelve. La irregularidad queda **documentada**
  en el propio manifiesto, que es mejor que esconderla con una migración.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **actualizar `fuentes.html` a mano** con los 24 archivos.
Media hora y queda correcta hoy. Se descartó porque volvería a desfasarse en la
fase siguiente — ya lo hizo diez veces. Arreglar el contenido sin arreglar el
mecanismo es programar el mismo bug para dentro de un mes.

La segunda alternativa era **generar el manifiesto pero ocultar los faltantes**,
enseñando sólo lo que sí está declarado. Habría dado una página más presentable.
Se descartó porque la lista de faltantes es la parte más valiosa: convierte la
página de trazabilidad en un instrumento de control de calidad en vez de un
folleto. Una página de fuentes que no puede decir "esto no está documentado"
sirve para presumir, no para auditar.

**Cómo lo dirías en una entrevista:**
> "La página que documentaba las fuentes de datos del sistema citaba un archivo
> muerto mientras el sistema servía veinticuatro: se había desfasado a lo largo
> de diez pipelines. En vez de actualizarla, la generé — un pipeline recorre el
> directorio de datos, cosecha la metadata de cada archivo y arma el manifiesto,
> leyendo la clave de fuente donde cada pipeline la puso en vez de migrar
> esquemas ya verificados. Lo importante es que no rellena: lo que no está
> declarado se publica como faltante, así que la página se volvió la auditoría
> del sistema sobre sí mismo. Detectó que 17 de 24 archivos no declaraban
> procedencia, incluido uno que yo mismo acababa de añadir."

---

## 2026-08-19 — El certificado estaba mal: completar la cadena, no apagar la verificación

**El problema real:** La fuente de fiscalización (`asecam.gob.mx`, la Auditoría
Superior del Estado) publica datos abiertos en `.xlsx`, pero **su servidor sirve
el certificado sin el intermedio**. Cualquier cliente estricto se cae:

```
SSLCertVerificationError: unable to get local issuer certificate  (código 20)
```

Curioso: `curl` lo descargaba sin protestar. Eso hace el problema más peligroso,
porque una prueba manual pasa y el pipeline falla — o al revés, alguien concluye
que "el sitio funciona" y busca el error donde no está.

La salida rápida está a un parámetro: `verify=False`, `curl -k`,
`ssl._create_unverified_context()`. Todas funcionan al instante. Y todas
convierten la descarga de una fuente oficial de gobierno en la descarga de
**quien sea que esté en medio de la red**, sin aviso. En un pipeline cuyo
producto es "esto viene del organismo fiscalizador", eso destruye lo único que
el dato aportaba.

**La solución aplicada:** El certificado no es inválido — está **incompleto**. Lo
firma una CA real (DigiCert), pero el servidor no manda el eslabón intermedio.
Y el propio certificado dice dónde encontrarlo, en su extensión **Authority
Information Access**:

```
Authority Information Access:
    OCSP - URI:http://status.rapidssl.com
    CA Issuers - URI:http://cacerts.rapidssl.com/RapidSSLTLSRSACAG1.crt
```

Se descarga ese intermedio una vez, se guarda en el repositorio, y se **añade**
al almacén de confianza del sistema. La verificación sigue activa; lo único que
cambia es que ahora puede completarse.

**Tecnología y librerías usadas:**

- **`openssl s_client -connect host:443 -servername host`** — abre la conexión y
  muestra la cadena que el servidor envía de verdad. El `-servername` activa SNI,
  imprescindible cuando un servidor aloja varios dominios. Fue lo que mostró que
  la cadena tiene **un solo eslabón** (`0 s:CN=*.asecam.gob.mx`) donde debería
  tener dos.
- **`openssl x509 -noout -text`** — imprime el certificado legible, incluida la
  extensión AIA con la URL del intermedio.
- **`openssl x509 -inform DER -out … .pem`** — los certificados de las CA se
  publican en DER (binario) y Python quiere PEM (base64). Es la conversión.
- **`ssl.create_default_context()` + `.load_verify_locations(cafile=…)`** — la
  pieza clave: `create_default_context` trae el almacén del sistema con
  verificación activa, y `load_verify_locations` **añade** un certificado más.
  No sustituye ni relaja: suma.
- **`ssl.SSLCertVerificationError`** — se captura por separado del resto de
  errores de red, porque significa algo distinto: no es que la descarga falle,
  es que no se puede confiar en ella.

**El proceso paso a paso:**

1. Diagnosticar antes de arreglar:

```python
ctx = ssl.create_default_context()
try:
    with socket.create_connection(("asecam.gob.mx", 443), timeout=15) as s:
        with ctx.wrap_socket(s, server_hostname="asecam.gob.mx") as ss:
            print("handshake OK")
except ssl.SSLCertVerificationError as e:
    print(e.verify_message, e.verify_code)   # -> unable to get local issuer certificate, 20
```

El **código 20** de OpenSSL es específico: *unable to get local issuer
certificate*. No dice "certificado inválido" ni "caducado" ni "nombre que no
coincide" — dice "falta un eslabón". Distinguirlo es lo que permite arreglarlo
en vez de rendirse.

2. Preguntarle al certificado dónde está su emisor:

```bash
echo | openssl s_client -connect asecam.gob.mx:443 -servername asecam.gob.mx 2>/dev/null \
  | openssl x509 -noout -text | grep -A3 "Authority Information Access"
```

3. Traerlo, convertirlo y guardarlo **en el repositorio**, porque es parte del
   insumo:

```bash
curl -s http://cacerts.rapidssl.com/RapidSSLTLSRSACAG1.crt \
  | openssl x509 -inform DER -out backend/datalab/uploads/asecam/RapidSSLTLSRSACAG1.pem
```

Que venga por **HTTP sin cifrar** no lo debilita: un certificado es
autoverificable. Éste está firmado por la raíz de DigiCert, que sí está en el
sistema, así que si alguien lo alterara en tránsito la firma no cuadraría y la
verificación fallaría igual.

4. Y el contexto que usa el pipeline
   ([build_auditoria.py:105](backend/datalab/pipeline/build_auditoria.py#L105)):

```python
def contexto_tls():
    """Almacén del sistema MÁS el intermedio que ASECAM no envía.

    No se desactiva la verificación: se le da a Python la pieza que falta para
    poder verificar. Si el intermedio no está en el repositorio, el pipeline
    se detiene en vez de bajar por un canal sin verificar.
    """
    pem = CRUDO / INTERMEDIO
    if not pem.exists():
        raise SystemExit(
            f"Falta el certificado intermedio en {pem}.\n"
            f"...NO se descarga con la verificación desactivada.")
    ctx = ssl.create_default_context()
    ctx.load_verify_locations(cafile=str(pem))
    return ctx
```

El `raise SystemExit` cuando falta el PEM es la parte que impide la regresión:
sin él, alguien que clone el repo sin ese archivo tendría el pipeline roto y la
tentación de "arreglarlo" con `verify=False`. El mensaje le dice exactamente qué
hacer y por qué no debe hacer lo otro.

5. Y una comprobación de que lo descargado es lo esperado:

```python
    if not datos.startswith(b"PK"):
        raise SystemExit(
            f"Lo descargado no es un XLSX (no empieza con PK). Primeros "
            f"bytes: {datos[:60]!r}")
```

`PK` son las iniciales de Phil Katz, el autor de ZIP: todo archivo ZIP —y un
XLSX lo es— empieza así. Si el servidor devuelve una página de error con
código 200, esto lo atrapa antes de que openpyxl falle con un error críptico.

**El concepto con nombre:** **Incomplete certificate chain**, uno de los errores
de configuración TLS más comunes. Lo que se explota para arreglarlo se llama
**AIA chasing** (o *AIA fetching*): seguir la extensión Authority Information
Access para completar la cadena. Los navegadores lo hacen automáticamente —por
eso el sitio "se ve bien" en Chrome y falla en un script—, pero las librerías
de servidor no. Y la mala práctica que se evita tiene nombre propio:
**disabling certificate verification**, que aparece sistemáticamente en los
primeros puestos de las listas de vulnerabilidades comunes.

La analogía: te dan una carta firmada por un notario, pero falta la hoja que
acredita que ese notario está colegiado. Tienes dos opciones: pedir la hoja al
colegio —que es público y verificable— o decidir que ya no vas a comprobar
firmas. La segunda es más rápida y te deja aceptando cualquier papel.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `certifi` con un bundle propio?** `certifi` no está instalado, y
  sobre todo: sustituir el almacén del sistema por uno propio es más frágil —
  hay que mantenerlo actualizado cuando caduquen raíces. `create_default_context`
  + `load_verify_locations` **añade** sin sustituir, así que el sistema sigue
  gestionando las raíces y nosotros sólo aportamos la pieza que falta.
- **¿Por qué guardar el PEM en el repositorio y no descargarlo cada vez?**
  Porque entonces el pipeline dependería de que `cacerts.rapidssl.com` esté
  disponible, y añadiría una descarga previa a cada corrida. Guardado, es
  auditable: cualquiera puede inspeccionarlo y comprobar que es el intermedio
  de DigiCert que dice ser.
- **¿Por qué no reportarlo a ASECAM y esperar?** Habría que hacerlo, y no
  bloquea: la solución del lado del cliente es correcta y funcionaría igual si
  ellos lo arreglaran, porque un intermedio de más en el almacén no estorba.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **descargar el archivo a mano una vez** y tratarlo como
insumo estático, esquivando el problema. Es lo que hace el proyecto con otros
crudos y era defendible. Se descartó porque ASECAM publica cada semestre: un
insumo que se actualiza dos veces al año merece una descarga reproducible, y
resolver el TLS bien cuesta una función de siete líneas.

La segunda —la que había que evitar— era `verify=False` **con un comentario que
lo explicara**. Suena razonable: está documentado, alguien lo leerá. No: un
comentario no impide un ataque, y el pipeline seguiría aceptando cualquier
respuesta. La diferencia entre documentar un riesgo y eliminarlo es justamente
lo que separa una advertencia de un arreglo — la misma distinción que en
forensia llevó a cerrar el nivel rojo por diseño en vez de por redacción.

**Cómo lo dirías en una entrevista:**
> "Una fuente oficial de gobierno servía su certificado sin el intermedio, así
> que la verificación TLS fallaba con 'unable to get local issuer certificate',
> aunque `curl` la descargaba sin problema. En vez de desactivar la
> verificación, leí la extensión Authority Information Access del propio
> certificado —que declara la URL de su emisor—, descargué el intermedio, lo
> convertí de DER a PEM, lo guardé en el repo y lo añadí al almacén del sistema
> con `load_verify_locations`. La verificación quedó activa y el pipeline aborta
> si el intermedio no está, para que nadie lo 'arregle' apagándola. Es AIA
> chasing: lo que los navegadores hacen solos y las librerías de servidor no."

---

## 2026-08-19 — Un r de 0.48 que es compatible con no haber ninguna relación

**El problema real:** La última fase pedía cruzar nivel socioeconómico,
demografía y participación. Es la tarea más fácil de hacer mal del proyecto
entero: se toman dos columnas, se calcula un coeficiente y sale un número con
tres decimales que parece un hallazgo.

El caso concreto que lo ilustra todo:

```
participación vs % de población de 50 y más    r = +0.480
```

Leído solo, eso es "una relación moderada positiva: donde hay más gente mayor
se vota más". Titular listo. El problema es que hay **12 municipios**, y con
n=12 el intervalo de confianza de ese coeficiente es:

```
IC95 [ −0.130 , +0.826 ]
```

**Incluye el cero.** Estos datos son igual de compatibles con que no haya
ninguna relación que con una relación fuerte. El 0.480 no se puede interpretar.

Y hay más: al quitar un solo municipio, el coeficiente se mueve hasta 0.119
(quitando Palizada baja a 0.360; quitando Campeche sube a 0.587). Con doce
unidades, un caso sostiene el resultado.

**La solución aplicada:** No publicar ningún coeficiente sin su intervalo, y
separar los niveles de análisis por su n en vez de mezclarlos en una tabla
donde todos los números se ven igual de sólidos.

```
Por sección    n = 542    0 de 4 correlaciones incluyen el cero
Por municipio  n =  12    4 de 5 correlaciones incluyen el cero
```

Ese contraste es el producto de la fase.

**Tecnología y librerías usadas:**

- **`statistics.fmean` y `statistics.stdev`** (estándar de Python) — media y
  desviación muestral. `fmean` es la versión rápida en coma flotante de `mean`.
- **`math.atanh` y `math.tanh`** — las funciones que hacen posible el intervalo
  de una correlación. `atanh` es la **transformación z de Fisher**.
- **Pearson implementado a mano**, sin numpy: son tres sumas y dos raíces. El
  pipeline no necesita más y así se lee la fórmula en el código.
- **Jackknife a mano** — recalcular el coeficiente quitando una observación
  cada vez. Sin librería: un bucle y un *slice*.

**El proceso paso a paso:**

1. El coeficiente, con el caso degenerado atendido
   ([build_correlaciones.py:75](backend/datalab/pipeline/build_correlaciones.py#L75)):

```python
    if sx == 0 or sy == 0:
        # Una variable constante no correlaciona con nada: no es que la
        # relación sea cero, es que la pregunta no aplica.
        return None
```

Devolver `0.0` habría sido cómodo y falso: "no hay relación" y "la pregunta no
tiene sentido" son cosas distintas, igual que el `null` del Censo no era un `0`.

2. El intervalo, que es la pieza central
   ([build_correlaciones.py:90](backend/datalab/pipeline/build_correlaciones.py#L90)):

```python
def intervalo_r(r, n):
    """IC95 de una correlación, por la transformación z de Fisher.

    r no se distribuye normal —está acotado en [−1, 1] y su varianza depende
    de su propio valor—, así que no se le puede poner un ± simétrico. La
    transformación de Fisher, arctanh(r), sí es aproximadamente normal con
    error estándar 1/sqrt(n−3); se calcula el intervalo ahí y se devuelve con
    tanh. Por eso el intervalo resultante es asimétrico, que es lo correcto.
    """
    z = math.atanh(r)
    se = 1 / math.sqrt(n - 3)
    return [round(math.tanh(z - Z95 * se), 3), round(math.tanh(z + Z95 * se), 3)]
```

Por qué no basta un `r ± algo`: la correlación vive en [−1, 1], así que cerca de
los extremos el intervalo **tiene** que ser asimétrico — no puede pasarse de 1.
Fisher resuelve eso mandando r a una escala sin fronteras, donde el error
estándar es constante y sólo depende de n, y devolviéndolo después.

El `n − 3` no es un detalle: con n=12 el error estándar es 1/3 = 0.333, y ese
tercio en escala z se convierte en el intervalo enorme del ejemplo.

3. El jackknife, que responde otra pregunta
   ([build_correlaciones.py:106](backend/datalab/pipeline/build_correlaciones.py#L106)):

```python
    peor, quien = 0.0, None
    for i in range(len(x)):
        xs = x[:i] + x[i + 1:]
        ys = y[:i] + y[i + 1:]
        r = pearson(xs, ys)
        if r is not None and abs(r - base) > peor:
            peor, quien = abs(r - base), i
```

El intervalo dice cuánta incertidumbre hay por muestreo; el jackknife dice si el
resultado **depende de un caso concreto**. Son cosas distintas y las dos hacen
falta: un coeficiente puede tener un intervalo aceptable y aun así venir de un
solo punto influyente.

4. Y la categórica se trata como categórica
   ([build_correlaciones.py:151](backend/datalab/pipeline/build_correlaciones.py#L151)):

```python
def por_grupo(valores, grupos):
    """Con una categórica no hay correlación que calcular: se comparan medias.
    El IC de cada media es lo que permite ver si los grupos se distinguen —
    dos medias distintas con intervalos que se solapan no son dos medias
    distintas."""
```

Urbano 63.72% [62.68, 64.76] contra rural 66.88% [64.70, 69.06]: los intervalos
casi se tocan. Publicar "en las rurales se vota 3 puntos más" sin ellos sería
afirmar más de lo que hay.

5. Las comprobaciones fijan las propiedades del método:

```python
    # El intervalo de Fisher se estrecha con n y es asimétrico salvo en r=0.
    a = intervalo_r(0.5, 12)
    b = intervalo_r(0.5, 500)
    assert (b[1] - b[0]) < (a[1] - a[0]), "más n debería cerrar el intervalo"
    assert abs((0.5 - a[0]) - (a[1] - 0.5)) > 0.01, "debería ser asimétrico"

    # El caso que motiva toda la fase: n=12 con r moderado incluye el cero.
    ic = intervalo_r(0.48, 12)
    assert ic[0] < 0 < ic[1], ic
```

**El concepto con nombre:** La **transformación z de Fisher** para el intervalo;
el **jackknife** para la influencia; y el error de fondo que se evita es
publicar una **estimación puntual sin su incertidumbre**. El fenómeno de que con
pocas observaciones cualquier coeficiente parezca grande tiene nombre:
**small-sample bias** en la magnitud de la correlación. Y la trampa mayor, que
está declarada en toda la salida, es la **falacia ecológica** — concluir sobre
individuos desde datos agregados. Su ejemplo canónico (Robinson, 1950) es,
literalmente, un estudio de datos electorales.

La analogía: preguntarle a doce personas si les gusta una película y que a siete
sí. ¿"El 58% del público la aprueba"? Con doce respuestas, el intervalo real va
de 28% a 85%. El porcentaje es correcto y no sirve para nada.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `scipy.stats.pearsonr`, que además devuelve el p-valor?**
  `scipy` no está instalado, y sobre todo: el p-valor es peor herramienta para
  este caso. Un p-valor responde "¿es distinguible de cero?" con un sí o un no
  y esconde la magnitud; el intervalo responde eso **y además** cuánto de ancho
  es el margen. Con n=12 lo que hay que enseñar es precisamente el ancho.
- **¿Por qué Pearson y no Spearman?** Spearman (correlación de rangos) sería más
  robusto a valores extremos y a relaciones no lineales. Con n=12 tampoco lo
  salvaría —el problema no es la forma, es la cantidad— y Pearson es
  interpretable por más gente. A nivel sección, con n=542, la diferencia entre
  ambos sería marginal.
- **¿Por qué un corte de fiabilidad en n=30 y no una prueba de significancia?**
  Porque no es una decisión estadística sino de presentación: por debajo de esa
  n, la cifra se publica con etiqueta de fiabilidad baja **aunque su intervalo
  excluya el cero**. El corte es conservador a propósito.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **no publicar las correlaciones municipales**, ya que casi
ninguna dice nada. Es defendible. Se descartó porque el hueco se llena solo: si
la herramienta no cruza demografía con participación, alguien lo hará en una
hoja de cálculo, sin intervalo y sin jackknife. Publicarlas **con** su
incertidumbre es más útil que no publicarlas, y bastante más que publicarlas
desnudas.

La segunda alternativa, la tentadora, era **subir la n bajando de nivel**:
asignar a cada sección la demografía de su municipio y correlacionar con n=542.
Se descartó porque es fraude estadístico con buena intención: las 542
observaciones no serían independientes —comparten doce valores demográficos
repetidos— y el intervalo saldría estrecho por una precisión que no existe.
Habría convertido el "no se puede saber" en un falso "sí se puede".

**Cómo lo dirías en una entrevista:**
> "La última fase era cruzar demografía con participación, y el riesgo era
> publicar coeficientes que parecen hallazgos. Calculé cada correlación con su
> intervalo de confianza por transformación z de Fisher —que da un intervalo
> asimétrico, correcto porque r está acotado— y con un jackknife para ver si
> dependía de un caso. Con doce municipios, cuatro de cinco correlaciones
> incluían el cero, incluida una de 0.48 que se leería como relación moderada.
> Separé el análisis por nivel: a nivel sección, con 542 observaciones, ninguna
> incluía el cero. Descarté inflar la n asignando demografía municipal a cada
> sección: las observaciones no serían independientes y el intervalo saldría
> estrecho por una precisión inexistente."

---

## 2026-08-19 — Los atípicos ensanchan la vara con la que se los mide

**El problema real:** Había que detectar secciones electorales con valores
inusuales entre las 542. Lo obvio es el z-score de toda la vida:
`z = (x − media) / desviación`, y marcar lo que pase de 3.

Dos cosas lo rompen aquí.

**Primera: la desviación estándar la inflan los propios atípicos.** Si hay unas
cuantas secciones con voto nulo altísimo, esas secciones *suben la desviación
estándar del conjunto*, así que el umbral de "3 desviaciones" se aleja y dejan
de destacar. El caso extremo: mete un valor de 1000 en una serie que va de 10 a
10.5, y todos los z quedan aplastados — incluido el del propio 1000.

**Segunda: la dispersión depende del tamaño.** Al mirar la desviación de la
participación por quintil de lista nominal:

```
Q1 (111–623 electores)     sd = 14.24
Q3 (945–1204)              sd =  9.76
Q5 (1693–11203)            sd =  9.54
```

Una sección de 200 electores varía naturalmente mucho más que una de 5,000: es
aritmética de proporciones, no comportamiento electoral. Un umbral único
marcaría a las chicas **por chicas**, no por atípicas.

**La solución aplicada:** Estadística robusta, estratificada por tamaño.

```
z robusto = 0.6745 × (x − mediana del estrato) ÷ MAD del estrato
```

La **MAD** (desviación absoluta mediana: la mediana de las distancias a la
mediana) no se mueve cuando aparece un extremo. Y comparar cada sección sólo
contra las de su propio quintil elimina el efecto del tamaño.

**Tecnología y librerías usadas:**

- **`statistics.median(datos)`** (estándar de Python) — la mediana. A
  diferencia de la media, un valor extremo no la arrastra: cambiar el mayor
  valor de una serie por uno diez veces más grande no la mueve ni un poco.
- **`statistics.median([abs(x - med) for x in sub])`** — la MAD, que no tiene
  función propia en la estándar pero es una línea: la mediana de las
  desviaciones absolutas.
- **El factor 0.6745** — para datos normales, `MAD × 1/0.6745 ≈ σ`. Multiplicar
  por 0.6745 deja el z robusto **en la misma escala que un z convencional**, así
  que "|z| > 3" sigue significando lo de siempre y los umbrales son
  interpretables por alguien que no sepa qué es la MAD. (0.6745 es el cuantil
  0.75 de la normal estándar; la MAD de una normal es exactamente ese cuantil
  por σ.)
- **`sorted` + reparto por posición** para los quintiles, en vez de
  `numpy.percentile`: con 542 elementos y cinco grupos, repartir por índice
  garantiza que ningún estrato quede vacío ni desbalanceado por empates en el
  valor de corte.

**El proceso paso a paso:**

1. El z robusto, con el caso degenerado resuelto
   ([build_forensia.py:175](backend/datalab/pipeline/build_forensia.py#L175)):

```python
def z_robusto(valores, indices):
    """z robusto dentro de un estrato: (x − mediana) / MAD, escalado."""
    sub = [valores[i] for i in indices]
    med = statistics.median(sub)
    mad = statistics.median([abs(x - med) for x in sub])
    if mad == 0:
        # Sin dispersión no hay atípicos que medir. Devolver ceros es correcto:
        # dividir entre cero daría infinitos que luego se leerían como alarma.
        return {i: 0.0 for i in indices}
    return {i: FACTOR_MAD * (valores[i] - med) / mad for i in indices}
```

El `if mad == 0` no es paranoia: si más de la mitad de un estrato tiene el mismo
valor, la MAD es cero. Sin la guarda saldrían `inf`, y un infinito propagado a
un semáforo se pinta como la alerta más grave del sistema.

2. La estratificación
   ([build_forensia.py:187](backend/datalab/pipeline/build_forensia.py#L187)):

```python
def estratos(lista_nominal):
    """Índices agrupados por quintil de lista nominal."""
    orden = sorted(range(len(lista_nominal)), key=lambda i: lista_nominal[i])
    tam = len(orden) / QUINTILES
    grupos = [[] for _ in range(QUINTILES)]
    for pos, i in enumerate(orden):
        grupos[min(QUINTILES - 1, int(pos // tam))].append(i)
    return grupos
```

`sorted(range(n), key=...)` ordena los **índices**, no los valores: hace falta
saber a qué sección corresponde cada posición. Y el `min(QUINTILES - 1, ...)`
atrapa el último elemento, que por redondeo caería en un sexto grupo inexistente.

3. La prueba que demuestra que la MAD hace lo que promete:

```python
    # El MAD resiste lo que la desviación estándar no: un valor extremo no
    # cambia la vara con la que se mide al resto.
    base = [10.0] * 20 + [10.5] * 20
    con_extremo = base + [1000.0]
    zz = z_robusto(con_extremo, list(range(len(con_extremo))))
    assert abs(zz[len(con_extremo) - 1]) > 100, "el extremo debería destacar"
    assert all(abs(zz[i]) < 5 for i in range(40)), "el resto no debería moverse"
```

Ésta es la comprobación que vale: con media y desviación estándar, ese 1000
daría un z de ~6 y **todos los demás quedarían por debajo de 0.2**. Con MAD, el
extremo sale con |z| > 100 y el resto se queda donde estaba.

4. Y una verificación de cordura sobre el resultado
   ([build_forensia.py:296](backend/datalab/pipeline/build_forensia.py#L296)):

```python
    if conteo["verde"] / len(filas) < 0.80:
        raise SystemExit(
            f"Sólo {conteo['verde']/len(filas)*100:.1f}% en verde. Con estos "
            f"cortes el detector marca demasiado: revisa los umbrales.")
```

Un detector que marca a la mitad del universo no está detectando: está
describiendo lo normal. El reparto quedó en 90.8% / 5.7% / 3.3%.

**El concepto con nombre:** **Robust statistics**, y el fenómeno concreto que se
evita se llama **masking** (enmascaramiento): los atípicos se esconden unos a
otros al inflar la medida de dispersión. La MAD tiene un **breakdown point del
50%** —la mitad de los datos pueden ser basura y sigue funcionando— frente al 0%
de la desviación estándar, donde un solo valor la arruina. Lo segundo es
**heterocedasticidad**: la varianza no es constante, depende del tamaño; la
estratificación es la respuesta simple, y una regresión con pesos sería la
elaborada.

La analogía: calificar exámenes sobre la media de la clase. Si tres personas
copian y sacan 100, suben la media y el resto parece peor — y los que copiaron
dejan de destacar porque *ellos mismos* movieron la referencia. La mediana no se
deja arrastrar por tres.

**Por qué esta tecnología y no otra:**

- **¿Por qué no IQR y bigotes de Tukey (1.5 × rango intercuartílico)?** Es la
  otra herramienta robusta estándar y habría servido. Se prefirió la MAD porque
  produce un número en escala de σ, y eso permite decir "|z| ≥ 2.5" — que
  cualquiera con estadística básica interpreta— en vez de "fuera del bigote",
  que hay que explicar cada vez.
- **¿Por qué no `scipy.stats.median_abs_deviation`?** `scipy` no está instalado
  y la MAD es una línea con `statistics`. Añadir 30 MB de dependencia para una
  mediana de valores absolutos sería exactamente lo que este proyecto evita.
- **¿Por qué quintiles y no una regresión de la varianza contra el tamaño?**
  Modelar `sd ≈ f(n)` sería más fino y permitiría un z continuo. Con 542
  observaciones y un efecto que ya se ve limpio en cinco grupos, la regresión
  añade supuestos (forma funcional, ajuste) para afinar algo que la
  estratificación resuelve sin ninguno.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **el z clásico sin estratificar**, que es lo que se hace por
defecto. Se descartó al medir: habría producido una lista de "anomalías"
dominada por secciones pequeñas, donde la variación alta es aritmética y no
electoral. Un detector que sistemáticamente señala a las secciones rurales
chicas no está detectando anomalías: está detectando que son chicas — y en una
herramienta electoral, esa lista se lee como otra cosa.

La segunda alternativa era **percentiles globales** (marcar el 5% superior e
inferior). Es simple y no depende de ninguna forma de distribución. Se descartó
porque garantiza que siempre habrá exactamente un 10% marcado, incluso si todas
las secciones fueran idénticas. El umbral tiene que poder decir "aquí no hay
nada", y un percentil fijo nunca lo dice.

**Cómo lo dirías en una entrevista:**
> "Para detectar secciones electorales atípicas descarté el z-score clásico por
> dos razones que verifiqué en los datos: la desviación estándar la inflan los
> propios atípicos —masking, la MAD tiene breakdown point del 50% y la
> desviación estándar del 0%— y la dispersión dependía del tamaño de la sección,
> con desviación de 14 puntos en el quintil más chico contra 9.5 en el mayor.
> Usé z robusto con mediana y MAD, escalado por 0.6745 para que quede en unidades
> de sigma y los umbrales sigan siendo interpretables, estratificado por
> quintiles de lista nominal. Dejé un test que mete un valor extremo en una serie
> plana y comprueba que destaca sin mover al resto."

---

## 2026-08-19 — La verdad-terreno no validó el detector, y eso era la información

**El problema real:** Había tres sentencias del Tribunal Electoral que anularon
casillas en 2024. Parecía el caso de prueba perfecto para calibrar un detector
de anomalías: si no marca esas secciones, el umbral está mal. Ésa era
literalmente la instrucción, y es el razonamiento correcto.

Al ir a comprobarlo, se cayó por dos lados a la vez:

**Uno.** Las sentencias anulan casillas identificadas por sección —50B, 68B, 78B,
99B, 1B, 122S— y **cinco de esas seis secciones no tienen resultado publicado**.
Sus votos se anularon: no hay patrón que analizar. El detector no puede marcarlas
porque la evidencia fue removida por la propia sentencia que las señala.

(De paso, esto explicó un hallazgo anterior: en la Fase 1 aparecieron "19
secciones del catálogo sin resultado 2024" y se atribuyeron a
reseccionalización. Cinco de ellas no eran nuevas — eran éstas.)

**Dos.** La única que sobrevive, la 122, es **estadísticamente ordinaria**:

```
participación  70.1%  z = +0.45   percentil 68
voto nulo       2.3%  z = −0.63   percentil 26
1er lugar      44.6%  z = −0.69   percentil 28
```

Ningún umbral, por bien calibrado que esté, la marcaría. Y bajarlo hasta que la
marcara significaría marcar un tercio del estado.

**La solución aplicada:** Tomar el resultado negativo como el hallazgo que es, y
rediseñar el sistema alrededor de él. Si la anulación jurídica no deja huella
estadística, entonces son **dos canales distintos** y hay que construirlos
separados:

- **Canal estadístico** — mide distancia a la mediana. Puede llegar hasta
  "desviación pronunciada" y no más.
- **Canal documental** — lee las sentencias. Es el único que enciende el rojo.

Y la regla se cierra **por diseño, no por advertencia**:

```python
    for f in filas:
        if f["nivel"] == "rojo" and not f["documental"]:
            raise SystemExit(
                f"Sección {f['seccion']} en rojo sin respaldo documental. El "
                f"rojo no se puede alcanzar por estadística.")
```

**Tecnología y librerías usadas:**

- **`re.findall(r"\b(\d+)([A-Z])\b", texto)`** — extrae los pares
  número+letra de un texto libre. Las notas del cómputo vienen como prosa
  (`"Casillas 50B, 68B y 78B anuladas por..."`), y el `\b` (frontera de palabra)
  evita capturar fragmentos de otros números. Devuelve tuplas: `[('50','B'),
  ('68','B'), ('78','B')]`.
- **`re.search(r"Casillas?\s+(.+?)\s+anuladas", nota)`** — acota la búsqueda al
  tramo entre "Casillas" y "anuladas". El `.+?` es **no codicioso**: sin el `?`
  se comería hasta el final de la nota y capturaría números del expediente.
- **`dict.setdefault(clave, valor)`** — crea la entrada la primera vez y
  devuelve la existente después. Sirve para acumular varias casillas anuladas en
  la misma sección sin comprobar si ya existe.
- **`raise SystemExit` dentro de `verificar()`** — la regla estructural se
  comprueba en cada corrida, no una vez a mano.

**El proceso paso a paso:**

1. Leer las sentencias de la prosa
   ([build_forensia.py:150](backend/datalab/pipeline/build_forensia.py#L150)):

```python
        exp = re.search(r"TEEC/JIN/DIP/\d+/\d+", nota)
        # 'Casillas 50B, 68B y 78B anuladas' -> 50, 68, 78
        tramo = re.search(r"Casillas?\s+(.+?)\s+anuladas", nota)
        casillas = re.findall(r"\b(\d+)([A-Z])\b", tramo.group(1)) if tramo else []
```

Se conserva el **expediente** junto a cada sección. Un rojo sin número de
expediente sería una afirmación sin respaldo, que es justo lo que este diseño
existe para impedir.

2. Publicar la calibración entera, incluido el resultado incómodo
   ([build_forensia.py:258](backend/datalab/pipeline/build_forensia.py#L258)):

```python
        "el_detector_las_marcaria": any(
            d["seria_atipica_por_estadistica"] for d in detalle),
        "lectura":
            "... Ningún umbral la marcaría, y eso NO significa que el umbral "
            "esté mal: significa que una casilla se anula por irregularidades "
            "de procedimiento, y el procedimiento no deja huella en el reparto "
            "de votos. Anomalía estadística y anulación jurídica miden cosas "
            "distintas.",
```

El campo `el_detector_las_marcaria` sale **False** y se publica igual. Un
sistema que sólo publica sus aciertos no es auditable.

3. Y la separación llegó a la pantalla: la tabla de contraste enseña las seis
   secciones, dice de cinco que *no hay datos porque sus votos se anularon*, y de
   la sexta que el detector **no** la marcaría — en negrita.

4. Un tercer hallazgo apareció por el camino: la sección 474 tiene 315 electores,
   una casilla y **cero votos**. El z la ponía en "desviación pronunciada" por
   participación baja, y eso mezcla dos cosas: cero votos no es participación
   baja, es ausencia de votación — una casilla que no operó o un hueco en el
   cómputo. Se marca aparte, con su propia nota.

**El concepto con nombre:** El error que se evita es asumir que dos cosas miden
lo mismo porque suenan parecido — **construct validity**: ¿mide el instrumento
lo que dices que mide? Aquí la respuesta honesta es que el detector mide
distancia a la mediana, y eso no es "irregularidad electoral". Lo que se
descubrió al calibrar es que el *ground truth* disponible es un **proxy inválido**
para lo que el detector detecta. Y la solución —cerrar el nivel más grave para
que sólo lo abra evidencia documental— es **defensa en profundidad** aplicada a
la interpretación: no basta advertir en el texto, hay que hacer que el estado
peligroso sea inalcanzable.

La analogía: un detector de humo y un informe de bomberos. Que el detector no
suene en un incendio provocado no significa que esté descalibrado — puede que el
incendio se declarara sin humo, o que el informe hable de un fuego que ya se
apagó. Son dos instrumentos que miden fenómenos distintos, y **conectarlos como
si uno validara al otro es el error**.

**Por qué esta tecnología y no otra:**

- **¿Por qué no bajar los umbrales hasta que la 122 quedara marcada?** Es lo que
  pedía la instrucción literal —"si no las marca, está mal calibrado"— y sería
  lo peor que se podía hacer: con |z| = 0.91, marcarla exige un corte que dejaría
  fuera de "normal" a un tercio de las secciones. Se habría destruido el detector
  para pasar una prueba que no era la prueba correcta.
- **¿Por qué no entrenar un modelo supervisado con las anuladas como
  positivos?** Es lo que uno haría con verdad-terreno de verdad. Imposible aquí:
  hay seis positivos, cinco sin datos. Un clasificador con n=1 aprende ruido.
- **¿Por qué la regla del rojo va en el pipeline y no en la interfaz?** Porque en
  la interfaz es una convención que alguien puede saltarse al escribir otra
  vista. En `verificar()` es una condición que rompe la corrida.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **no publicar la calibración** y presentar sólo el semáforo.
El detector funciona, los umbrales están bien fundados, y contar que el único
caso comprobable sale negativo sólo resta confianza. Se descartó porque esa
confianza sería falsa: quien use esta pantalla necesita saber que **no detecta
anulaciones jurídicas**, o va a interpretar un verde como que el Tribunal no
encontró nada. Las secciones 50, 68 y 78 están en verde por omisión — no tienen
datos — y sin la tabla de contraste eso se lee exactamente al revés.

La segunda alternativa era **fusionar los dos canales** en una sola puntuación
que sumara "estadística + documental". Se descartó porque haría irrecuperable la
distinción: un número compuesto no permite saber si una sección está señalada
por una sentencia firme o por tener el voto nulo dos puntos arriba de la
mediana, y esas dos cosas no se parecen en nada.

**Cómo lo dirías en una entrevista:**
> "Tenía tres sentencias judiciales como ground truth para calibrar un detector
> de anomalías electorales, y al comprobarlo el resultado fue negativo por dos
> motivos: cinco de las seis secciones anuladas no tienen datos —sus votos se
> eliminaron por la propia sentencia— y la única que queda es estadísticamente
> ordinaria. En vez de bajar los umbrales para que pasara la prueba, que habría
> destruido el detector, lo tomé como el hallazgo: la anulación jurídica es un
> proxy inválido para la anomalía estadística porque una casilla se anula por
> irregularidades de procedimiento, que no dejan huella en el reparto de votos.
> Rediseñé el sistema con dos canales separados y cerré el nivel más grave para
> que sólo lo pueda encender evidencia documental, con un assert en el pipeline
> en vez de una advertencia en el texto."

---

## 2026-08-18 — El procedimiento estándar no era el procedimiento

**El problema real:** Había que calcular el reparto de diputaciones de
representación proporcional del Congreso de Campeche. El procedimiento es
público y bien conocido: umbral del 3%, cociente natural, resto mayor. Lo
implementé así, marcando los parámetros como "sin verificar" porque no tenía el
texto de la ley local.

Cuando conseguí la ley, resultó que **el algoritmo estaba mal**, no los
parámetros. El artículo 573 fija un paso previo que ningún resumen del
"procedimiento estándar" menciona:

> *"todo aquel Partido Político que obtenga por lo menos el tres por ciento del
> total de la Votación Válida Emitida tendrá derecho a que se le asigne **un
> Diputado** por el principio de Representación Proporcional, independientemente
> de los triunfos de mayoría que hubiere obtenido. Realizada la distribución
> anterior, se procederá a asignar **el resto** de las diputaciones conforme a la
> fórmula"*

Primero una **asignación directa** de un escaño a cada partido sobre el umbral;
la fórmula sólo reparte lo que queda. Con 6 partidos sobre el 3%, eso significa
que el cociente natural se calcula sobre **8** diputaciones, no sobre 14 — y el
acuerdo del IEEC lo confirma con todas sus letras: *"esta cantidad se dividirá
entre 8 que es el número de diputaciones pendientes por asignar"*.

Lo peligroso del error: mi versión **producía un reparto plausible**. Sumaba 14,
respetaba el umbral, los partidos grandes salían arriba. Nada gritaba.

**La solución aplicada:** Leer la fuente primaria y reescribir el algoritmo en
el orden que fija la ley, con cada paso citando su artículo.

**Tecnología y librerías usadas:**

- **`pypdf`** — `pypdf.PdfReader(ruta)` abre un PDF y `.pages[i].extract_text()`
  devuelve el texto de cada página. Fue necesario instalarlo: la ley son 202
  páginas de PDF y no había ninguna herramienta de extracción en la máquina
  (`pdftotext`, `mutool`, `qpdf`: ninguno). Es Python puro y sin dependencias
  pesadas.
- **`re.sub(r'\s+', ' ', texto)`** — el paso que hace usable el texto extraído.
  Un PDF conserva saltos de línea y espacios de maquetación, así que una frase
  legal aparece partida; colapsarlo todo a espacios simples permite buscar
  `"tres por ciento de la votación"` y encontrarlo.
- **`str.find` + `str.rfind`** — para localizar un artículo, buscar la frase y
  retroceder hasta el `ARTÍCULO` anterior. Más simple y más robusto que una
  expresión regular que intente capturar artículos completos en un texto con
  encabezados repetidos en cada página.

**El proceso paso a paso:**

1. Extraer y aplanar:

```python
r = pypdf.PdfReader(ruta)
txt = "\n".join((pg.extract_text() or '') for pg in r.pages)
```

El `or ''` no sobra: una página que sólo tiene una imagen devuelve `None`, y sin
la guarda el `join` revienta a mitad de un documento de 202 páginas.

2. Quitar el encabezado que se repite en cada página, porque contamina toda
   búsqueda de contexto:

```python
t = re.sub(r'LEY DE INSTITUCIONES.{0,260}?REFORMA:\s*DECRETO 236, P\.O\. 1/JUN/2023 \d+ ', ' ', t)
```

El `.{0,260}?` es **no codicioso** (`?`): sin él, el `.` se comería el documento
entero hasta la última aparición de la fecha.

3. Y el algoritmo, reescrito en el orden de la ley
   ([build_diputaciones.py:244](backend/datalab/pipeline/build_diputaciones.py#L244)):

```python
    # Art. 573: una diputación directa a cada uno, antes de cualquier fórmula.
    directa = {p: 1 for p in con_derecho}
    pendientes = total_rp - len(directa)
    if pendientes < 0:
        raise SystemExit(
            f"Hay {len(directa)} partidos sobre el umbral y sólo {total_rp} "
            f"diputaciones de RP: la asignación directa no cabe. Ese caso lo "
            f"tiene que resolver la ley, no este script.")

    vee = sum(con_derecho.values())
    # Art. 571 + acuerdo CG/116/2024: el divisor son las PENDIENTES.
    cociente = vee / pendientes if pendientes else 0
```

La guarda de `pendientes < 0` cubre un caso que hoy no ocurre pero es
perfectamente posible: si 15 partidos superaran el 3% y sólo hay 14 escaños, la
asignación directa no cabe. El script no inventa un desempate — dice que eso lo
resuelve la ley.

4. Cada constante quedó con su artículo al lado, para que la próxima persona no
   tenga que volver al PDF:

```python
    "umbral_base": "Votación Válida Emitida",
    "articulo_umbral": 573,
    "cociente_base": "Votación Estatal Emitida",
    "cociente_divisor": "diputaciones pendientes tras la asignación directa",
    "articulos_formula": [570, 571, 572, 574],
```

Dos bases de votación **distintas** en el mismo procedimiento, definidas en el
art. 569: la del umbral deduce nulos y no registradas; la del cociente además
deduce a los partidos que no llegaron al 3%. Confundirlas cambia el resultado y
es un error invisible.

**El concepto con nombre:** **Primary source verification**. El error concreto
tiene nombre en ingeniería de datos: **implementar la especificación general en
lugar de la local**, primo hermano del *cargo cult programming* — copiar el
patrón que funciona en otro sitio sin comprobar que aplica aquí. En sistemas
legales o regulatorios se le llama **jurisdictional variance**: la regla general
existe, y cada jurisdicción la modifica.

La analogía: la propina. "En un restaurante se deja propina" es cierto en
general y falso en Japón, donde ofenderías. El procedimiento estándar de RP es
la regla general; el artículo 573 es lo que Campeche decidió hacer distinto.

**Por qué esta tecnología y no otra:**

- **¿Por qué `pypdf` y no un servicio de OCR?** El PDF tiene capa de texto —no
  es un escaneo— así que la extracción es directa y exacta. Un OCR introduciría
  errores de lectura en un documento donde un dígito mal leído cambia un
  resultado electoral. De hecho el resumen automático del PDF sí falló: leyó el
  cociente como **49,943** cuando el documento dice **49,678**. Lo detecté
  porque no cuadraba con VEE÷8; ésa es la razón de verificar la aritmética de
  todo lo que se transcribe.
- **¿Por qué instalar una dependencia, si el proyecto evita añadirlas?** Porque
  aquí no había alternativa razonable: la fuente primaria es un PDF y no había
  ninguna herramienta en la máquina. La regla del proyecto es no añadir
  dependencias para ahorrar tres líneas, no rechazarlas cuando resuelven algo
  que no se puede hacer de otro modo.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **seguir publicando el reparto como escenario** con los
parámetros marcados sin verificar, que era el estado anterior. Es honesto y era
lo correcto mientras no hubiera fuente. Pero un escenario que nadie va a
verificar nunca acaba leyéndose como resultado, y aquí existía un documento
público que lo resolvía: no buscarlo habría sido preferir la comodidad de la
advertencia sobre el trabajo de conseguir el dato.

La segunda alternativa, más sutil: **quedarme con la ley y no buscar el acuerdo
del IEEC**. Con la ley ya podía calcular bien. Se descartó porque un cálculo
propio, por correcto que sea, no es la fuente: el acuerdo es el acto de
autoridad que efectivamente integró el Congreso, e incluye resoluciones
judiciales que ningún cálculo sobre los cómputos originales puede reproducir.

**Cómo lo dirías en una entrevista:**
> "Implementé el reparto de escaños por representación proporcional con el
> procedimiento estándar —umbral, cociente natural, resto mayor— y lo marqué
> como no verificado. Al conseguir la ley local descubrí que el error estaba en
> el algoritmo, no en los parámetros: un artículo asigna primero un escaño
> directo a cada partido sobre el umbral, así que el cociente se calcula sobre
> las diputaciones restantes y no sobre el total. Mi versión producía un reparto
> plausible que sumaba correctamente, que es el peor tipo de error. Extraje el
> texto legal con `pypdf` y reescribí el algoritmo citando cada artículo en el
> código."

---

## 2026-08-18 — El mismo resultado con datos distintos: validar el algoritmo, no el dato

**El problema real:** Conseguí el acuerdo oficial del IEEC con el reparto real
de las 14 diputaciones. Con eso el cálculo propio parecía sobrar: si tengo la
respuesta oficial, ¿para qué calcular?

Pero al comparar las cifras de entrada apareció algo incómodo:

```
Votación Válida Emitida del acuerdo    419,632
la que sale de nuestros archivos       416,950
diferencia                               2,682
```

El acuerdo se emitió **después** de tres sentencias del Tribunal Electoral
(TEEC/JIN/DIP/1, 2 y 5/2024) que ordenaron recuentos. Nuestros archivos de
cómputo son previos. No son los mismos números y no hay forma de que lo sean.

La tentación es descartar el cálculo propio por "desactualizado". Y sería
desperdiciar la única oportunidad de comprobar que la implementación es
correcta.

**La solución aplicada:** Usar el desacuerdo en los insumos como **prueba**. Si
el algoritmo se aplica a datos distintos y produce **el mismo reparto**, lo que
queda demostrado es que el algoritmo está bien — porque el resultado no depende
de haber acertado los votos exactos.

Se publican los dos, con papeles explícitamente distintos:

- `oficial` — transcrito del acuerdo. **Es el dato que vale.**
- `calculo` — la misma fórmula sobre nuestros archivos. **Es una prueba, no un
  resultado.**

**Tecnología y librerías usadas:**

- **Comparación directa de diccionarios** (`==` en Python) — compara claves y
  valores en profundidad, así que `{'MC': 4, 'MORENA': 4} == {'MORENA': 4, 'MC': 4}`
  es `True`: el orden no importa. Es exactamente la semántica que se quiere para
  comparar dos repartos.
- **Operaciones de conjuntos** (`set(a) | set(b)`) — para recorrer la unión de
  ambos repartos y no perder un partido que aparezca en uno y no en el otro. Un
  bucle sobre las claves de uno solo escondería justo la diferencia que se busca.
- **`assert` en la autocomprobación** — la coincidencia se verifica en cada
  corrida, no una vez a mano.

**El proceso paso a paso:**

1. La comparación, con el porqué al lado
   ([build_diputaciones.py:347](backend/datalab/pipeline/build_diputaciones.py#L347)):

```python
    # COMPROBACIÓN CRUZADA: el algoritmo corre sobre nuestros archivos, que son
    # PREVIOS a las sentencias, así que las cifras de entrada no coinciden con
    # las del acuerdo. Lo que se compara es el REPARTO, no los votos: si sale
    # el mismo con datos distintos, la fórmula está bien implementada.
    coincide = calc["asignados"] == oficial_rp
    difs = {p: {"calculado": calc["asignados"].get(p, 0),
                "oficial": oficial_rp.get(p, 0)}
            for p in set(calc["asignados"]) | set(oficial_rp)
            if calc["asignados"].get(p, 0) != oficial_rp.get(p, 0)}
```

`difs` se construye aunque esté vacío: cuando algún día deje de coincidir, el
archivo dirá **qué partido y cuánto**, no sólo que falló.

2. La segunda comprobación, que resolvió un problema aparte: los cómputos dan
   los triunfos de mayoría **por bloque de coalición** y el acuerdo los da **por
   partido**. Comparar la suma valida las dos cosas a la vez:

```python
    shh = sum(oficial_mr.get(p, 0) for p in ("MORENA", "PT", "PVEM"))
```

Nuestro cálculo daba SHH 14; el acuerdo desglosa MORENA 12 + PT 1 + PVEM 1 = 14.
Coincide, y de paso el acuerdo aporta la atribución por partido que hacía falta
para la prueba de sobrerrepresentación — lo que antes estaba declarado como
`computable: False`.

3. Y las verificaciones de la **transcripción**, que son de otra naturaleza:
   comprueban que no copié mal un número del PDF.

```python
    suma = sum(x["votos"] for x in OFICIAL["partidos"].values()
               if x["votos"] / OFICIAL["votacion_valida_emitida"] * 100 >= 3.0)
    if suma != OFICIAL["votacion_estatal_emitida"]:
        raise SystemExit(...)

    esperado = round(OFICIAL["votacion_estatal_emitida"]
                     / OFICIAL["diputaciones_pendientes_tras_directa"])
    if abs(esperado - OFICIAL["cociente_natural"]) > 1:
        raise SystemExit(...)
```

La segunda atrapó un error real: el resumen automático del PDF había leído el
cociente como **49,943**, y 397,424÷8 da **49,678**. Sin esa comprobación, un
número mal transcrito se habría publicado como dato oficial.

**El concepto con nombre:** **Differential testing** — ejecutar dos
implementaciones independientes sobre el mismo problema y comparar salidas. La
variante de aquí es más fuerte: las entradas también difieren, así que lo que se
prueba es que el resultado es **robusto** a esa diferencia. También es un caso
de **reconciliation** contra una fuente autoritativa, como el cross-foot del
pipeline electoral, y de **oracle testing**: existe una respuesta correcta
conocida contra la cual medir.

La analogía: dos contadores cierran el mismo balance con libros distintos. Si
llegan a la misma cifra, la confianza no viene de ninguno de los dos por
separado — viene de que dos caminos independientes se encontraron.

**Por qué esta tecnología y no otra:**

- **¿Por qué no simplemente borrar el cálculo propio?** Porque entonces la
  transcripción del acuerdo no tendría nada que la respalde. Los 40 números
  copiados de un PDF a un diccionario de Python son un punto de fallo silencioso;
  el cálculo independiente es lo que los defiende.
- **¿Por qué comparar el reparto y no los votos?** Porque los votos **no pueden**
  coincidir: hay sentencias de por medio. Comparar lo que sí debería ser
  invariante —la asignación— es lo que hace la prueba informativa. Comparar los
  votos sólo mediría lo que ya sé: que mis archivos son anteriores.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **actualizar nuestros archivos con las cifras del acuerdo** y
así hacer que todo cuadrara. Se descartó porque nuestros archivos son la salida
de `build_electoral.py` sobre los cómputos originales: editarlos a mano rompería
la cadena entre el crudo y el dato publicado, que es el principio que sostiene
todo el proyecto. Los cómputos dicen lo que dicen; las sentencias son un hecho
posterior que se declara, no un motivo para reescribir la fuente.

La segunda alternativa era **publicar sólo el oficial**, sin comprobación. Es lo
que pedía el sentido común —"ya tienes el dato, úsalo"— y se descartó porque
habría dejado la implementación de la fórmula sin probar justo cuando existía la
única oportunidad de probarla contra una respuesta conocida. Esa fórmula va a
volver a usarse en 2027, cuando no haya acuerdo con el cual comparar.

**Cómo lo dirías en una entrevista:**
> "Conseguí el resultado oficial de una asignación de escaños, así que mi
> cálculo propio parecía redundante. Pero las cifras de entrada diferían —el
> acuerdo es posterior a unos recuentos ordenados por un tribunal— y aproveché
> eso: corrí mi algoritmo sobre los datos antiguos y produjo exactamente el
> mismo reparto. Es differential testing con entradas distintas, así que lo que
> quedó probado es que la fórmula es correcta con independencia de los votos
> exactos. Publiqué los dos con papeles distintos: el oficial como dato y el
> propio como prueba. Y añadí verificaciones aritméticas sobre la transcripción
> que detectaron un número mal leído del PDF."

---

## 2026-08-18 — Un venv copiado instala en el proyecto equivocado

**El problema real:** Al intentar instalar `pypdf` en el entorno del proyecto:

```
backend/datalab/venv/bin/pip install pypdf
```

El comando reportó éxito, y el import falló con `ModuleNotFoundError`. En el
mensaje de aviso de pip apareció la pista:

```
[notice] To update, run: /Users/.../EdgeNET/agroMayia/backend/datalab/venv/bin/python3.14 -m pip install --upgrade pip
```

**Estaba instalando en el venv de otro proyecto.** La causa:

```
$ head -1 backend/datalab/venv/bin/pip
#!/Users/.../EdgeNET/agroMayia/backend/datalab/venv/bin/python3.14

$ cat backend/datalab/venv/pyvenv.cfg
command = ... -m venv /Users/.../Desktop/PRIBrain/backend/datalab/venv
```

El venv se creó originalmente en un tercer proyecto (`PRIBrain`), se copió a
`agroMayia` y de ahí a éste. Los **scripts** de `bin/` llevan la ruta del
intérprete escrita en su primera línea (el *shebang*), y copiar la carpeta no la
reescribe. El binario `python` sí funcionaba —resuelve su prefijo por su propia
ubicación— pero `pip`, que es un script de texto, seguía apuntando al de
`agroMayia`.

**La solución aplicada:** Invocar pip como módulo del intérprete correcto:

```
backend/datalab/venv/bin/python -m pip install pypdf
```

Así el que decide dónde instalar es el `python` que se invocó, no un shebang
escrito hace tres proyectos.

**Tecnología y librerías usadas:**

- **`python -m modulo`** — ejecuta un módulo instalado como si fuera un script,
  usando el intérprete con el que se invoca. Es lo que desacopla la ejecución
  del shebang.
- **`head -1`** sobre un script de `bin/` — la forma más rápida de ver a qué
  intérprete apunta realmente.
- **`sys.prefix`** — `python -c "import sys; print(sys.prefix)"` dice en qué
  entorno se está ejecutando de verdad. Fue lo que confirmó que el `python` sí
  estaba bien y el problema era sólo de `pip`.
- **`pyvenv.cfg`** — el archivo que deja constancia de con qué comando y en qué
  ruta se creó el venv. Es donde apareció el rastro de `PRIBrain`.

**El proceso paso a paso:**

```bash
# 1. El síntoma: instala "bien" y no aparece
backend/datalab/venv/bin/pip install pypdf   # ok
backend/datalab/venv/bin/python -c "import pypdf"   # ModuleNotFoundError

# 2. ¿El python está bien?
backend/datalab/venv/bin/python -c "import sys; print(sys.prefix)"
#  -> .../CerebroElectoral/backend/datalab/venv     correcto

# 3. ¿Y pip?
head -1 backend/datalab/venv/bin/pip
#  -> #!/Users/.../agroMayia/backend/datalab/venv/bin/python3.14   ahí está

# 4. El arreglo
backend/datalab/venv/bin/python -m pip install pypdf
```

**El concepto con nombre:** Los venvs **no son relocalizables** — es una
propiedad conocida y documentada de `venv`. Los scripts de `bin/` contienen
rutas absolutas en su shebang, así que copiar o mover el entorno los deja
apuntando al origen. Es un caso particular de **hardcoded absolute paths** y de
**entorno no reproducible**: el estado del venv no está descrito por ningún
archivo versionado, sino por lo que quedó dentro de la carpeta.

La analogía: mudarte de casa y reenviar el correo a la dirección vieja. Tú
estás en la casa nueva, pero los sobres siguen llegando donde ya no vives.

**Por qué esta tecnología y no otra:**

- **¿Por qué no reparar los shebangs con `sed`?** Funciona y arregla el síntoma
  de hoy. `python -m pip` es inmune al problema **siempre**, sin depender de que
  alguien recuerde reparar. Un arreglo que no hay que repetir gana a uno que sí.
- **¿Por qué no recrear el venv desde cero?** Es lo correcto a fondo, y hay que
  hacerlo. No se hizo en el momento porque habría reinstalado numpy, openpyxl y
  el resto en mitad de otra tarea; queda anotado como deuda en `CONTEXTO.md`.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa de fondo es **no versionar ni copiar venvs nunca, y describir el
entorno en un `requirements.txt`**. Es lo estándar y es lo que hay que hacer:
un venv es un artefacto de construcción, no código fuente. Se anota como deuda
porque este proyecto arrastra el venv copiado desde antes, y cambiarlo ahora
tocaría los seis pipelines a la vez.

**Cómo lo dirías en una entrevista:**
> "Un `pip install` reportaba éxito y el paquete no aparecía. El venv se había
> copiado de otro proyecto y los scripts de `bin/` conservan la ruta absoluta
> del intérprete en el shebang, así que `pip` instalaba en el entorno original
> mientras `python` —que resuelve su prefijo por ubicación— funcionaba bien. Lo
> resolví usando `python -m pip`, que es inmune al problema porque el intérprete
> lo decide la invocación. Los venvs no son relocalizables; lo correcto es
> describir el entorno con un requirements y no copiarlo."

---

## 2026-08-18 — Un umbral inventado convierte un dato en una opinión

**El problema real:** El margen de victoria ya estaba calculado por el pipeline
para los 13 municipios. Pero un margen es un número, y lo que hace falta para
operar es una lectura: *¿este municipio está en juego o no?* Eso exige un
umbral, y el umbral es donde se cuela la arbitrariedad.

La salida fácil es el número redondo: "menos de 10 puntos es competitivo". Suena
razonable y no lo sostiene nada. Y una vez pintado en el mapa, ese 10 deja de
verse como una decisión de quien programó y empieza a leerse como una propiedad
del municipio — el dato duro del margen le presta credibilidad a la
clasificación inventada que lo envuelve.

**La solución aplicada:** Anclar el umbral a algo medido. Dos pasos:

1. Traducir el margen a la pregunta operativa. Para voltear un resultado no hace
   falta mover el margen entero, sino **la mitad**: cada voto que cambia de manos
   resta a uno y suma al otro. Con 9 pp de margen, un desplazamiento de 4.5 pp
   empata la elección.

2. Comparar ese desplazamiento contra **cuánto se mueve el electorado en la
   práctica**, que es justo lo que la Fase 4 midió del tracking: σ = 4.5 pp.

```
swing necesario ≤ 1σ  →  En riesgo   (margen ≤ 2σ =  9 pp)
swing necesario ≤ 2σ  →  Vigilar     (margen ≤ 4σ = 18 pp)
más                   →  Seguro
```

El umbral deja de ser una opinión: dice "está en riesgo el municipio que se
voltea con un movimiento del tamaño de los que hemos observado".

**Tecnología y librerías usadas:**

- **JavaScript vanilla**, en el módulo `electoral.js` que ya es la única puerta a
  los resultados. Sin librería: la lógica es una división y dos comparaciones;
  lo que cuesta es el criterio, no el código.
- **Parámetro con valor por defecto** (`sigma || SIGMA_POR_DEFECTO`) — el patrón
  que permite que la función sirva tanto si las encuestas están cargadas como si
  no, sin que quien la llama tenga que saberlo.
- **El mecanismo de variables categóricas de `mapa.js`** (`categorias: {...}`),
  que ya existía para "quién ganó". No hubo que construir nada: una clasificación
  no va en rampa secuencial porque sus clases no están ordenadas en una escala.

**El proceso paso a paso:**

1. La traducción del margen a swing
   ([electoral.js:175](frontend/js/electoral.js#L175)):

```javascript
  /** Puntos que tendrían que desplazarse para que cambie el ganador. */
  function swingNecesario(margen) {
    return margen / 2;
  }
```

Dos líneas, y es la mitad conceptual del trabajo. Sin ellas se compararía el
margen contra σ directamente, que es comparar peras con manzanas: el margen es
una diferencia entre dos fuerzas, σ es cuánto se mueve una.

2. La clasificación, con σ inyectado
   ([electoral.js:180](frontend/js/electoral.js#L180)):

```javascript
  function competitividad(margen, sigma) {
    const s = sigma || SIGMA_POR_DEFECTO;
    const swing = swingNecesario(margen);
    if (swing <= s) return 'riesgo';
    if (swing <= 2 * s) return 'vigilar';
    return 'seguro';
  }
```

`sigma` entra como parámetro y no se lee de un global: así la misma función
sirve para el σ de hoy, para el que salga cuando llegue más tracking, y para
probar el comportamiento con valores extremos sin tocar nada.

3. Los cortes se pueden imprimir, no sólo aplicar
   ([electoral.js:189](frontend/js/electoral.js#L189)):

```javascript
  function umbrales(sigma) {
    const s = sigma || SIGMA_POR_DEFECTO;
    return { sigma: s, riesgo: 2 * s, vigilar: 4 * s };
  }
```

Existe para que la interfaz pueda decir "en riesgo = margen ≤ 9 pp" en vez de
clasificar sin explicar. Un umbral que no se puede enseñar es un umbral que
nadie puede discutir.

4. Y la comprobación de sanidad, que es lo que da confianza en que el criterio
   no se fue por la borda: los cortes caen en **9 y 18**, cerca del 5/10/20 que
   usa la literatura electoral (Cook Political Report y similares). **Que
   coincidan es confirmación, no el origen** — si hubieran salido en 2 y 40,
   habría que revisar el razonamiento, no forzar el resultado.

5. Los límites del criterio, escritos en el código y no en la cabeza de nadie:

```
   1. σ se midió sobre el reparto ESTATAL. Un municipio chico se mueve más
      que el estado, así que aplicárselo tal cual es conservador: puede
      clasificar como "seguro" algo que localmente no lo es.
   2. Es competitividad de 2024, no un pronóstico de 2027. Dice dónde estuvo
      cerca la última vez, no dónde va a estar cerca la próxima.
```

**El concepto con nombre:** **Data-driven thresholding** frente a *magic
numbers*. En estadística la operación concreta es **estandarizar**: expresar una
cantidad en unidades de su propia dispersión (un z-score es exactamente eso), lo
que la vuelve comparable e interpretable. El error que se evita es la
**precisión espuria por asociación**: envolver un dato medido en una
clasificación inventada, de modo que la clasificación herede la credibilidad del
dato.

La analogía: "hace frío" no significa nada hasta que dices dónde. 15 °C es frío
en Mérida y templado en Toluca. El umbral útil no es un número absoluto sino uno
expresado en desviaciones respecto de lo normal *de ese lugar* — que es
literalmente lo que hace este criterio con el electorado de Campeche.

**Por qué esta tecnología y no otra:**

- **¿Por qué no clustering (k-means, Jenks natural breaks) sobre los 13
  márgenes?** Es la alternativa técnica seria: dejar que los datos encuentren
  sus propios cortes. Se descartó porque produce umbrales que **cambian cuando
  cambian los datos** — al llegar 2027, "competitivo" significaría otra cosa y
  las dos ediciones no serían comparables. Además, con 13 observaciones un
  k-means encuentra grupos en cualquier ruido. El criterio tiene que venir de
  fuera de la muestra que clasifica.
- **¿Por qué σ y no el margen de error de la encuesta (±3.8)?** Porque miden
  cosas distintas: el margen de error es la incertidumbre de *medir hoy*; σ es
  cuánto se *mueve* el electorado entre hoy y la elección. Para preguntar si un
  municipio puede voltearse, lo que importa es el movimiento, no la precisión
  del termómetro.
- **¿Por qué categórica y no una rampa continua de color?** Porque "en riesgo" y
  "seguro" no están en una escala: son decisiones operativas distintas. Una
  rampa sugeriría que hay un continuo donde hay un corte, y el corte es
  precisamente el producto.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **no clasificar**: enseñar el margen y que cada quien
decida. Es defendible y más conservadora. Se descartó porque el margen crudo
no es accionable sin traducción — 9 pp no le dice nada a quien tiene que decidir
dónde poner representantes — y porque la traducción se iba a hacer igual, sólo
que en la cabeza de cada usuario, con un umbral distinto cada vez y ninguno
escrito. Es mejor un criterio explícito y discutible que trece criterios
implícitos.

La segunda alternativa era **hardcodear 5/10/20** citando la literatura. Habría
dado casi los mismos grupos y habría sido más rápido. Se descartó porque esos
cortes vienen de elecciones presidenciales de Estados Unidos, con otro sistema,
otra volatilidad y otro electorado. Coincidir con ellos está bien; heredarlos
sin preguntarse por qué, no.

**Cómo lo dirías en una entrevista:**
> "Tenía que clasificar municipios como competitivos o seguros a partir del
> margen de victoria, y en vez de elegir un umbral redondo lo anclé a algo
> medido. Primero traduje el margen al desplazamiento que haría falta para
> voltear el resultado, que es la mitad del margen; luego comparé ese
> desplazamiento contra la volatilidad real del electorado, que había estimado
> del tracking de encuestas. Los cortes quedaron en unidades de σ, así que el
> criterio se puede defender y se actualiza solo cuando llegan más datos.
> Descarté clustering porque los umbrales cambiarían con cada elección y las
> ediciones dejarían de ser comparables."

---

## 2026-08-18 — Si la única diferencia es el color, el mapa no funciona para todos

**El problema real:** Tres capas de distrito —federal, local y judicial— se
podían encender por separado en el mapa, pero en el código todas compartían el
mismo estilo:

```javascript
        style: () => ({
          color: token('--mapa-limite'),
          weight: 1.5,
          fillColor: token('--mapa-limite'),
          fillOpacity: 0.05,
        }),
```

Con federal y local encendidos a la vez, el mapa dibujaba dos rejillas idénticas
superpuestas. No era un problema estético: la información existía (dos capas
distintas, cargadas correctamente) y era **imposible de leer**. Un dato que no se
puede distinguir del de al lado no está publicado.

**La solución aplicada:** Cada capa declara su trazo, y la diferencia va por
**dos canales a la vez**: color y forma. El color sale de la paleta de series
que ya existía; la forma, del patrón de guion.

**Tecnología y librerías usadas:**

- **`dashArray`** de Leaflet (que es el atributo SVG `stroke-dasharray`) — una
  cadena `"5,4"` significa 5 px de línea y 4 de hueco. `null` deja la línea
  sólida. Es el canal visual que funciona en escala de grises.
- **Custom properties de CSS** leídas desde JS con `getPropertyValue` — el mapa
  no define colores, los lee de `colors.css`. Ya era la convención del proyecto;
  aquí sólo se extendió a un token por capa.
- **`border-top` en un `<span>` de 14 px** — el truco para dibujar la muestra
  del trazo en el panel de capas. Un borde hereda grosor y patrón (`solid` /
  `dashed`) sin necesidad de SVG ni de un canvas.

**El proceso paso a paso:**

1. El estilo pasa a leerse de la capa
   ([mapa.js:498](frontend/js/mapa.js#L498)):

```javascript
      const tr = capa.trazo || {};
      const linea = token(tr.color || '--mapa-limite');
      return L.geoJSON(json, {
        style: () => ({
          color: linea,
          weight: tr.grosor || 1.5,
          // El guion distingue por FORMA, no sólo por color: dos capas
          // encendidas se separan aunque el usuario no distinga los tonos.
          dashArray: tr.guion || null,
          fillColor: linea,
          fillOpacity: tr.relleno === undefined ? 0.05 : tr.relleno,
        }),
```

El `|| '--mapa-limite'` mantiene el comportamiento anterior para las capas que
no declaran trazo: municipios, localidades y AGEB siguen exactamente igual. Un
cambio que rompe lo que ya funcionaba para arreglar otra cosa no es un arreglo.

Y `tr.relleno === undefined ? 0.05 : tr.relleno` en vez de `tr.relleno || 0.05`:
con `||`, un relleno de **0** —que es justo lo que quiere la capa judicial, que
cubre el estado entero— se trataría como ausente y se sustituiría por 0.05. Es
el clásico bug de confundir "cero" con "no especificado", el mismo que en el
pipeline del Censo distinguía un `*` de un `0`.

2. La asignación por capa, con el criterio escrito:

```javascript
          // Los 2 federales son la división más gruesa: línea sólida y ancha.
          trazo: { color: '--serie-3', grosor: 3, relleno: 0.04 },
          ...
          // 21 locales: la rejilla más fina, en guion corto para que no compita
          // con el trazo federal cuando ambos están encendidos.
          trazo: { color: '--serie-4', grosor: 1.5, guion: '5,4', relleno: 0.03 },
          ...
          // Uno solo, y cubre el estado entero: guion largo y sin relleno, para
          // que no tape lo que hay debajo.
          trazo: { color: '--serie-6', grosor: 2, guion: '12,6', relleno: 0 },
```

El grosor sigue la jerarquía territorial: 2 distritos federales son la división
gruesa, 21 locales la rejilla fina. No es decoración — reproduce visualmente la
relación de contención que existe en el dato.

3. Y el panel de capas pasa a ser la leyenda
   ([mapa.js:795](frontend/js/mapa.js#L795)):

```javascript
          const muestra = c.trazo
            ? `<span class="mapa-panel__trazo" aria-hidden="true" style="
                 border-top:${c.trazo.grosor || 1.5}px ${
                   c.trazo.guion ? 'dashed' : 'solid'} var(${c.trazo.color})"></span>`
            : '';
```

`aria-hidden="true"` porque es pura decoración: el nombre de la capa ya está en
el `<label>`, y un lector de pantalla no debe anunciar un adorno. La muestra
sirve a quien mira, no estorba a quien escucha.

**El concepto con nombre:** **Redundant encoding** (codificación redundante) —
transmitir la misma distinción por más de un canal visual. Es una de las reglas
básicas de visualización de datos y de accesibilidad: el criterio **"no confíes
sólo en el color"** es literalmente el punto 1.4.1 de las WCAG. El canal
adicional aquí es la forma (sólido / guion corto / guion largo), que sobrevive a
la daltonía, a un proyector malo y a una impresión en blanco y negro.

La analogía: los semáforos. El rojo está arriba y el verde abajo **siempre**, no
por casualidad: quien no distingue los dos colores lee la posición. La
información va por dos canales porque uno solo falla para parte de la gente.

**Por qué esta tecnología y no otra:**

- **¿Por qué `dashArray` y no opacidades distintas?** La opacidad es una
  variación del mismo canal (color) y se pierde en cuanto hay algo debajo. El
  guion es una diferencia **categórica**, que es lo que corresponde: federal y
  local no están ordenados en una escala, son cosas distintas.
- **¿Por qué `--serie-*` y no `--escala-*`?** Los tokens de escala son una rampa
  secuencial —van de oscuro a claro— y usarlos sugeriría que una capa "vale
  más" que otra. La paleta de series existe precisamente para categorías sin
  orden. Elegir el token correcto es parte de no mentir con el color.
- **¿Por qué no un `<canvas>` o un SVG para la muestra del panel?** Un
  `border-top` sobre un span de 14 px reproduce grosor y patrón con una línea de
  CSS. Cualquier otra cosa sería construir un renderizador para dibujar una
  raya.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **permitir sólo una capa de distrito encendida a la vez**,
como botones de radio. Resuelve la ambigüedad por eliminación y es menos código.
Se descartó porque destruye el caso de uso que da valor a tener las tres:
**verlas juntas** es lo que permite ver que un municipio queda partido entre dos
distritos locales, o que la frontera federal no coincide con ninguna otra. La
superposición no era el problema; la indistinguibilidad sí.

La segunda alternativa era **poner sólo colores distintos** y dejarlo ahí. Habría
resuelto el 90% de los casos con la mitad del trabajo. Se descartó porque el
10% restante son las personas que no distinguen esos colores, y porque un mapa
electoral se acaba proyectando en una sala con un cañón viejo o imprimiéndose en
blanco y negro. El canal de forma cuesta un atributo y no se pierde nunca.

**Cómo lo dirías en una entrevista:**
> "Tres capas geográficas se podían encender a la vez pero compartían estilo, así
> que superpuestas eran indistinguibles: la información estaba cargada y era
> ilegible. Le di a cada una su trazo usando la paleta categórica que ya existía
> —no una secuencial, porque no están ordenadas— y añadí patrón de guion además
> del color, que es codificación redundante: la distinción sobrevive a la
> daltonía y al blanco y negro. También convertí el panel de capas en leyenda,
> replicando el trazo con un `border-top`. Y cuidé que las capas sin estilo
> propio siguieran exactamente igual que antes."

---

## 2026-08-18 — La serie se movía, pero el movimiento era ruido de muestreo

**El problema real:** Llegaron 19 meses de tracking de intención de voto —los
insumos que le faltaban al modelo— con la instrucción de calcular "la desviación
estándar real de la serie" y usarla para sustituir el σ supuesto. La desviación
sale directa:

```
morena  sd = 1.57      mc  sd = 1.90      pri  sd = 0.99
```

Y usar ese 1.57 habría sido un error. Cada mes es una **muestra distinta de
1,000 personas**, así que lo que se mueve entre meses tiene dos componentes:
cambio de opinión real, y error de muestreo. Con la MoE que declara la propia
casa (±3.8%), una fuerza en 38% tiene un error estándar de **1.88 pp** — *más
grande que toda la desviación observada de Morena en 19 meses*.

Dicho de otro modo: **la serie del líder es indistinguible de una línea plana.**
Alimentar el modelo con ese 1.57 habría sido alimentarlo con ruido, presentado
como medición.

**La solución aplicada:** Descomponer la varianza antes de usarla. La observada
es la suma de la real y la de muestreo, así que la real se despeja restando:

```
var_real = var_observada − var_muestreo
```

Y cuando el resultado sale negativo —que es lo que pasa con Morena— la respuesta
no es un número pequeño: es **cero**, "no se distingue de plano".

**Tecnología y librerías usadas:**

- **`statistics`** (estándar de Python) — `statistics.variance(datos)` da la
  varianza **muestral** (denominador n−1), que es la correcta para una serie
  observada; `statistics.stdev` y `statistics.mean` para lo demás. Para 19 datos
  no hace falta numpy.
- **`csv.DictReader`** — la serie viene en CSV de 8 columnas.
- **`math.sqrt`** — de varianza a desviación.
- **numpy** sólo se importa para el resto del pipeline; esta parte es
  aritmética simple y no la necesita.

**El proceso paso a paso:**

1. Calcular el error de muestreo con la escala que declara la propia casa
   ([build_encuestas.py:136](backend/datalab/pipeline/build_encuestas.py#L136)):

```python
def deff():
    """Efecto de diseño implícito en la MoE declarada.

    La casa declara ±3.8% con n=1,000. El muestreo aleatorio simple daría
    ±3.10% en p=0.5. La razón al cuadrado es el efecto de diseño."""
    moe_srs = Z * math.sqrt(0.25 / MUESTRA) * 100
    return (MOE_DECLARADA / moe_srs) ** 2
```

Detalle que importa: la MoE declarada es **peor** que la teórica (±3.8 contra
±3.10), lo que implica un **efecto de diseño de 1.50**. Usar la fórmula teórica
optimista habría subestimado el ruido y hecho aparecer señal donde no la hay. Se
usa la que la casa declara.

2. La descomposición
   ([build_encuestas.py:160](backend/datalab/pipeline/build_encuestas.py#L160)):

```python
def descomponer(serie, media):
    """Separa el movimiento real del ruido de muestreo.

        var_observada = var_real + var_muestreo

    Si la observada no supera a la de muestreo, la serie es indistinguible de
    una línea plana: se devuelve 0, no un número pequeño que aparente señal."""
    var_obs = statistics.variance(serie)
    var_mue = error_estandar(media) ** 2
    var_real = var_obs - var_mue
    return {
        "sd_observada": round(math.sqrt(var_obs), 2),
        "sd_muestreo": round(math.sqrt(var_mue), 2),
        "sd_real": round(math.sqrt(var_real), 2) if var_real > 0 else 0.0,
        "hay_senal": bool(var_real > 0 and math.sqrt(var_real) > 0.5),
    }
```

El `if var_real > 0 else 0.0` es la línea que evita el `math domain error` de
sacar raíz de un negativo, sí — pero sobre todo es la que **traduce el negativo
a su significado**: no hay señal detectable. Un negativo en una varianza no es
un error de cálculo, es un resultado.

Resultado sobre las 8 categorías:

| fuerza | sd obs | sd muestreo | **sd real** | lectura |
|---|---|---|---|---|
| morena | 1.57 | 1.88 | **0.00** | todo es ruido |
| mc | 1.90 | 1.74 | **0.76** | señal |
| pan | 1.11 | 0.69 | **0.87** | señal |
| pri | 0.99 | 0.82 | **0.55** | señal |
| pvem | 0.71 | 0.68 | **0.23** | marginal |
| pt | 0.58 | 0.65 | **0.00** | todo es ruido |
| no_decide | 3.44 | 1.41 | **3.14** | la que más se mueve |

3. Entonces, ¿de dónde sale el σ del modelo? De lo que **sí** es señal: la
   **deriva**. Comparar los primeros tres meses contra los últimos tres cancela
   buena parte del ruido —promediar tres muestras divide su error entre √3— y
   deja el movimiento sistemático:

```
morena  38.40 → 35.03  = −3.37 pp en 18 meses
mc      24.90 → 28.73  = +3.83 pp en 18 meses
```

Eso es señal clara: 3.4 pp está muy por encima del error de un promedio de tres
meses. Y se cruza con dos estimaciones más
([build_encuestas.py:194](backend/datalab/pipeline/build_encuestas.py#L194)):

```
deriva del líder en 18 meses          4.70 pp
caminata aleatoria a 11 meses         5.15 pp
distancia entre 2024 y la encuesta    3.52 pp
────────────────────────────────────────────
σ recomendada (promedio)               4.5 pp
```

4. Y una comprobación del propio método que salió mal y hubo que declarar: la σ
   del **cambio mensual** observado (1.55 pp) es *menor* que la que produciría el
   solo error de muestreo entre dos muestras independientes (≈2.7 pp). Eso es
   imposible si los meses fueran muestras independientes — **sugiere que la serie
   publicada viene suavizada**. Por eso la caminata aleatoria se reporta como
   referencia y la estimación principal es la deriva, que no depende de ese
   supuesto.

5. Las comprobaciones fijan el comportamiento, no los valores:

```python
    # Una serie plana no puede producir señal.
    plana = descomponer([40.0] * 19, 40.0)
    assert plana["sd_real"] == 0.0 and not plana["hay_senal"]

    # Morena es el caso que motivó todo esto: su serie es ruido.
    assert fuerzas["morena"]["sd_real"] == 0.0, fuerzas["morena"]
```

**El concepto con nombre:** **Variance decomposition** aplicada a separar
**señal de ruido de medición**. En psicometría y en teoría de la medición es la
distinción entre *varianza verdadera* y *varianza de error*, y su cociente es la
**fiabilidad** de la serie. En encuestas electorales el error concreto que se
evita tiene nombre propio: **overinterpreting noise** o *reading the tea leaves*
— narrar como cambio político un movimiento de 1.5 puntos que cabe entero dentro
del margen de error. Es lo que hacen los titulares de "el partido X sube dos
puntos" cada mes.

La analogía: pesarte cada mañana en una báscula con ±1 kg de precisión. Vas a
ver la cifra subir y bajar todos los días, y ninguno de esos movimientos es
grasa: es la báscula. Para saber si de verdad cambiaste hay que mirar la
tendencia de varias semanas, que es exactamente lo que hace la deriva.

**Por qué esta tecnología y no otra:**

- **¿Por qué no un filtro de Kalman o un modelo de espacio de estados?** Es la
  herramienta canónica para separar señal de ruido en una serie temporal, y
  daría una estimación del nivel latente mes a mes en vez de un único número. Se
  descartó por proporción: son **19 puntos y una sola casa encuestadora**. Un
  Kalman sobre 19 observaciones tiene más parámetros que ajustar que
  información para ajustarlos, y su resultado dependería casi por completo de
  los priors que yo eligiera — el mismo problema del σ supuesto, con más
  matemáticas encima para disimularlo.
- **¿Por qué `statistics` y no numpy?** Son 19 números por columna. `numpy` ya
  está en el venv y se usa en el pipeline de proyección, pero para esta
  aritmética la estándar es igual de correcta y se lee mejor. Ojo con el detalle
  que sí importa: `statistics.variance` usa n−1 (muestral) y
  `numpy.var` usa n (poblacional) **por defecto** — hay que pasarle `ddof=1`.
  Mezclarlos sin darse cuenta subestima la dispersión.
- **¿Por qué el efecto de diseño declarado y no el teórico?** Porque la casa
  sabe cómo levantó su muestra y yo no. Su ±3.8% incorpora el diseño real; mi
  ±3.10% teórico supone un muestreo aleatorio simple perfecto que nadie logra
  por teléfono. Usar el optimista habría inflado la señal detectada en todas las
  fuerzas.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa —la que pedía literalmente la instrucción— era **usar la
desviación de la serie tal cual**: `sd(morena) = 1.57`, listo. Se descartó
porque para el líder ese número es **enteramente error de muestreo**, y habría
producido un modelo con intervalos artificialmente estrechos: con σ=1.57 la
probabilidad de victoria del favorito sale prácticamente en 100%, una certeza
fabricada a partir de ruido. Es el peor resultado posible: más falso que el
supuesto que venía a reemplazar, y con apariencia de estar medido.

La segunda alternativa era **repartir a los indecisos** entre partidos
proporcionalmente, que es práctica común. Se descartó porque `no_decide` es la
categoría con **más movimiento real de todas** (sd real 3.14, va de 8.9% a
20.7%): repartirlos proporcionalmente asume que se distribuyen como los ya
decididos, que es justo lo que nadie sabe. Se excluyen del denominador —voto
efectivo, marcado como Cálculo— y se publican aparte con su propia serie.

**Cómo lo dirías en una entrevista:**
> "Me pidieron calcular la desviación estándar de una serie de tracking para
> alimentar un modelo. La desviación cruda del líder era 1.57 puntos, pero cada
> mes es una muestra de 1,000 personas: descompuse la varianza observada en
> varianza real más varianza de muestreo, usando el efecto de diseño implícito
> en el margen de error que declara la casa, y resultó que el error de muestreo
> esperado era 1.88 — mayor que toda la variación observada. La serie del líder
> era indistinguible de una línea plana. Usar ese 1.57 habría producido
> intervalos falsamente estrechos y una certeza fabricada con ruido. Lo que sí
> es señal es la deriva de 18 meses, que promediando tres meses en cada extremo
> cancela buena parte del error, y la crucé con dos estimaciones más para
> converger en el parámetro final."

---

## 2026-08-18 — Monte Carlo con n=1: cuando la dispersión es un supuesto, no una estimación

**El problema real:** La fase pedía sustituir los rangos fijos de la proyección
2027 por una simulación de Monte Carlo con "participación histórica + encuestas
+ margen de error". Al buscar esos insumos en el repositorio:

| insumo | ¿existe? |
|---|---|
| Resultado 2024 por bloque | **sí** — cómputos del IEEC |
| Resultado 2021 de gubernatura | **sí** — capturado |
| Participación 2024 | **sí** — 62.44%, calculada |
| Encuestas | **no** — `encuestas.html` es estática, sin `fetch` ni datos |
| Participación 2021 | **no** — no está capturada |
| Margen de error de encuesta | **no** — depende de las encuestas que no hay |

Quedan **dos observaciones electorales**. Y ahí está el problema de fondo: en un
Monte Carlo, la media sale del dato, pero la **dispersión** —cuánto puede
moverse el electorado de aquí a 2027— hay que sacarla de algún lado. El único
cambio observado es 2021→2024:

```
SHH      33.20 → 46.51  = +13.31 pp
MC       31.50 → 30.55  =  −0.95 pp
PRI-PRD  30.80 → 12.50  = −18.30 pp
```

**Una transición. n = 1.** Una varianza se estima con una muestra, y una muestra
de tamaño uno no tiene dispersión. Cualquier σ que se use es un **supuesto**.

Ésta es la trampa que la propia fase advertía ("un Monte Carlo sobre datos flojos
da un intervalo de confianza falso"), y es peor de lo que suena: el resultado de
una simulación **parece** medido. Sale con percentiles, desviación estándar e
intervalo de confianza — todo el aparato de la estadística inferencial aplicado
a un número que alguien eligió a ojo.

**La solución aplicada:** No esconder el supuesto: **exponerlo y medir cuánto
depende de él la conclusión.** Tres decisiones:

1. σ es una constante con nombre (`SIGMA_LIDER`), no un número enterrado.
2. Se dice en el archivo de salida que el anclaje vale n=1.
3. Se publica un **barrido de sensibilidad**: el mismo modelo corrido con cinco
   σ distintos. Si la conclusión se mueve mucho, el modelo está diciendo "no sé",
   y eso tiene que verse en pantalla.

El barrido resultó ser lo más informativo de toda la fase:

```
σ =  4 pp → SHH 98.8%    σ = 11 pp → SHH 78.9%
σ =  6 pp → SHH 93.6%    σ = 13 pp → SHH 74.1%
σ =  8 pp → SHH 87.3%  (publicado)
```

**24.7 puntos de rango en la probabilidad de victoria, y ni uno solo viene del
dato.** Vienen de cuánto se supone que puede moverse el electorado en tres años.

**Tecnología y librerías usadas:**

- **`numpy`** (2.5.1, ya instalado en el venv) —
  `np.random.default_rng(semilla)` crea un **Generator**, la API moderna de
  aleatoriedad de numpy: reemplaza a `np.random.seed()` global, que era estado
  compartido y hacía que dos partes del programa se pisaran las semillas.
- **`rng.dirichlet(alpha, n)`** — muestrea de una distribución **Dirichlet**, que
  es la distribución natural de un *reparto*: cada muestra es un vector cuyas
  componentes suman 1 por construcción. Con `alpha` de 6 componentes y
  `n=100_000` devuelve una matriz de 100,000 × 6 en una llamada.
- **`matriz.argmax(axis=1)`** — el índice del máximo de cada fila, o sea **quién
  ganó en cada una de las 100,000 elecciones simuladas**. Vectorizado: una
  llamada en vez de un bucle de 100,000 iteraciones.
- **`(ganador == i).mean()`** — la fracción de iteraciones que ganó el bloque
  `i`. En numpy, comparar un array contra un escalar da un array de booleanos, y
  la media de booleanos es la proporción de `True`. Es la probabilidad de
  victoria en una línea.
- **`np.percentile(col, [5, 50, 95])`** y **`col.std(ddof=1)`** — los
  percentiles y la desviación muestral. El **`ddof=1`** es el denominador n−1 de
  Bessel: para una *muestra* (que es lo que produce una simulación) es lo
  correcto; con `ddof=0` se subestima la dispersión.

**El proceso paso a paso:**

1. Traducir "σ en puntos porcentuales" al parámetro de la Dirichlet
   ([build_proyeccion.py:153](backend/datalab/pipeline/build_proyeccion.py#L153)):

```python
def concentracion(base, sigma_pp):
    """Para Dirichlet(κ·p), la varianza de cada componente es
        Var(pᵢ) = pᵢ(1-pᵢ) / (κ+1)
    Se despeja κ para que el bloque más grande tenga la σ pedida."""
    p = float(base[0])
    var = (sigma_pp / 100.0) ** 2
    return p * (1 - p) / var - 1
```

La Dirichlet no se parametriza por desviación estándar sino por *concentración*.
Esta función es el puente entre lo que un humano puede juzgar ("el líder puede
moverse ±8 puntos") y lo que la distribución necesita (κ = 37.87).

2. La simulación entera, sin un solo bucle sobre iteraciones
   ([build_proyeccion.py:173](backend/datalab/pipeline/build_proyeccion.py#L173)):

```python
    rng = np.random.default_rng(semilla)
    muestras = rng.dirichlet(kappa * base, iteraciones) * 100.0

    # El ganador de cada iteración: el índice del máximo de esa fila.
    ganador = muestras.argmax(axis=1)
```

Dos líneas producen 100,000 elecciones completas. En Python puro serían 100,000
× 6 muestreos de una Gamma más la normalización — minutos en vez de milisegundos.

3. Y por cada bloque, lo que se publica:

```python
            "p5": round(float(np.percentile(col, 5)), 2),
            "p50": round(float(np.percentile(col, 50)), 2),
            "p95": round(float(np.percentile(col, 95)), 2),
            "prob_victoria": round(float((ganador == i).mean() * 100), 1),
```

4. Verificaciones que sólo se cumplen si la simulación está bien hecha
   ([build_proyeccion.py:222](backend/datalab/pipeline/build_proyeccion.py#L222)):

```python
    probs = sum(x["prob_victoria"] for x in f)
    if abs(probs - 100.0) > 0.5:
        raise SystemExit(
            f"Las probabilidades de victoria suman {probs:.1f}% y deberían dar "
            f"100: en cada iteración gana exactamente un bloque.")
```

Ésta es la buena: **las probabilidades de victoria tienen que sumar 100** porque
en cada iteración gana exactamente un bloque. Si no suman, hay empates mal
resueltos o un `argmax` sobre el eje equivocado. Más: las medias suman 100%, los
percentiles están ordenados, y la media de cada bloque se queda pegada a su base
de 2024 (la Dirichlet es insesgada, así que la simulación no debe desplazar el
centro — si lo desplaza, está mal parametrizada).

5. Y la autocomprobación verifica las **propiedades del modelo**, no valores
   concretos:

```python
    # Más dispersión = más incertidumbre = el favorito baja su probabilidad.
    poco = simular(nombres, base, 4.0, iteraciones=20_000)
    mucho = simular(nombres, base, 12.0, iteraciones=20_000)
    assert poco["fuerzas"][0]["prob_victoria"] >= mucho["fuerzas"][0]["prob_victoria"]

    # Reproducibilidad: misma semilla, mismo resultado.
    a = simular(nombres, base, SIGMA_LIDER, iteraciones=5_000)
    b = simular(nombres, base, SIGMA_LIDER, iteraciones=5_000)
    assert a["fuerzas"] == b["fuerzas"], "la simulación no es reproducible"
```

Comprobar "SHH sale 87.3%" sería fijar el resultado; comprobar "más dispersión
baja la probabilidad del favorito" es fijar que el modelo **se comporta como un
modelo**.

**El concepto con nombre:** **Monte Carlo simulation** y, lo que de verdad
importa aquí, **sensitivity analysis** frente a **false precision**. El error que
se evita se llama **spurious precision** o *garbage in, gospel out*: el aparato
estadístico —percentiles, IC95, desviación— le presta credibilidad a un input
que no la tiene. La distinción de fondo es entre **incertidumbre aleatoria**
(la que el modelo simula) y **incertidumbre epistémica** (la del supuesto), y
sólo la primera aparece en un intervalo de confianza. El barrido es la forma
estándar de hacer visible la segunda.

La analogía: una receta con "sal al gusto". Puedes pesar todo lo demás al
miligramo y publicar la composición nutricional con tres decimales, pero si la
sal la echaste a ojo, esos decimales son decorativos. Lo honesto es decir cuánta
sal supusiste y cómo cambia el plato si fuera el doble.

**Por qué esta tecnología y no otra:**

- **¿Por qué `numpy` y no `random` puro?** Ya estaba instalado en el venv, así
  que no es dependencia nueva. Y `rng.dirichlet` no tiene equivalente de una
  línea en la estándar: habría que muestrear 6 Gammas por iteración y
  normalizar — 600,000 llamadas a `random.gammavariate` frente a una llamada
  vectorizada. La regla del proyecto es no agregar dependencias, no rechazar las
  que ya están.
- **¿Por qué Dirichlet y no normales renormalizadas?** Perturbar cada bloque con
  una normal y dividir entre la suma **parece** equivalente y no lo es: deforma
  las colas y correlaciona los errores de un modo que nadie eligió. Además puede
  producir porcentajes negativos antes de normalizar. La Dirichlet es la
  distribución canónica de datos composicionales — vectores que suman una
  constante — y garantiza repartos válidos por construcción.
- **¿Por qué 100,000 iteraciones y no un millón?** El error de Monte Carlo sobre
  una probabilidad va como 1/√N: con 100k es de **±0.16 pp**. Con un millón sería
  ±0.05 pp — precisión irrelevante cuando el supuesto de σ mueve la respuesta
  **24.7 puntos**. Gastar 10× de cómputo para afinar el tercer decimal de un
  número cuyo primer dígito es discutible es el ejemplo perfecto de optimizar lo
  que no importa. El error de MC se publica junto al resultado, precisamente
  para que se vea de qué tamaño es frente al otro.
- **¿Por qué semilla fija?** Una proyección que cambia en cada corrida no se
  puede auditar ni discutir. Con `SEMILLA = 20270606` cualquiera reproduce el
  número exacto que se publicó.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **simular en el navegador**, en JavaScript, al cargar la
página. Se descartó por dos razones concretas: (1) 100,000 iteraciones × 6
bloques en JS sin numpy es trabajo real en el hilo principal, y (2) —la que
manda— el resultado cambiaría en cada carga si no se fija la semilla, y una
proyección electoral que da un número distinto cada vez que la abres no se puede
citar, ni discutir, ni auditar. Es la aplicación de la regla que salió de fases
anteriores: **precalcular lo caro y lo estable; calcular en vivo sólo lo que
responde a un filtro.** Una proyección estatal no responde a ningún filtro.

La segunda alternativa, la tentadora, era **inventar los números de encuesta**
para poder usar los tres insumos que la fase pedía. Habría producido un modelo
más completo de aspecto y completamente ficticio: el margen de error de una
encuesta inventada es incertidumbre inventada, y a diferencia del supuesto de σ
—que está declarado como supuesto— habría entrado al modelo disfrazado de dato.
Se prefirió correr con dos insumos reales y decir en el propio archivo de salida
cuáles faltan y por qué.

**Cómo lo dirías en una entrevista:**
> "Implementé la proyección electoral como un Monte Carlo de 100,000 iteraciones
> con `numpy`, muestreando una Dirichlet sobre el reparto real de la última
> elección — Dirichlet porque los porcentajes de voto son datos composicionales y
> así cada iteración suma 100% por construcción, en vez de normalizar normales y
> deformar las colas. Lo importante fue reconocer que sólo tenía una transición
> electoral observada: con n=1 no se estima una varianza, así que la dispersión
> es un supuesto y no una estimación. En vez de esconderlo, lo expuse como
> parámetro con nombre y publiqué un barrido de sensibilidad — la probabilidad de
> victoria del favorito va de 98.8% a 74.1% según el supuesto, y ninguno de esos
> 25 puntos viene del dato. También descarté simular en el navegador: sin semilla
> fija la proyección cambiaría en cada carga y dejaría de ser auditable."

---

## 2026-08-18 — Un asterisco no es un cero: el secreto estadístico del INEGI

**El problema real:** El ITER del Censo 2020 trae 2,762 localidades de Campeche
con 286 columnas cada una. Pero en **1,978 de ellas** —el 71%— todas las
columnas de desglose vienen con un asterisco:

```
04,Campeche,001,Calkiní,0123,Santa Cruz,...,17,*,*,*,*,*
```

El `*` es la marca de **confidencialidad**: el INEGI conoce el dato, pero no lo
publica porque en una localidad de 17 habitantes decir "9 mujeres, 3 mayores de
50" permitiría identificar personas concretas. La población total sí se publica;
el desglose no.

El error natural al parsear es `int(v or 0)` — o cualquier variante de "si no es
número, cero". Y un cero **miente hacia adelante**: se suma, se promedia, se
grafica, y colorea el mapa como si esa localidad no tuviera mujeres. Peor
todavía: el error es invisible, porque un cero se ve exactamente como un dato.

**La solución aplicada:** Un valor suprimido se convierte en `null`, nunca en 0.
Y `null` se propaga: cualquier cifra derivada de un valor suprimido también es
`null`, no un cálculo parcial.

**Tecnología y librerías usadas:**

- **`csv.DictReader`** (estándar de Python) — lee el CSV devolviendo cada fila
  como diccionario con los encabezados como claves. Con 286 columnas, acceder
  por nombre (`fila["P_18YMAS"]`) en vez de por índice (`fila[27]`) es lo que
  hace el código legible y resistente a que el INEGI reordene columnas.
- **`encoding="utf-8-sig"`** — el `-sig` descarta el **BOM** (byte order mark),
  tres bytes invisibles al inicio del archivo. Sin él, la primera clave del
  diccionario sería `'﻿ENTIDAD'` en vez de `'ENTIDAD'`, y el acceso a esa
  columna fallaría con `KeyError` sobre un nombre que en pantalla se ve
  idéntico. Es primo hermano del problema NFC/NFD: bytes invisibles que rompen
  comparaciones.
- **`None` de Python → `null` de JSON** — `json.dumps` los traduce solo, y en
  JavaScript `null` se distingue de `0` con `===`.
- **`any()`** — `True` si algún elemento es verdadero. Propaga el
  desconocimiento: si *alguna* parte de una suma está suprimida, el total es
  desconocido.

**El proceso paso a paso:**

1. La conversión, con el caso peligroso explícito
   ([build_censo.py:109](backend/datalab/pipeline/build_censo.py#L109)):

```python
def entero(v):
    """Devuelve el número, o None si el INEGI lo suprimió.

    Nunca devuelve 0 para un valor suprimido: un cero se suma, se promedia y
    se grafica como si fuera un hecho. `None` se propaga y obliga a decidir."""
    v = (v or "").strip()
    if v == SUPRIMIDO or v == "":
        return None
    return int(v)
```

- `SUPRIMIDO = "*"` es constante nombrada, no un literal escondido en un `if`.
- **No hay un `except ValueError: return 0`**, que es la forma habitual —y
  silenciosa— de cometer este error.

2. La propagación del desconocimiento
   ([build_censo.py:120](backend/datalab/pipeline/build_censo.py#L120)):

```python
def rangos(fila):
    r = {k: entero(fila[col]) for k, col in DIRECTOS.items()}

    # Menores de 18 = total − mayores de 18. Si cualquiera de los dos está
    # suprimido, el resultado es desconocido, no cero.
    tot, may = r["poblacion_total"], r["mayores_18"]
    r["menores_18"] = None if tot is None or may is None else tot - may

    partes = [entero(fila[c]) for c in SUMA_50YMAS]
    r["mayores_50"] = None if any(p is None for p in partes) else sum(partes)
    return r
```

Lo importante: si alguien hubiera puesto ceros, `sum()` **funcionaría
perfectamente** y daría una cifra falsa. La guarda `any(p is None ...)` convierte
"me falta una parte" en "no sé el total", que es la verdad.

Nota de dominio: `mayores_18` **no** es una suma de quinquenios. El ITER publica
`P_18YMAS` tal cual, así que es DATO. Los que sí son CÁLCULO son `menores_18`
(una resta) y `mayores_50` (P_50A54 + P_55A59 + P_60YMAS, porque el ITER salta de
45-49 a 50-54 y cierra en 60 y más).

3. La comprobación que fija la regla:

```python
    assert entero("*") is None
    assert entero("") is None
    assert entero(" 123 ") == 123
    assert entero("0") == 0, "un cero real sí es cero"
```

La última línea es la que más importa: el pipeline **sí** debe leer un cero real
como cero. Lo que no debe es inventarlo.

4. Un descubrimiento que cambió el diseño: **no se puede agregar localidades para
   obtener el municipio.**

```
MUN 001: POBTOT municipal 59,232 vs suma de localidades 59,232 · dif 0
         POBFEM municipal 30,062 vs suma de las NO suprimidas 29,996 · faltan 66
```

El total cuadra —`POBTOT` nunca se suprime— pero el desglose **pierde a los
suprimidos**. El registro municipal se toma de la fila municipal del ITER, que
viene completa. Esto no salió de la documentación: salió de comparar ambas cifras.

5. Verificación contra el propio archivo
   ([build_censo.py:246](backend/datalab/pipeline/build_censo.py#L246)):

```python
    for campo, col in DIRECTOS.items():
        esperado = entero(entidad[col])
        obtenido = sum(m[campo] for m in municipios.values() if m[campo] is not None)
        if esperado != obtenido:
            raise SystemExit(...)
```

Más tres consistencias internas: mujeres + hombres = total, 18+ y menores de 18 =
total, y **50+ nunca puede exceder a 18+** — esta última atraparía un mapeo de
columnas equivocado, igual que `verificar()` en el pipeline electoral.

**El concepto con nombre:** **Statistical disclosure control** (o *cell
suppression*) del lado de la fuente; del lado del consumidor, distinguir
**missing vs. zero** y practicar **null propagation**. La forma equivocada tiene
nombre: **imputación implícita** —rellenar sin darse cuenta— frente a la
explícita, que al menos es una decisión documentada. En bases de datos es
exactamente la diferencia entre `NULL` y `0`, y por qué `SUM()` en SQL ignora
nulos en vez de tratarlos como ceros.

La analogía: un examen sin contestar contra uno contestado mal. Los dos "no suman
puntos", pero promediar el primero como cero afirma algo que no sabes — y el
promedio del grupo sale mal sin que nada avise.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `pandas.read_csv()`?** Habría sido cómodo con 286 columnas, pero
  convierte `*` en una columna numérica a **`NaN`**. `NaN` parece resolverlo —no
  es cero— pero trae dos trampas: `NaN != NaN` en las comparaciones, y
  **`df.sum()` ignora los NaN por defecto**, que es justo el bug a evitar: sumar
  784 localidades y presentar el resultado como si fueran 2,762. Con `csv` y
  `None` explícito, cada decisión sobre un faltante es una línea que alguien
  escribió a propósito.
- **¿Por qué `None` y no un centinela como `-1`?** Porque `-1` es un número: se
  suma, se ordena y se grafica. Mismo error que el cero, sólo que más visible
  cuando ya se coló.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **imputar** el desglose de las suprimidas con la proporción de
su municipio: si en Calkiní el 50.8% son mujeres, aplicarlo a cada localidad
oculta. Se descartó por dos razones concretas: (1) el INEGI las ocultó porque son
tan pequeñas que el dato identifica personas, y estimar sobre ellas reintroduce
parte de ese riesgo; (2) las 1,978 suman **7,376 habitantes, el 0.8% del
estado**, y ninguna tiene polígono en el mapa — la imputación agregaría riesgo e
incertidumbre a cambio de cero cobertura visible.

La segunda alternativa era **publicar las 2,762 localidades** en el JSON del
frontend. Se descartó al medir: ~1.5 MB de los cuales el navegador sólo puede
dibujar 501. Se publican las que tienen polígono (118 KB) y el crudo se conserva
para regenerar el resto. Es la lección del geojson de escuelas de 2.1 MB que ya
estaba documentada como deuda: `frontend/data/` es la capa **servida**, no el
archivo histórico.

**Cómo lo dirías en una entrevista:**
> "El Censo del INEGI aplica supresión por confidencialidad: el 71% de las
> localidades traen asterisco en el desglose. Lo parseé a `None` en vez de a
> cero, y propago el desconocimiento — si una parte de una suma está suprimida,
> el derivado también es null, no un total parcial. Descarté `pandas`
> precisamente aquí: convierte el asterisco a `NaN` y `sum()` ignora los NaN por
> defecto, así que habría sumado 784 registros presentándolos como 2,762. También
> descubrí, comparando totales, que el desglose municipal no se puede obtener
> agregando localidades porque perdería a las suprimidas; se toma de la fila
> municipal, que el ITER publica completa."

---

## 2026-08-18 — El territorio cambió entre las dos fuentes: 12 municipios contra 13

**El problema real:** El proyecto trabaja con **13 municipios** de Campeche. El
Censo 2020 trae **12**. No es un error del archivo ni un filtro mal puesto:
**Dzitbalché se erigió en municipio en 2021**, un año después del levantamiento
censal. Su población de 2020 está contada dentro de Calkiní.

Esto produce dos trampas, y la segunda es peor:

1. **Dzitbalché no tiene cifra.** Si el mapa lo pinta con 0 habitantes, aparece
   como el municipio más despoblado del estado — falso sobre un municipio de más
   de 16,000 personas.
2. **Calkiní tiene una cifra que no es comparable.** Sus 59,232 habitantes de
   2020 incluyen el territorio que hoy es Dzitbalché. Poner ese número junto al
   resultado electoral de Calkiní en 2024 —que ya *no* lo incluye— es comparar
   dos territorios distintos con el mismo nombre. Y aquí no hay hueco que delate
   nada: los dos números existen y se ven bien.

**La solución aplicada:** Tres tratos distintos según el nivel:

- **Municipio Dzitbalché:** sin cifra. Se omite de los valores del mapa, que ya
  sabe pintar gris y escribir "información insuficiente"; la ficha explica por qué.
- **Municipio Calkiní:** con su cifra, más una advertencia de que incluye a
  Dzitbalché y no es comparable con lo electoral de 2024.
- **Localidades de Dzitbalché:** sí tienen cifra. Dzitbalché y Bacabchén
  existían en 2020 como localidades de Calkiní: mismo lugar físico, clave nueva.
  Se recuperan cruzando por nombre normalizado y se marca de dónde salió la clave.

**Tecnología y librerías usadas:**

- **`unicodedata.normalize("NFD", …)` + encode a ASCII** — el mismo `norm()` del
  resto del proyecto, para cruzar `"Dzitbalché"` del Marco Geoestadístico contra
  `"Dzitbalche"` del ITER.
- **`dict(origen, **cambios)`** — copia un diccionario sustituyendo claves.
  Hereda todas las cifras de 2020 cambiando sólo clave y municipio.
- **El mecanismo de "sin dato" que `mapa.js` ya tenía** — `sinValor()` pinta con
  el token `--mapa-pendiente` y escribe "información insuficiente". No hubo que
  construir nada: bastó **no** meter Dzitbalché en `valores`.

**El proceso paso a paso:**

1. La renumeración, declarada como tal
   ([build_censo.py:180](backend/datalab/pipeline/build_censo.py#L180)):

```python
        nuevas[p["cvegeo"]] = dict(
            origen,
            cve_loc=p["cvegeo"],
            cve_mun="04013",
            nombre=p["nombre"],
            clave_censo_2020=origen["cve_loc"],
            nota=("En 2020 esta localidad pertenecía a Calkiní. Dzitbalché se "
                  "erigió en municipio en 2021, después del Censo: la cifra es "
                  "de la misma localidad con su clave anterior."),
        )
```

`clave_censo_2020` conserva **de dónde salió el número**. Sin ese campo, quien
audite el archivo vería un dato de 2020 con clave 04013 y no podría explicarlo,
porque esa clave no existe en el ITER.

2. La omisión deliberada al registrar variables (`frontend/js/censo.js`):

```javascript
      const valores = {};
      Object.entries(d.municipios).forEach(([cve, m]) => {
        if (typeof m[c.k] === 'number') valores[cve] = m[c.k];
      });
```

`typeof m[c.k] === 'number'` deja fuera tanto los `null` como los ausentes. Una
línea, y es la que impide que Dzitbalché se pinte como cero.

3. La advertencia que nadie pediría pero evita la conclusión equivocada:

```javascript
      if (nivel === 'el municipio' && props.cve_mun === '04001') {
        aviso += '<tr><td colspan="2" class="text-small">Esta cifra de 2020 '
          + 'incluye el territorio que en 2021 se separó como municipio de '
          + 'Dzitbalché. No es comparable con el Calkiní electoral de 2024.'
          + '</td></tr>';
      }
```

4. Lo que **no** se hizo: reconstruir el total municipal de Dzitbalché sumando
   sus localidades. El Marco Geoestadístico le da polígono a dos, pero el
   municipio puede tener más sin geometría; la suma daría un número que parece
   completo y no lo es. Queda escrito en el archivo de salida.

**El concepto con nombre:** **Slowly changing dimension** — una entidad de
referencia cuya definición cambia con el tiempo, de modo que la misma clave
significa cosas distintas según la fecha. En series temporales se llama
**boundary change** o *redistricting break*, y la regla es que un identificador
**siempre va con la fecha de vigencia de su definición**. Es también un
**temporal join**: unir dos fuentes que describen el mismo territorio en momentos
distintos.

La analogía: comparar el PIB de Alemania en 1988 y en 1992. Los dos números son
correctos y la comparación es inválida, porque "Alemania" no es el mismo
territorio. Nadie discute el dato; el error está en el signo de igual.

**Por qué esta tecnología y no otra:**

- **¿Por qué cruzar por nombre y no por clave?** Porque la clave es justamente lo
  que cambió: `040010007` en el Censo y `040130001` en el Marco Geoestadístico
  designan la misma calle. Es la **tercera** vez en este proyecto que la clave
  numérica resulta ser lo inestable y el nombre normalizado lo confiable — pasó
  con los municipios INE contra INEGI, con las secciones entre 2024 y 2026, y
  ahora aquí.
- **¿Por qué no una tabla fija `{"040130001": "040010007"}`?** Habría funcionado
  para estos dos casos. El cruce por nombre se resuelve solo si el Marco
  Geoestadístico añade otra localidad a Dzitbalché, y `norm()` ya existía.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **sumar Calkiní y Dzitbalché como una sola fila** para que las
fuentes cuadraran. Daría totales limpios y una tabla sin huecos. Se descartó
porque destruye la unidad de análisis: el proyecto entero razona sobre 13
municipios —mapa, resultados, casillas— y colapsar dos obligaría a un caso
especial en cada vista, para siempre, con tal de no mostrar un hueco.

La segunda, más tentadora, era **prorratear**: repartir la población de Calkiní
entre los dos municipios actuales según su lista nominal. Se descartó porque
produce un número que **parece un dato del Censo y no lo es**. El proyecto tiene
un mecanismo para eso —el badge de Estimación— pero aquí sería innecesaria: quien
necesite ese número puede sumarlo desde las localidades sabiendo lo que hace.
Inventarlo en el pipeline se lo escondería.

**Cómo lo dirías en una entrevista:**
> "El Censo 2020 tiene 12 municipios y el proyecto 13, porque uno se creó en
> 2021: es una slowly changing dimension, la misma clave significa territorios
> distintos según la fecha. Lo traté en tres niveles: el municipio nuevo se queda
> sin cifra y el mapa lo pinta como 'información insuficiente'; el municipio del
> que se separó lleva una advertencia de que su cifra lo incluye y no es
> comparable con lo electoral de 2024; y sus localidades sí recuperan el dato,
> cruzadas por nombre normalizado porque la clave es justo lo que cambió,
> guardando la clave original para que sea auditable. Descarté prorratear la
> población porque habría producido un número indistinguible de un dato censal."

---

## 2026-08-18 — Redondear antes o después de agregar cambia el resultado en 264 casillas

**El problema real:** La ley reparte casillas por lista nominal: una casilla por
cada 750 electores **o fracción**, mínimo una por sección (LGIPE art. 253). Para
mostrar si el reparto es proporcional por distrito hay que aplicar esa cuenta y
sumar. Y ahí está la trampa: hay dos formas de hacerlo que **parecen la misma**.

```
A)  sumar( ⌈lista_nominal_de_cada_sección ÷ 750⌉ )   →  1,203 casillas
B)  ⌈ sumar(lista_nominal) ÷ 750 ⌉                    →    939 casillas
```

**264 casillas de diferencia, un 22%.** Las dos son aritmética correcta; sólo una
es la ley. Y la equivocada da un número plausible que nadie cuestionaría: si el
panel dijera que al estado le "corresponden" 939 casillas y se instalaron 1,230,
la lectura sería "hay 291 casillas de más" — una conclusión falsa sobre un
sistema que en realidad cumple la norma casi exactamente.

**La solución aplicada:** Aplicar el redondeo **por sección**, que es la unidad
que la ley usa, y sumar después. La agregación nunca toca el redondeo.

**Tecnología y librerías usadas:**

- **`Math.ceil(x)`** — redondea hacia arriba al entero siguiente. Es la
  traducción literal de "o fracción": 751 electores no son "una casilla y un
  poquito", son dos casillas.
- **`Math.max(1, ...)`** — impone el mínimo de una casilla por sección. Sin él,
  una sección con 0 electores en lista daría 0 casillas, y la ley dice que toda
  sección tiene su básica.
- **`Object.entries()` + `forEach`** con un acumulador — un solo recorrido de las
  542 secciones que suma lo real y lo normativo a la vez.
- **Inyección de dependencia por función** (`distritoDe`) — el agregador no sabe
  de dónde sale el distrito; se lo pasan. Así la misma función sirve para
  distrito local y federal, que vienen de fuentes distintas.

**El proceso paso a paso:**

1. La fórmula, aislada y con su verificación escrita al lado
   ([electoral.js:93](frontend/js/electoral.js#L93)):

```javascript
  const ELECTORES_POR_CASILLA = 750;

  function casillasNormativas(listaNominal) {
    return Math.max(1, Math.ceil(listaNominal / ELECTORES_POR_CASILLA));
  }
```

El 750 es una constante nombrada, no un literal suelto: aparece en el cálculo,
en el texto de la interfaz y en el pie de metodología, y si la ley cambia se
toca en un solo sitio.

2. El agregador, con el redondeo **dentro** del bucle
   ([electoral.js:101](frontend/js/electoral.js#L101)):

```javascript
  function porDistrito(secciones, distritoDe) {
    const dist = {};
    const huerfanas = [];

    Object.entries(secciones).forEach(([sec, r]) => {
      const d = distritoDe(sec, r);
      if (d === null || d === undefined) { huerfanas.push(sec); return; }
      const g = dist[d] || (dist[d] = {
        distrito: d, secciones: 0, lista_nominal: 0,
        casillas: 0, normativas: 0, votaron: 0,
      });
      g.secciones += 1;
      g.lista_nominal += r.lista_nominal;
      g.casillas += r.casillas;
      g.normativas += casillasNormativas(r.lista_nominal);
      g.votaron += r.total;
    });
```

Qué hace cada parte:

- `g.normativas += casillasNormativas(r.lista_nominal)` — **ésta es la línea que
  importa**. El `ceil` se aplica a la sección y el resultado se acumula. En
  ningún momento existe una variable con la lista nominal del distrito sobre la
  que uno pudiera sentirse tentado a redondear.
- `distritoDe(sec, r)` — la función que traduce sección → distrito se recibe como
  parámetro. Para el distrito local sale del propio cómputo
  (`(s, r) => r.distrito_local`); para el federal, del catálogo del INE de la
  Fase 1 (`(s) => catalogo[s] && catalogo[s].distrito_federal`).
- `huerfanas.push(sec)` — la sección que no cruza **se acumula y se devuelve**,
  no se descarta. Es el mismo principio de las 170 casillas sin coordenada:
  el faltante se declara. Aquí son 6 secciones (4, 79, 105, 681, 781, 991) que
  tienen resultado 2024 pero no están en el catálogo de 2026, y la interfaz las
  lista por número en vez de repartirlas entre los dos distritos federales.
- `dist[d] || (dist[d] = {...})` — crea el acumulador la primera vez que aparece
  el distrito. Evita tener que saber de antemano cuántos distritos hay.

3. Los derivados se calculan **después** de agregar, que ahí sí es lo correcto:

```javascript
    filas.forEach((g) => {
      g.diferencia = g.casillas - g.normativas;
      g.electores_por_casilla = g.casillas ? g.lista_nominal / g.casillas : 0;
      ...
```

Un promedio sí se saca del total. La diferencia entre este bucle y el anterior es
exactamente la distinción entre una razón (se agrega) y una regla de asignación
(no se agrega).

4. Y la validación contra la realidad, antes de publicar nada:

```
secciones: 542
  instaladas == ceil(LN/750): 517 (95%)
  instaladas > normativa    : 25
  instaladas < normativa    : 0
```

La fórmula reproduce exacto el 95% de las secciones y **nunca queda por encima
de lo instalado**, que es la señal de que se entendió bien: la ley fija un piso,
no un techo.

**El concepto con nombre:** **Non-additive aggregation** — una medida que no se
puede sumar ni recalcular a partir del total. En modelado dimensional se
distingue entre medidas *additive*, *semi-additive* y *non-additive*, y la regla
práctica es **calcular en el grano correcto** (*compute at the right grain*):
si la regla se define por sección, se aplica por sección. El error de aplicarla
al total tiene nombre propio en estadística: la **falacia ecológica**, sacar
conclusiones sobre las partes desde el agregado.

La analogía: el reparto de escaños por circunscripción. Sumar los votos
nacionales y dividir entre el total de escaños **no** da el mismo reparto que
sumar lo que le tocó a cada circunscripción, y por eso los sistemas electorales
especifican *dónde* se aplica el redondeo. Es la misma familia de problema que
la paradoja de la asignación de Alabama.

**Por qué esta tecnología y no otra:**

- **¿Por qué `Math.ceil` y no `Math.round`?** Porque la ley dice "o fracción".
  `Math.round(751/750)` da 1; la respuesta correcta es 2. Con `round`, el
  cálculo estatal habría dado 1,155 en vez de 1,203, y el sistema habría
  reportado un déficit inexistente.
- **¿Por qué calcularlo en el navegador y no en el pipeline?** Porque la vista
  tiene filtros: el usuario recorta a un municipio y el agregado tiene que
  recalcularse. Un JSON precalculado no responde a eso, y son 542 divisiones —
  microsegundos. Es la misma regla que salió de la entrada anterior: precalcular
  lo caro y lo estable, calcular en vivo lo que responde a un filtro.
- **¿Por qué pasar `distritoDe` como función en vez de escribir dos agregadores?**
  Porque lo único que cambia entre el corte local y el federal es de dónde se lee
  el distrito. Duplicar el agregador para eso pondría la lógica del redondeo en
  dos lugares — exactamente el problema de la entrada anterior.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **seguir agrupando por municipio**, que es lo que la vista ya
hacía. Se descartó porque el municipio **no es la unidad con la que el INE
reparte casillas**: la unidad es la sección, y las secciones se agrupan en
distritos. Agrupar por municipio no está mal para operar —el municipio sigue
siendo la unidad logística— pero para preguntar *si el reparto es proporcional*
responde con la unidad equivocada, y la respuesta parece válida igual.

La segunda alternativa era **descartar en silencio las 6 secciones sin distrito
federal**. Habría dejado la tabla más limpia y los totales cuadrando "mejor". Se
descartó por lo mismo de siempre: 3 de esas 6 desaparecieron por
reseccionalización y las otras 3 nunca fueron territoriales. Ese es un hecho
sobre el cambio de la geografía electoral entre 2024 y 2026, y borrarlo de la
pantalla no lo hace desaparecer del dato.

**Cómo lo dirías en una entrevista:**
> "Al implementar el reparto normativo de casillas —una por cada 750 electores o
> fracción— el punto crítico fue el grano de cálculo: aplicar el `Math.ceil` por
> sección y sumar da 1,203 casillas, mientras que sumar la lista nominal del
> distrito y redondear una vez da 939. Un 22% de diferencia, y las dos son
> aritmética correcta; sólo una es la ley. Es una agregación no aditiva, así que
> el redondeo va dentro del bucle por sección y nunca sobre el total. Lo validé
> contra el dato real: reproduce exacto 517 de 542 secciones y nunca queda por
> encima de lo instalado, que es la señal de que la norma es un piso y no un
> techo."

---

## 2026-08-18 — Dos páginas preguntando "quién ganó" no pueden responder distinto

**El problema real:** `historico.html` ya calculaba el agregado estatal de 2024
sumando los 13 municipios en su propio archivo. Ahora `cartografia.html`
necesitaba lo mismo para su resumen "quién ganó Campeche". Copiar ese bloque de
sumas a la segunda página habría funcionado **el primer día**. El problema
aparece después: el día que alguien corrija el cálculo del margen en una de las
dos, la otra queda con la fórmula vieja, y el sistema empieza a responder
**dos números distintos a la misma pregunta** según qué pantalla mires. Y no hay
error, no hay excepción, no hay nada que avise: las dos cifras se ven
plausibles.

En datos electorales eso es especialmente grave porque el margen no es un
detalle cosmético: es lo que define si un municipio es competitivo o seguro, y
de ahí sale a dónde se manda gente.

**La solución aplicada:** Extraer el cálculo a **una sola función** en el módulo
que ya es la única puerta a los resultados (`electoral.js`), y que las dos
páginas la consuman. La regla que se hace cumplir: el ganador se decide sobre el
**bloque de coalición**, nunca sobre el partido suelto.

**Tecnología y librearías usadas:**

- **JavaScript vanilla, patrón IIFE** — el módulo ya existía como
  `(function (global) { ... })(window)`. Las funciones nuevas se agregan al
  objeto que se exporta al final, sin bundler ni `import`.
- **`Object.entries(obj)`** — convierte `{PAN: 5422, MC: 26861}` en
  `[['PAN', 5422], ['MC', 26861]]`, que es lo que permite ordenar por valor.
  Un objeto no se puede ordenar; un array de pares, sí.
- **`Array.prototype.sort((a, b) => b[1] - a[1])`** — orden descendente por el
  segundo elemento del par, o sea por votos. Devolver un número negativo,
  cero o positivo es cómo `sort` decide el orden.
- **`Array.prototype.reduce`** y **`forEach`** — acumulación de los totales.
- **Closures** — `fichaMunicipio(d)` devuelve *una función* que ya tiene dentro
  los datos `d`. Así el mapa la llama luego como `fn(props, capaId)` sin tener
  que saber de dónde salieron los resultados. Es el mismo patrón que ya usaba
  `fichaSeccion(d)`.

**El proceso paso a paso:**

1. La función compartida
   ([electoral.js:132](frontend/js/electoral.js#L132)):

```javascript
  function agregar(municipios) {
    const bloques = {};
    const partidos = {};
    let validos = 0, nulos = 0, total = 0, lista = 0, casillas = 0, secciones = 0;

    municipios.forEach((m) => {
      Object.entries(m.bloques).forEach(([b, v]) => {
        bloques[b] = (bloques[b] || 0) + v;
      });
      Object.entries(m.votos).forEach(([c, v]) => {
        partidos[c] = (partidos[c] || 0) + v;
      });
      validos += m.validos; nulos += m.nulos; total += m.total;
      lista += m.lista_nominal; casillas += m.casillas; secciones += m.secciones;
    });

    const orden = Object.entries(bloques).filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const primero = orden[0] || ['', 0];
    const segundo = orden[1] || ['', 0];

    return {
      municipios, bloques, partidos, orden, ordenPartidos,
      validos, nulos, total, lista, casillas, secciones,
      ganador: primero[0],
      margen: validos ? (primero[1] - segundo[1]) / validos * 100 : 0,
      participacion: lista ? total / lista * 100 : 0,
      nulos_pct: total ? nulos / total * 100 : 0,
    };
  }
```

Qué hace cada parte:

- **Dos acumuladores separados, `bloques` y `partidos`.** No son la misma
  pregunta: "cuánto sacó el PVEM" no es "cuánto sacó el bloque en el que iba el
  PVEM". Fundirlos sería perder la única cifra que dice si un partido conserva
  registro.
- `(bloques[b] || 0) + v` — el `|| 0` inicializa la clave la primera vez.
  Evita tener que declarar de antemano las 8 claves.
- `orden[0] || ['', 0]` — si la lista viniera vacía (un filtro que no deja
  ningún municipio), devuelve un par neutro en vez de reventar con
  `Cannot read properties of undefined`.
- `validos ? ... : 0` — la guarda contra división entre cero, tres veces. Un
  `NaN` en una cifra de pantalla se propaga en silencio y se imprime como
  "NaN%".
- La fórmula del margen es **la misma que `rematar()` en el pipeline**:
  `(1º − 2º) / válidos × 100`. Que coincida no es casualidad: es la definición
  del proyecto, y por eso está escrita en el comentario de la función.

2. La lectura que el agregado **no** puede dar
   ([electoral.js:173](frontend/js/electoral.js#L173)):

```javascript
  function municipiosPorGanador(municipios) {
    const por = {};
    municipios.forEach((m) => {
      (por[m.ganador] = por[m.ganador] || []).push(m);
    });
    return Object.entries(por)
      .map(([b, ms]) => [b, ms.sort((a, x) => x.margen - a.margen)])
      .sort((a, b) => b[1].length - a[1].length);
  }
```

`(por[k] = por[k] || []).push(m)` es un modismo que hace dos cosas en una línea:
crea el array si no existe, y en cualquier caso empuja el elemento. Agrupa
municipios por fuerza ganadora — que es una pregunta distinta de "quién sacó más
votos": se puede ganar el estado en votos y ganar menos municipios.

3. La ficha del mapa, que **no recalcula nada**
   ([electoral.js:192](frontend/js/electoral.js#L192)):

```javascript
  function fichaMunicipio(d) {
    return function (props, capaId) {
      if (capaId !== 'municipios' && capaId !== 'choropleth') return '';
      const m = d.municipios[props.cve_mun];
      if (!m) return '';
```

Tres decisiones en cuatro líneas: se filtra por capa (el mismo `fichaExtra` lo
llaman todas, así que cada ficha declara para cuál es), se hace el join por
`cve_mun`, y si el municipio no aparece **devuelve vacío en vez de inventar**.
El registro ya trae `ganador`, `segundo` y `margen` del pipeline: aquí sólo se
leen.

4. Y la página que ya calculaba pasa a consumir
   ([historico.js:54](frontend/js/vistas/historico.js#L54)):

```javascript
    const ag = E.agregar(mun);
    const { bloques, partidos, orden, ordenPartidos,
            validos, nulos, total, lista } = ag;
```

La **desestructuración** (`const { a, b } = objeto`) extrae varias propiedades a
variables sueltas de un golpe. Sirvió para que el resto del render —cientos de
líneas de plantilla— siguiera usando los mismos nombres y no hubiera que
tocarlo.

**El concepto con nombre:** **Single source of truth** aplicado a la lógica, no
sólo al dato. La versión específica es **DRY** (*Don't Repeat Yourself*), pero
el matiz importante es *cuál* repetición importa: no la de tres líneas parecidas,
sino la de una **regla de negocio**. En arquitectura de datos esto es evitar
**metric drift** o *inconsistent metric definitions* — el problema clásico de que
"ingresos" signifique dos cosas según el tablero. Es justo lo que resuelven las
**semantic layers** / *metrics layer* (dbt metrics, LookML, Cube).

La analogía: dos relojes en la misma casa. Mientras nadie los compare, los dos
"funcionan". El problema no es que uno esté mal — es que **no puedes saber cuál**,
y a partir de ese momento ninguno sirve para nada.

**Por qué esta tecnología y no otra:**

- **¿Por qué en `electoral.js` y no en un módulo nuevo, tipo `agregados.js`?**
  Porque `electoral.js` ya es, por diseño, la única puerta a los resultados de
  2024. Un módulo nuevo serían **24 etiquetas `<script>` más** y un orden de
  carga más frágil, para albergar dos funciones que operan exactamente sobre los
  datos que ese módulo ya expone.
- **¿Por qué devolver un objeto grande en vez de varias funciones
  (`ganador()`, `margen()`, `participacion()`)?** Porque todas necesitan el
  mismo recorrido de los 13 municipios. Con funciones separadas, pintar el
  resumen recorrería la lista cuatro veces y —peor— cada una podría evolucionar
  por su lado. Un recorrido, un objeto, una definición.
- **¿Por qué la ficha devuelve un string de `<tr>` y no un nodo del DOM?**
  Porque `CerebroMapa` ya define el contrato así: `fichaExtra` concatena texto
  dentro de la tabla del popup. Devolver un nodo obligaría a cambiar el
  componente de mapa para acomodar una sola llamada.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa evidente era **copiar el bloque de sumas** a `cartografia.html`.
Se descartó porque la repetición aquí no es de código, es de **definición**: la
fórmula del margen es una decisión del proyecto, y una decisión escrita en dos
lugares deja de ser una decisión en cuanto alguien edita uno. El síntoma es una
inconsistencia sin excepción y sin log.

La segunda alternativa era **precalcular el agregado estatal en el pipeline** y
publicarlo como un JSON más (`resultados_estatal_2024.json`). Es más
consistente todavía —el número vendría del mismo lugar que todo lo demás— pero
se descartó por dos motivos concretos: (1) el agregado tiene que recalcularse
**cuando el usuario filtra por municipio**, y un archivo estático no puede
responder a eso; (2) son 13 objetos que ya están en memoria, y sumar 13 números
en el navegador no justifica un archivo, un `fetch` y un paso de pipeline más.
La regla que salió de ahí: **precalcular lo que es caro o lo que no depende de
la interacción; calcular en vivo lo que responde a un filtro.**

**Cómo lo dirías en una entrevista:**
> "Dos vistas necesitaban el mismo agregado electoral, así que en vez de
> duplicar el cálculo lo extraje a una función única en el módulo que ya era la
> puerta a esos datos, y refactoricé la vista que ya lo tenía para consumirla.
> No era DRY por estética: la fórmula del margen es una definición de negocio, y
> una definición escrita en dos lugares produce metric drift — dos pantallas
> respondiendo distinto a la misma pregunta, sin ningún error que lo delate.
> Descarté precalcularlo en el pipeline porque el agregado tiene que recalcularse
> cuando el usuario filtra, y un JSON estático no responde a eso."

---

## 2026-08-18 — Pedir 26 veces en vez de 555: dejar que el catálogo diga qué pedir

**El problema real:** El INE expone un endpoint público que devuelve geometría
para una sección: `getConoceTuNuevoDistrito?entidad=4&seccion=N`. Campeche tiene
555 secciones. El reflejo es obvio: un `for` sobre las 555. Pero cada respuesta
pesa **entre 570 KB y 1.2 MB** — el recorrido completo son **~330 MB** de
tráfico contra un servidor de gobierno que no es mío, para obtener 23 polígonos.

**La solución aplicada:** Antes de programar el bucle, comprobar qué devuelve
realmente el endpoint. Resultó que **no devuelve la sección**: devuelve los tres
distritos que la contienen. Y el polígono de un distrito es idéntico se pida
desde la sección que se pida. Como los catálogos tabulares ya dicen qué sección
pertenece a qué distrito, basta **una sección representante por combinación**
(distrito federal, distrito local, municipio): **26 peticiones, el 4%**.

**Tecnología y librerías usadas:**

- **`urllib.request`** (estándar) — `urllib.request.urlopen(url, timeout=60)`
  hace la petición HTTP y devuelve un objeto tipo archivo; `.read()` da los
  bytes. Se prefirió sobre `requests` porque **viene con Python**: son 26
  peticiones GET sin autenticación ni sesión, y `requests` no aporta nada aquí
  salvo una dependencia más en el venv.
- **`time.sleep(segundos)`** — pausa la ejecución. Es la cortesía con el
  servidor, y también lo que evita que te bloqueen por ráfaga.
- **`hashlib` + `json.dumps(..., sort_keys=True)`** — para firmar geometrías y
  comprobar que el mismo distrito no llegó con dos formas distintas. El
  `sort_keys=True` es imprescindible: sin él, dos diccionarios iguales con las
  claves en distinto orden producen textos distintos y firmas distintas.
- **`curl`** — para el sondeo manual **antes** de escribir una línea de Python.

**El proceso paso a paso:**

1. Sondear a mano antes de programar. Esto es lo que reveló que la premisa era
   falsa:

```bash
curl -s "https://cartografia.ine.mx/sige8/api/getConoceTuNuevoDistrito?entidad=4&seccion=3"
```

La raíz de la respuesta no es un `FeatureCollection` sino una **lista de tres**,
y sus propiedades son:

```
[0]  {"entidad": 4, "distrito": 1}      distrito federal
[1]  {"entidad": 4, "distrito_l": 1}    distrito local
[2]  {"circuito": 31, "distrito_j": 1}  distrito judicial
```

Ningún feature describe la sección 3.

2. Comprobar que el polígono no depende de la sección desde la que se pide —
   secciones 3 y 7 están en el mismo distrito:

```python
h = hashlib.md5(json.dumps(f['geometry'], sort_keys=True).encode()).hexdigest()[:12]
```

Mismo md5 en las tres capas. Es lo que autoriza a deduplicar.

3. Elegir el conjunto mínimo de peticiones
   ([build_ine_cartografia.py:165](backend/datalab/pipeline/build_ine_cartografia.py#L165)):

```python
def representantes(secciones):
    """Una sección por combinación (federal, local, municipio).

    El municipio entra en la combinación aunque no haga falta para los
    distritos: da dispersión geográfica, que es lo único que puede descubrir
    los distritos judiciales — no vienen en ningún catálogo.
    """
    vistos = {}
    for sec, d in sorted(secciones.items(), key=lambda kv: int(kv[0])):
        clave = (d["distrito_federal"], d["distrito_local"], d["municipio_ine"])
        vistos.setdefault(clave, sec)
    return sorted(vistos.values(), key=int)
```

`vistos.setdefault(clave, sec)` es el corazón: guarda la sección **sólo si esa
combinación no se había visto**. Recorrer ordenado por número de sección hace el
resultado determinista — la misma entrada siempre elige las mismas 26.

4. Ser cortés y **resumible**
   ([build_ine_cartografia.py:187](backend/datalab/pipeline/build_ine_cartografia.py#L187)):

```python
        destino = CRUDO / f"seccion_{int(sec):04d}.json"
        if destino.exists():
            print(f"  [{i}/{len(objetivo)}] sección {sec}: ya estaba")
            continue
```

Si la corrida se interrumpe a la mitad, la siguiente sigue donde se quedó en vez
de volver a pedir lo que ya está en disco.

5. Reintentos con espera creciente:

```python
            except (urllib.error.URLError, TimeoutError) as e:
                if intento == REINTENTOS:
                    raise SystemExit(...)
                time.sleep(PAUSA * 4 * intento)
```

La espera se multiplica por el número de intento. Si el servidor está saturado,
insistir al mismo ritmo lo empeora.

6. Validar **antes** de guardar:

```python
        try:
            datos = json.loads(cuerpo)
        except json.JSONDecodeError:
            raise SystemExit(f"Sección {sec}: la respuesta no es JSON. "
                             f"Primeros bytes: {cuerpo[:200]!r}")
        validar_respuesta(datos, sec)
        destino.write_bytes(cuerpo)
```

Una página HTML de error guardada con extensión `.json` es una bomba de tiempo:
explota semanas después, en la consolidación, lejos de su causa.

**El concepto con nombre:** **API probing** o *exploratory API testing* antes de
integrar; **rate limiting** del lado del cliente (*polite crawling*);
**checkpointing** para hacer el proceso resumible (*idempotent ingestion*); y
**exponential backoff** para los reintentos. La decisión de fondo es
**predicate pushdown** en su versión conceptual: usar los metadatos que ya
tienes (el catálogo) para no pedir datos que no necesitas.

La analogía: es la diferencia entre ir al archivo municipal y pedir los 555
expedientes de una colonia para averiguar a qué distrito pertenece, o mirar
primero el índice —que ya lo dice— y pedir sólo los 26 expedientes que aportan
algo nuevo. El índice es gratis; los expedientes, no.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `requests`?** Es más cómoda (`requests.get(url).json()`), pero
  son 26 GET sin auth, sin sesión, sin cookies. `urllib.request` ya viene con
  Python y hace exactamente eso. Agregar una dependencia al venv para ahorrar
  tres líneas es coste sin beneficio.
- **¿Por qué no `asyncio`/`aiohttp` para paralelizar?** Habría bajado los 26
  archivos en segundos en vez de ~30. Se descartó a propósito: el objetivo
  explícito era **no golpear** un servidor público ajeno. Paralelizar aquí
  optimiza el único recurso que sobra (mi tiempo) a costa del único que no es
  mío (su servidor).
- **¿Por qué guardar el crudo si ya se consolidó?** Porque el endpoint no está
  versionado y puede cambiar o desaparecer sin aviso. El crudo en disco permite
  re-consolidar sin volver a pedir nada.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **iterar las 555 secciones** y quedarse con lo que salga. Se
descartó por tres razones concretas, en orden de importancia: (1) son ~330 MB
contra un servidor ajeno para obtener ~12 MB de información única; (2) el 96% de
las respuestas serían el mismo polígono repetido, que hay que deduplicar de
todos modos; (3) a ese volumen es razonable que el INE corte por abuso, y
entonces no obtienes ni los 26.

La segunda alternativa era **pedir sólo un par de secciones y extrapolar** la
jerarquía. Se descartó porque los distritos judiciales **no están en ningún
catálogo tabular**: no hay de dónde extrapolarlos, sólo se descubren pidiendo. Y
por eso el municipio entra en la clave de agrupación aunque no haga falta para
los distritos — compra dispersión geográfica, que es lo único que puede sacar a
la luz un distrito judicial que no toque ninguna sección consultada.

**Cómo lo dirías en una entrevista:**
> "Antes de escribir el bucle sondeé el endpoint con `curl` y descubrí que la
> premisa era falsa: no devolvía la geometría de la sección sino la de los
> distritos que la contienen. Verifiqué con hashes MD5 que el polígono es
> idéntico se pida desde donde se pida, y como los catálogos ya daban la
> jerarquía, reduje el trabajo a una sección representante por combinación de
> distrito y municipio: 26 peticiones en lugar de 555, un 4% del tráfico. Lo
> implementé con `urllib` de la estándar, pausa de 0.4 s, reintentos con backoff
> exponencial y checkpointing en disco para que sea resumible."

---

## 2026-08-18 — El nombre del archivo se veía idéntico y `open()` fallaba: NFC contra NFD

**El problema real:** Los catálogos del INE tienen acentos en el nombre:
`Catálogo de Secciones.txt`. Al escribir ese nombre en el script y abrirlo,
`FileNotFoundError` — aunque `ls` muestre el archivo y el nombre se vea **igual
carácter por carácter en pantalla**. La causa: macOS guarda los nombres de
archivo en Unicode **NFD** (descompuesto: `a` + acento como dos code points),
mientras que lo que uno teclea en el editor sale en **NFC** (precompuesto: `á`
como un solo code point). Son dos cadenas de bytes distintas que se **dibujan
igual**. Es un fallo especialmente cruel porque la inspección visual —abrir el
archivo, comparar el nombre— confirma que "está bien".

**La solución aplicada:** No hardcodear el nombre. Buscar el catálogo por un
**fragmento**, comparando ambos lados normalizados a la misma forma Unicode.

**Tecnología y librerías usadas:**

- **`unicodedata`** (estándar) — `unicodedata.normalize(forma, texto)` convierte
  entre las formas de normalización de Unicode. Las dos que importan aquí:
  **NFC** (*composed*: `á` = 1 code point, U+00E1) y **NFD** (*decomposed*:
  `á` = 2 code points, U+0061 + U+0301). Ninguna es "la correcta": son
  representaciones equivalentes del mismo texto, y comparar una contra la otra
  con `==` da `False`.
- **`pathlib.Path.iterdir()`** — lista el contenido del directorio devolviendo
  los nombres **tal como están en disco**, o sea en NFD en macOS. Es la fuente
  de verdad contra la que hay que comparar.
- **`str.lower()`** — se aplica después de normalizar, para que la comparación
  tampoco dependa de mayúsculas.

**El proceso paso a paso:**

Primero, la comprobación que reveló el problema:

```python
nfc = unicodedata.normalize('NFC', p.name)
print(f'{p.name}   NFC==disco? {nfc == p.name}')
```

Salida para los siete `.xlsx`: **`False` en todos**. El disco está en NFD.

Y la función que lo resuelve
([build_ine_cartografia.py:95](backend/datalab/pipeline/build_ine_cartografia.py#L95)):

```python
def archivo(fragmento):
    """Ubica un catálogo por un fragmento de su nombre.

    macOS guarda los nombres de archivo en Unicode NFD (la tilde va aparte de
    la letra). Un literal escrito en NFC —lo normal al teclearlo— no abre el
    archivo aunque en pantalla se vea idéntico. Por eso se busca comparando
    formas normalizadas en vez de hardcodear el nombre.
    """
    objetivo = unicodedata.normalize("NFC", fragmento).lower()
    for p in sorted(CATALOGOS.iterdir()):
        if objetivo in unicodedata.normalize("NFC", p.name).lower():
            return p
    raise SystemExit(f"No está el catálogo que contiene '{fragmento}' en {CATALOGOS}")
```

Qué hace cada parte:

1. `unicodedata.normalize("NFC", fragmento)` — normaliza **lo que busco**.
2. `.lower()` — quita también la sensibilidad a mayúsculas. Uno de los archivos
   se llama `CATÁLOGO DE PRODUCTOS...` en mayúsculas y los demás en minúsculas.
3. `unicodedata.normalize("NFC", p.name)` — normaliza **lo que hay en disco**, a
   la misma forma. Éste es el paso que hace la comparación válida.
4. `objetivo in ...` — coincidencia parcial, no igualdad. Así el script no se
   rompe si el INE publica el mismo catálogo con `_FEB2026` al final.
5. `sorted(...)` — orden determinista: si dos archivos coincidieran con el
   fragmento, siempre gana el mismo.
6. `raise SystemExit(...)` — falla ruidoso, con la ruta donde buscó.

Y la comprobación que impide que esto vuelva
([build_ine_cartografia.py:426](backend/datalab/pipeline/build_ine_cartografia.py#L426)):

```python
    nfc = archivo(unicodedata.normalize("NFC", "Catálogo de Secciones.txt"))
    nfd = archivo(unicodedata.normalize("NFD", "Catálogo de Secciones.txt"))
    assert nfc == nfd, "archivo() no es estable ante NFC/NFD"
```

Le pasa el mismo nombre en las dos formas y exige el mismo resultado.

**El concepto con nombre:** **Unicode normalization** y, en general,
**canonical equivalence**: dos secuencias de code points distintas que
representan el mismo texto. El error concreto se conoce como el problema de
**NFC vs NFD en macOS** (APFS y HFS+ normalizan a NFD; Linux guarda los bytes
tal cual, normalmente NFC; de ahí que el mismo script funcione en Linux y falle
en Mac, o al revés).

La analogía: es el mismo tipo de error que comparar `"5"` con `5`. En pantalla
se ven igual, para una persona son lo mismo, y para la máquina son cosas
distintas. La diferencia es que aquí ni siquiera **se ven** distintos al
imprimirlos, lo que lo hace mucho peor de diagnosticar.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `glob('*Secciones*')`?** `glob` compara a nivel de bytes, así que
  arrastra el mismo problema en cuanto el patrón lleve un acento. Funciona sólo
  si el fragmento es puro ASCII — o sea, funciona por accidente, y se rompe el
  día que alguien "mejore" el patrón poniéndole la tilde.
- **¿Por qué NFC y no NFD como forma de comparación?** Da igual mientras sea
  **la misma en ambos lados**; lo que rompe es mezclarlas. Se eligió NFC porque
  es lo que produce cualquier editor de texto, así que un literal tecleado en el
  código ya está en esa forma.
- **¿Por qué no renombrar los archivos a ASCII y ya?** Porque son el crudo. El
  crudo no se toca — es la misma regla que impide editar los XLSX del IEEC.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **copiar el nombre exacto desde la terminal** y pegarlo en el
código. Funciona hoy y falla en cuanto: (a) alguien reescriba la línea a mano,
(b) el archivo se edite en Windows o Linux —que normalizan distinto— y vuelva,
(c) el INE publique el catálogo con el nombre ligeramente cambiado. Y el modo de
fallo es un `FileNotFoundError` sobre un archivo que está ahí y se ve idéntico:
media hora perdida como mínimo, más si nadie sospecha de Unicode.

**Cómo lo dirías en una entrevista:**
> "Los catálogos del INE traen acentos en el nombre y `open()` fallaba con
> `FileNotFoundError` aunque el archivo estuviera ahí: macOS almacena los
> nombres en NFD y el literal del código estaba en NFC, dos secuencias de code
> points distintas que se renderizan idénticas. Lo resolví localizando el
> archivo por fragmento con `unicodedata.normalize` aplicado a los dos lados
> antes de comparar, y dejé un assert que le pasa el mismo nombre en NFC y NFD
> y exige el mismo resultado."

---

## 2026-08-15 — Los partidos no tenían clave: había que identificarlos por su logotipo

**El problema real:** Los 21 archivos `DIP MR NN_SEC.xlsx` del IEEC traen los
votos por sección, una columna por contendiente. Pero **el encabezado no dice
qué partido es cada columna**: la fila de títulos está vacía y arriba de cada
columna hay un **logotipo PNG incrustado** en la hoja. Un humano abre el Excel,
ve el logo de MORENA y entiende; un script ve una columna sin nombre. Peor: el
número de columnas **cambia entre distritos** — el distrito 20 (Palizada) tuvo
12 contendientes y no 16. Así que tampoco se podía fijar el orden a mano y
asumir "columna 3 = PRD" para todos los archivos.

**La solución aplicada:** Abrir el `.xlsx` como lo que realmente es —un ZIP— y
leer el XML de dibujos que dice **qué imagen está anclada a qué columna**. De
cada imagen se calcula una huella digital (MD5), y esa huella se busca en una
tabla que mapea huella → partido. La tabla se armó una sola vez, abriendo las 16
imágenes del distrito 01 y viéndolas una por una.

**Tecnología y librerías usadas:**

- **`zipfile`** (librería estándar de Python) — `zipfile.ZipFile(ruta)` abre un
  archivo comprimido y permite leer los archivos de adentro sin descomprimir a
  disco. Se usa porque un `.xlsx` **es** un ZIP: adentro trae XMLs y las
  imágenes en `xl/media/`.
- **`xml.etree.ElementTree`** (estándar, importado como `ET`) —
  `ET.fromstring(texto_xml)` convierte texto XML en un árbol navegable.
  `.find(ruta, namespaces)` busca el primer nodo que coincide con una ruta.
- **`hashlib`** (estándar) — `hashlib.md5(bytes).hexdigest()` calcula una
  **huella digital** de unos bytes: un texto de 32 caracteres hexadecimales que
  cambia por completo si cambia un solo byte del contenido. Dos archivos con el
  mismo MD5 son, en la práctica, el mismo archivo.
- **`openpyxl`** — se usa para leer las *celdas* (los números de votos), no las
  imágenes. `openpyxl` no expone el anclaje de imágenes a columnas, por eso las
  imágenes se leen "a mano" con `zipfile` + `ElementTree`.

**El proceso paso a paso:**

La tabla de huellas, con el MD5 recortado a 10 caracteres (suficiente para
distinguir 16 imágenes, y más legible):

```python
LOGOS = {
    "53f6f0c774": "PAN", "9ed00dbd2a": "PRI", "dd760eb936": "PRD",
    "0a9b95bdc5": "PT", "218af52a33": "PVEM", "b5aa4ac150": "MC",
    "f48fc80378": "MORENA", "60336feb7f": "PES", "62aadc010f": "CL",
    ...
}
```

Y la función que resuelve columna → partido
([build_electoral.py:323](backend/datalab/pipeline/build_electoral.py#L323)):

```python
def columnas_partido(ruta):
    """{columna de votos -> clave de partido}, leyendo los logotipos."""
    z = zipfile.ZipFile(ruta)
    rels = {r.get("Id"): r.get("Target") for r in
            ET.fromstring(z.read("xl/drawings/_rels/drawing1.xml.rels"))}
    dibujo = ET.fromstring(z.read("xl/drawings/drawing1.xml"))

    cols = {}
    for anclaje in dibujo:
        desde = anclaje.find("xdr:from", NS_DIBUJO)
        blip = anclaje.find(".//a:blip", NS_DIBUJO)
        if desde is None or blip is None:
            continue
        col = int(desde.find("xdr:col", NS_DIBUJO).text)
        destino = rels[blip.get(ATTR_EMBED)].replace("../", "xl/")
        h = hashlib.md5(z.read(destino)).hexdigest()[:10]
        if h not in LOGOS:
            raise SystemExit(
                f"{ruta.name}: logotipo desconocido en la columna {col} "
                f"(md5 {h}). Hay un contendiente que no está en LOGOS.")
        cols[col] = LOGOS[h]
    return cols
```

Qué hace cada parte:

1. `zipfile.ZipFile(ruta)` — abre el xlsx como ZIP.
2. `z.read("xl/drawings/_rels/drawing1.xml.rels")` — lee el archivo de
   *relaciones*: una tabla que dice "el ID `rId3` apunta al archivo
   `../media/image3.png`". Excel guarda las imágenes por ID, no por ruta.
3. `rels = {r.get("Id"): r.get("Target") for ...}` — convierte esas relaciones
   en un diccionario `{ID: ruta_de_la_imagen}`.
4. `z.read("xl/drawings/drawing1.xml")` — lee el archivo de *dibujos*: qué
   imagen está anclada a qué celda.
5. `anclaje.find("xdr:from")` — la esquina superior izquierda del anclaje, o
   sea dónde empieza la imagen.
6. `int(desde.find("xdr:col", NS_DIBUJO).text)` — **el número de columna**. Éste
   es el dato que conecta la imagen con los votos.
7. `blip.get(ATTR_EMBED)` — el ID de la imagen (`rId3`). "Blip" es como el
   formato OOXML llama a una referencia de imagen.
8. `rels[...].replace("../", "xl/")` — traduce el ID a la ruta real dentro del
   ZIP. El `replace` es porque la ruta viene relativa a `xl/drawings/`.
9. `hashlib.md5(z.read(destino)).hexdigest()[:10]` — lee los bytes del PNG y
   calcula su huella.
10. `cols[col] = LOGOS[h]` — devuelve `{3: "PRD", 4: "PT", ...}`.

**El concepto con nombre:** **Entity resolution** (resolución de entidades) sin
clave explícita, resuelta con **content-addressed identification** —
identificar algo por el hash de su contenido en vez de por un nombre o ID.

La analogía: es lo mismo que hace Git. Git no identifica un archivo por su
nombre —el nombre puede cambiar— sino por el hash SHA-1 de su contenido. Aquí el
logotipo del PAN no tiene nombre, pero su contenido *es* su identidad.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `pandas`?** `pandas.read_excel()` habría sido lo obvio para leer
  las celdas, pero **no puede ver las imágenes**: devuelve un DataFrame de
  valores y las columnas sin encabezado quedan como `Unnamed: 3`, `Unnamed: 4`.
  El dato que resuelve el problema (qué logo está en qué columna) vive fuera de
  la tabla. Se usó `openpyxl` para las celdas porque además `pandas` habría
  cargado los 21 archivos de 3 MB completos en memoria, cuando lo que se
  necesita es recorrerlos fila por fila.
- **¿Por qué MD5 y no SHA-256?** MD5 está roto para criptografía (se pueden
  fabricar colisiones a propósito), pero aquí **no es un uso de seguridad**:
  nadie está atacando el archivo, sólo hay que distinguir 16 PNGs entre sí. MD5
  es más rápido y el hexdigest es más corto de leer en la tabla. Si esto fuera
  una verificación de integridad contra manipulación, SHA-256 sería lo correcto.
- **¿Por qué recortar a 10 caracteres (`[:10]`)?** Legibilidad de la tabla
  `LOGOS`. Con 16 valores, la probabilidad de colisión en 10 hex es
  despreciable, y si ocurriera el script lo detectaría en la verificación.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa obvia era **abrir un archivo y anotar el orden de columnas a
mano**: `PARTIDOS = ["PAN", "PRI", ...]` y leer por posición. Se descartó por un
motivo concreto y verificable: **el distrito 20 tiene 12 contendientes, no 16**.
Un orden fijo habría leído los votos del distrito 20 corridos cuatro columnas y
habría asignado votos del PAN a MORENA — sin error, sin aviso, con números que
suman y se ven plausibles. Ése es exactamente el tipo de bug que nadie
encuentra hasta que alguien toma una decisión con el número mal.

La segunda alternativa era **OCR o clasificación de imágenes** para "leer" el
logo. Descartada por absurda para 16 imágenes fijas: agrega una dependencia
pesada y una fuente de error (un OCR se equivoca) para resolver algo que un
diccionario de 16 entradas resuelve de forma exacta y determinista.

**Cómo lo dirías en una entrevista:**
> "Los resultados electorales venían en Excel sin encabezados de columna: los
> partidos estaban como logotipos PNG incrustados. Abrí el `.xlsx` con `zipfile`
> —que en el fondo es un ZIP con XMLs—, parseé `xl/drawings/drawing1.xml` con
> `xml.etree.ElementTree` para sacar el anclaje imagen→columna, y usé
> `hashlib.md5()` sobre los bytes de cada imagen para identificar el partido
> contra una tabla de huellas. Es content-addressed identification: cuando la
> entidad no tiene clave, el hash de su contenido *es* la clave."

---

## 2026-08-15 — Verificar que el mapeo de columnas cuadra contra un total que ya viene en el archivo

**El problema real:** Después de resolver qué columna es qué partido, quedaba
una pregunta sin responder: **¿cómo sé que no me equivoqué?** Si el mapeo
estuviera corrido una columna, el JSON de salida se generaría igual, con números
que suman bien y se ven razonables. No hay nada en el resultado que grite
"esto está mal". Y hablamos de 542 secciones × 16 columnas: nadie lo revisa a
ojo.

**La solución aplicada:** Aprovechar que el archivo del IEEC **ya trae la
respuesta**. Además de las columnas de partido, cada fila tiene una columna
`VOTOS VÁLIDOS` calculada por el propio IEEC. Si mi lectura de las 16 columnas
es correcta, su suma tiene que dar **exactamente** ese número. Si no da, el
mapeo está mal. Es una comprobación independiente: el dato de control no lo
produje yo, lo produjo la fuente.

**Tecnología y librerías usadas:**

- **Python puro**, sin librería. Una list comprehension y `sum()`.
- **`sys.exit()` / `raise SystemExit(mensaje)`** — termina el programa con
  código de salida distinto de cero y escribe el mensaje en la terminal. Un
  código de salida ≠ 0 es la señal universal de "esto falló", que cualquier
  orquestador (cron, Makefile, CI) sabe leer.

**El proceso paso a paso:**

([build_electoral.py:530](backend/datalab/pipeline/build_electoral.py#L530))

```python
def verificar(secciones):
    """La suma de las 16 columnas de partido tiene que dar VOTOS VÁLIDOS.
    Si el IEEC cambia el orden o el número de columnas, aquí se rompe."""
    malas = [s for s, r in secciones.items()
             if sum(r["votos"].values()) != r["validos"]]
    if malas:
        raise SystemExit(
            f"El mapeo de columnas de partido no cuadra en {len(malas)} "
            f"secciones (ej. {malas[:5]}). Revisa PARTIDOS y COL_*.")
```

Qué hace cada parte:

1. `secciones.items()` — recorre todas las secciones, cada una con su registro
   `r` que trae `r["votos"]` (dict `{partido: número}`) y `r["validos"]` (el
   número que venía en el archivo).
2. `sum(r["votos"].values())` — suma **mi** lectura de las 16 columnas.
3. `!= r["validos"]` — la compara contra **el total de la fuente**.
4. `malas = [...]` — junta **todas** las secciones que no cuadran, no se detiene
   en la primera. Saber que fallan 3 secciones es un problema distinto que saber
   que fallan 542: lo primero es un caso raro, lo segundo es el mapeo entero mal.
5. `malas[:5]` en el mensaje — da ejemplos concretos para ir a mirar, sin
   vomitar 542 números en la terminal.

Y se llama **antes** de calcular nada derivado
([build_electoral.py:553](backend/datalab/pipeline/build_electoral.py#L553)):

```python
secciones, notas, anticipado = leer_resultados()
verificar(secciones)
for reg in secciones.values():
    rematar(reg)
```

El orden importa: primero se valida el dato crudo, después se calculan ganador,
margen y participación. No tiene sentido calcular un ganador sobre votos que no
cuadran.

**El concepto con nombre:** **Reconciliation** (reconciliación) o **control
total**. En términos más generales, un **data quality check** de tipo
*integrity check*, y específicamente un **cross-foot**: verificar que el detalle
suma al total que ya viene declarado.

La analogía: es exactamente lo que hace un contador al cuadrar una cuenta
bancaria. No revisa si cada movimiento "se ve bien" — suma todos los movimientos
y verifica que el resultado dé el saldo que el banco reporta. Si no cuadra, hay
un error en algún lado y hay que buscarlo, aunque cada movimiento por separado
parezca correcto.

**Por qué esta tecnología y no otra:**

Existían opciones de librería: **Great Expectations**, **Pandera** o **dbt
tests** son frameworks de data quality que declaran reglas de validación de
forma estructurada y generan reportes. Se descartaron porque este pipeline tiene
**una sola regla de validación** y corre a mano cada tres años. Instalar un
framework de validación con su configuración, su formato de suites y sus
dependencias para expresar `sum(a) == b` es agregar cientos de megas y un
concepto nuevo que aprender a cambio de tres líneas que ya funcionan. Si el
pipeline creciera a 20 reglas sobre 10 fuentes, Pandera empezaría a pagar.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **validar en el frontend**: cargar el JSON y comprobar ahí
que todo cuadra. Se descartó porque para cuando el dato llega al navegador **ya
está publicado**: el JSON está commiteado, desplegado y alguien lo está mirando.
Una validación que corre después de publicar no previene nada, sólo documenta el
desastre. La validación tiene que estar en el punto donde todavía se puede
abortar sin consecuencias — es decir, en el pipeline, antes de escribir el
archivo de salida.

**Cómo lo dirías en una entrevista:**
> "Como el mapeo de columnas era inferido y no declarado, agregué un control de
> reconciliación: la suma de las 16 columnas de partido tiene que dar
> exactamente la columna de votos válidos que ya venía calculada en la fuente.
> Corre antes de generar cualquier campo derivado y aborta con `SystemExit` si
> falla, acumulando todos los casos malos en vez de parar en el primero. Es un
> cross-foot: uso un total que yo no produje para validar el detalle que sí."

---

## 2026-08-15 — Un logotipo desconocido detiene el proceso en vez de seguir en silencio

**El problema real:** ¿Qué debe pasar si el IEEC publica los archivos de 2027 y
aparece un partido nuevo, o alguno cambia su logotipo? Mi tabla `LOGOS` no lo
tiene. La reacción "natural" al programar es defensiva: saltarse esa columna, o
etiquetarla como `"OTRO"`, y seguir. **Ésa es la peor opción posible.** El
pipeline terminaría "bien", generaría los JSON, y los votos de ese partido
simplemente no existirían en el sistema. Los porcentajes se recalcularían sobre
un total incompleto y todo se vería normal.

**La solución aplicada:** Que reviente. Ante un logotipo que no está en la
tabla, el proceso **aborta inmediatamente** con un mensaje que dice el archivo,
la columna y el MD5 desconocido — o sea, exactamente lo que hace falta para
arreglarlo.

**Tecnología y librerías usadas:**

- **`raise SystemExit(mensaje)`** (Python estándar) — lanza la excepción que
  termina el intérprete. A diferencia de `raise Exception(...)`, no imprime un
  stack trace: imprime sólo tu mensaje y sale con código 1. Para un script de
  línea de comandos es lo correcto — el stack trace no le dice nada útil a quien
  corre el pipeline, el mensaje sí.
- **f-strings** (`f"..."`) — interpolación de variables dentro del texto, para
  que el mensaje de error lleve los valores concretos y no un texto genérico.

**El proceso paso a paso:**

La guarda dentro del bucle de logotipos
([build_electoral.py:339](backend/datalab/pipeline/build_electoral.py#L339)):

```python
        h = hashlib.md5(z.read(destino)).hexdigest()[:10]
        if h not in LOGOS:
            raise SystemExit(
                f"{ruta.name}: logotipo desconocido en la columna {col} "
                f"(md5 {h}). Hay un contendiente que no está en LOGOS.")
        cols[col] = LOGOS[h]
```

Qué hace cada parte:

1. `if h not in LOGOS` — la comprobación explícita. Nótese que **no** hay un
   `LOGOS.get(h, "OTRO")`, que sería la forma silenciosa de lo mismo.
2. `f"{ruta.name}: ..."` — **qué archivo**. Con 21 archivos, no saber cuál falló
   convierte un arreglo de dos minutos en media hora de búsqueda.
3. `en la columna {col}` — **dónde**. Permite abrir el Excel e ir directo.
4. `(md5 {h})` — **el valor que falta**. Éste es el detalle que convierte el
   error en accionable: el arreglo es literalmente copiar ese hash a la tabla
   `LOGOS` con su partido. El mensaje de error contiene la mitad de la solución.
5. `Hay un contendiente que no está en LOGOS` — **qué significa**, en lenguaje
   del dominio, no del código.

El mismo criterio se aplica al encabezado de totales
([build_electoral.py:351](backend/datalab/pipeline/build_electoral.py#L351)):

```python
    faltan = [e for e in ("VOTOS VÁLIDOS", "CANDIDATURAS NO REGISTRADAS",
                          "VOTOS NULOS", "TOTAL", "LISTA NOMINAL")
              if e not in etiquetas]
    if faltan:
        raise SystemExit(f"Encabezado inesperado, faltan columnas: {faltan}")
```

**El concepto con nombre:** **Fail fast / fail loud**, y su opuesto que hay que
evitar: **silent failure** o **silent data corruption**. En pipelines de datos
también se le llama **poison pill**: un registro que el sistema no sabe procesar
y que debe detenerlo, no colarse.

La analogía: el sensor de oxígeno de un avión. Si deja de reconocer su lectura,
lo correcto es encender una alarma roja, no reportar "todo normal" porque el
valor no encaja en el rango esperado. Un dato que no se entiende nunca debe
convertirse en un dato que parece bueno.

**Por qué esta tecnología y no otra:**

Se consideró **`logging.warning()` + continuar**, que es el patrón habitual en
código de producción de larga duración (un servidor no puede caerse porque un
registro venga raro). Se descartó porque este pipeline es **batch, corre a mano
y su salida se commitea**: si emite un warning, el warning se pierde en la
terminal, el JSON se genera igual, y el `git commit` publica el dato roto. En
un proceso donde el resultado se publica sin revisión humana intermedia, un
warning **es** un fallo silencioso con extra pasos.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa de diseño era **tolerancia a lo desconocido**: mapear el logo
desconocido a una categoría `"OTRO"` y sumar ahí. Se descartó porque rompe la
verificación que sostiene todo el pipeline —la suma de partidos contra `VOTOS
VÁLIDOS`— o peor, la *satisface* mientras el dato está mal atribuido. Y sobre
todo: en datos electorales, atribuirle a "OTRO" los votos de un partido real es
falsear el resultado. Prefiero un pipeline que no corre a un pipeline que
publica una mentira aritméticamente consistente.

**Cómo lo dirías en una entrevista:**
> "Diseñé el pipeline para fallar ruidosamente: si aparece un logotipo cuyo MD5
> no está en la tabla de partidos, lanzo `SystemExit` con el archivo, la columna
> y el hash desconocido, en vez de mapearlo a 'otros' y continuar. En un proceso
> batch cuya salida se commitea y publica sin revisión, un warning es un fallo
> silencioso: nadie lo lee y el dato malo llega a producción igual. El mensaje
> de error incluye el hash justamente para que contenga la mitad del arreglo."

---

## 2026-08-15 — 170 casillas sin coordenada: publicarlas como faltantes en vez de inventarles un punto

**El problema real:** El encarte del INE dice dónde se instaló cada casilla,
pero **no publica coordenadas**: sólo un domicilio en texto libre, tipo
`"PRIMARIA MAESTROS CAMPECHANOS, CALLE 12 S/N, COL. CENTRO"`. Para poner los
puntos en el mapa hubo que cruzar el nombre del inmueble contra el catálogo de
Centros de Trabajo (CCT) de la SEP, que sí tiene coordenadas. De **585 sitios,
415 cruzaron y 170 no**. De esos 170, unos 85 nunca van a cruzar porque **no son
escuelas**: son parques, mercados, canchas, casas ejidales, domicilios
particulares. No están en el catálogo CCT y no lo van a estar nunca.

La pregunta de diseño: ¿qué hago con 170 casillas reales, que existieron y donde
votó gente, pero de las que no tengo coordenada?

**La solución aplicada:** Publicarlas **aparte, en su propio archivo, cada una
con el motivo por el que no se pudo geolocalizar**. No se dibujan en el mapa. No
se les asigna el centroide de su municipio. No se omiten en silencio. El
faltante queda como un dato en sí mismo, contable y auditable.

**Tecnología y librerías usadas:**

- **`json`** (estándar) — `json.dumps(obj, ensure_ascii=False)` serializa a
  texto. El `ensure_ascii=False` es importante aquí: sin él, Python escapa los
  acentos como `ó` y `"Champotón"` queda ilegible en el archivo.
- **`pathlib`** (estándar) — `pathlib.Path.write_text(texto, encoding="utf-8")`
  escribe el archivo completo, sin `open()` ni `close()`.
- **GeoJSON** (formato, RFC 7946) — el estándar para geometría en JSON.
  **Leaflet.js** lo consume directo con `L.geoJSON(datos)`. Los 415 que sí
  cruzaron salen como GeoJSON; **los 170 salen como JSON plano a propósito**,
  porque un Feature de GeoJSON sin geometría es un contrasentido.

**El proceso paso a paso:**

1. El cruce devuelve **o una escuela, o un motivo** — nunca `None` a secas
   ([build_electoral.py:220](backend/datalab/pipeline/build_electoral.py#L220)):

```python
def cruzar(inmueble, municipio, localidad, cct):
    """Devuelve (escuela, similitud) o (None, motivo)."""
    n = norm(inmueble)
    if n.startswith(NO_ESCUELA):
        return None, "no es plantel escolar"

    tokens = distintivo(inmueble)
    if not tokens:
        return None, "el encarte no nombra el inmueble"
    ...
    if puntaje < UMBRAL_CRUCE:
        return None, "sin coincidencia en el catálogo CCT"
    return mejor, round(min(puntaje, 1.0), 3)
```

La firma es la clave del patrón: **el fallo viene acompañado de su causa**. Hay
tres motivos distintos y no son lo mismo — "no es plantel escolar" es
irresoluble por cruce de nombres, "sin coincidencia" quizá se arregle afinando.

2. Quien llama **bifurca y guarda ambos lados**
   ([build_electoral.py:289](backend/datalab/pipeline/build_electoral.py#L289)):

```python
        if escuela:
            props.update({
                "cct": escuela["cct"],
                "nombre_cct": escuela["nombre"],
                "metodo_geo": "cruce nominal contra catálogo CCT de la SEP",
                "similitud_cruce": dato,
            })
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": escuela["coords"]},
                "properties": props,
            })
        else:
            props["motivo_sin_geo"] = dato
            sin_geo.append(props)
```

Nótese `"metodo_geo"` y `"similitud_cruce"` en los que **sí** cruzaron: hasta el
éxito declara cómo se obtuvo y con cuánta confianza. Un punto con similitud 1.0
(nombre idéntico) no vale lo mismo que uno con 0.58 (cruce apenas por encima del
umbral), y el consumidor puede distinguirlos.

3. El archivo de faltantes explica en su propia metadata para qué existe
   ([build_electoral.py:634](backend/datalab/pipeline/build_electoral.py#L634)):

```python
    (SALIDA / "casillas_2024_sin_geo.json").write_text(json.dumps({
        "metadata": {
            "fuente": FUENTE_ENCARTE,
            "fecha_corte": FECHA_CORTE,
            "que_es": "Sitios del encarte 2024 que no se pudieron geolocalizar. "
                      "Se publican para que el faltante sea auditable, no para "
                      "dibujarlos en el mapa.",
        },
        "sitios": sin_geo,
    }, ensure_ascii=False), encoding="utf-8")
```

4. Y el conteo se publica en la metadata del GeoJSON bueno, para que **nadie
   crea que 415 son todas**:

```python
            "sitios_totales": n_sitios,
            "sitios_geolocalizados": len(features),
            "sitios_sin_coordenada": len(sin_geo),
```

**El concepto con nombre:** **Explicit missingness** — declarar el faltante en
vez de imputarlo. El contraste es con **imputation** (rellenar el hueco con un
valor estimado: media, moda, centroide). También: el archivo de rechazados es un
**reject store** o **quarantine table**, patrón estándar de ingesta.

La analogía: un inventario de almacén. Si faltan 170 cajas, escribes "faltan 170
cajas y aquí está por qué" — no pones el promedio de las otras estanterías para
que el total cuadre. Un inventario que cuadra por relleno es peor que uno que no
cuadra, porque el que no cuadra al menos te avisa.

**Por qué esta tecnología y no otra:**

Para el cruce de nombres se consideró **`fuzzywuzzy` / `rapidfuzz`** (librerías
de fuzzy string matching con distancia de Levenshtein) en vez de la **similitud
de Jaccard sobre conjuntos de tokens** que se implementó a mano:

```python
        j = len(tokens & e["tokens"]) / len(tokens | e["tokens"])
```

Se descartó por una razón concreta del dominio: **Levenshtein compara letra por
letra**, y aquí el ruido no está en las letras sino en **palabras enteras
sobrantes**. `"ESCUELA PRIMARIA BENITO JUÁREZ"` contra `"BENITO JUÁREZ"` da una
distancia de edición enorme y una similitud de Jaccard alta — y la respuesta
correcta es que sí son el mismo lugar. Por eso se eliminan las palabras
genéricas antes de comparar (`GENERICAS`: ESCUELA, PRIMARIA, JARDIN, DE, LA…) y
se compara el conjunto de tokens distintivos. Además se agregó un desempate por
localidad, porque `"Benito Juárez"` aparece en 9 municipios de Campeche:

```python
        if e["localidad"] == localidad:
            j += 0.15
```

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

Las dos alternativas obvias, y por qué ninguna servía:

- **Asignar el centroide del municipio a los 170 sin coordenada.** El mapa se
  vería completo. Y sería una mentira gráfica: aparecerían 170 casillas apiladas
  en el centro geométrico de cada municipio, y quien planeara la logística del
  día de la elección concluiría que están todas juntas y son fáciles de cubrir.
  El dato equivocado sería *invisible* porque el mapa se ve bien.
- **Bajar el `UMBRAL_CRUCE` de 0.55 hasta que crucen todas.** Sube la cobertura
  y baja la precisión: empieza a asignar coordenadas *incorrectas*, que es peor
  que no tenerlas — una coordenada errónea no se distingue de una correcta.
  Los ~85 sitios que no son escuelas no van a cruzar con ningún umbral, porque
  no están en el catálogo. Por eso el README dice que la forma de bajar el
  faltante es **conseguir las coordenadas del INE**, no afinar el cruce.

**Cómo lo dirías en una entrevista:**
> "Geolocalicé casillas cruzando nombres de inmuebles contra el catálogo CCT de
> la SEP con similitud de Jaccard sobre tokens, quitando palabras genéricas y
> desempatando por localidad. 415 de 585 cruzaron. Los 170 restantes los publiqué
> en un archivo aparte con el motivo de cada fallo, en vez de imputarles el
> centroide del municipio: explicit missingness. En datos geográficos una
> coordenada imputada es indistinguible de una real, así que rellenar el hueco
> habría hecho el error invisible. Además exporto el conteo en la metadata para
> que nadie asuma que los 415 son el universo completo."

---

## 2026-08-15 — Cruzar municipios por nombre normalizado y no por el número que trae la fuente

**El problema real:** Los municipios vienen numerados en dos fuentes distintas
que **usan numeraciones diferentes**. El encarte del INE los enumera con el
orden del INE; el Marco Geoestadístico del INEGI usa la clave oficial
(`04001`…`04013`). Cruzar "municipio 3 del encarte" con "municipio 3 del INEGI"
da dos municipios distintos. Y a eso se suma que el encarte trae los nombres
sucios: en mayúsculas, sin acentos, con un índice pegado al frente
(`"1) SAN FRANCISCO DE CAMPECHE"`), con espacios sobrantes (`"DZITBALCHE "`).

**La solución aplicada:** No usar nunca el número. Se cruza **por nombre**,
pasando ambos lados por la misma función de normalización, contra una tabla
`CVE_MUN` que mapea nombre normalizado → clave INEGI. La clave INEGI es la que
se publica, porque es la que entiende cualquier otra fuente de datos de México.

**Tecnología y librerías usadas:**

- **`unicodedata`** (estándar) — `unicodedata.normalize("NFD", texto)`
  descompone cada carácter acentuado en dos: la letra base y el acento por
  separado (`"ó"` → `"o"` + `´`). Combinado con
  `.encode("ascii", "ignore").decode()` elimina los acentos: los caracteres
  combinantes no son ASCII y el `"ignore"` los descarta. Es la forma estándar de
  quitar diacríticos sin una tabla de reemplazos a mano.
- **`re`** (estándar, regex) — `re.sub(patrón, reemplazo, texto)` sustituye todo
  lo que coincide. Aquí convierte cualquier cosa que no sea letra o número en
  espacio.
- **`str.split()` / `" ".join()`** — colapsan espacios múltiples: `split()` sin
  argumentos parte por cualquier cantidad de espacios y descarta los vacíos.

**El proceso paso a paso:**

La función de normalización
([build_electoral.py:162](backend/datalab/pipeline/build_electoral.py#L162)):

```python
def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9 ]", " ", s).upper()
    return " ".join(ABREV.get(t, t) for t in s.split())
```

Paso por paso sobre `"Champotón"`:

1. `str(s)` — fuerza a texto; una celda de Excel puede venir como número.
2. `unicodedata.normalize("NFD", ...)` — `"Champotón"` → `"Champoto" + "´" + "n"`.
3. `.encode("ascii", "ignore").decode()` — el acento se cae: `"Champoton"`.
4. `re.sub(r"[^A-Za-z0-9 ]", " ", s)` — puntuación y símbolos a espacio.
5. `.upper()` — `"CHAMPOTON"`.
6. `ABREV.get(t, t)` — expande abreviaturas token por token: `LIC`→`LICENCIADO`,
   `PROFR`→`PROFESOR`, `NUM`→`NUMERO`. La misma función sirve para nombres de
   escuela, donde estas abreviaturas abundan.
7. `" ".join(...)` — reensambla con un solo espacio entre tokens.

La tabla contra la que se cruza
([build_electoral.py:121](backend/datalab/pipeline/build_electoral.py#L121)):

```python
CVE_MUN = {
    "CALKINI": "04001", "CAMPECHE": "04002", "CARMEN": "04003",
    "CHAMPOTON": "04004", "HECELCHAKAN": "04005", "HOPELCHEN": "04006",
    ...
}
```

Y hay una **segunda** tabla, separada a propósito, para el nombre de
presentación:

```python
NOMBRE_MUN = {
    "04001": "Calkiní", "04002": "Campeche", "04003": "Carmen",
    "04004": "Champotón", ...
}
```

Esto es importante: **el nombre para cruzar y el nombre para mostrar son cosas
distintas**. Se cruza con `"CHAMPOTON"` y se publica `"Champotón"`. Mezclarlos
obliga a elegir entre un cruce frágil o una UI fea.

Y el índice pegado se quita antes
([build_electoral.py:173](backend/datalab/pipeline/build_electoral.py#L173)):

```python
def sin_indice(s):
    """'1) SAN FRANCISCO DE CAMPECHE' -> 'SAN FRANCISCO DE CAMPECHE'"""
    return str(s).split(")", 1)[-1].strip()
```

**El concepto con nombre:** **Natural key vs. surrogate key**, y
**canonicalización** (o *normalization*) de la clave antes de unir. En calidad
de datos, la función `norm()` es un **standardization step**; la tabla `CVE_MUN`
es una **crosswalk table** o **mapping table**.

La analogía: es como buscar un contacto en el teléfono. No lo buscas por "el
tercero de la lista" —el orden cambia cuando agregas gente— sino por su nombre.
Pero antes de comparar, el teléfono ignora mayúsculas y acentos, porque
"martin" y "Martín" son la misma persona.

**Por qué esta tecnología y no otra:**

- **¿Por qué no `unidecode`?** La librería `unidecode` hace transliteración más
  completa (convierte alfabetos no latinos, `"ñ"` → `"n"`, etc.). Se descartó
  porque es una dependencia externa para algo que `unicodedata` —que ya viene
  con Python— resuelve para texto en español. Ojo con el efecto secundario que
  aquí **conviene**: NFD + ASCII convierte `"ñ"` en `"n"`, así que `"CALKINÍ"` y
  `"CALKINI"` cruzan igual, y también lo harían `"CAMPEÑA"`/`"CAMPENA"`. Para 13
  municipios sin colisiones posibles, es aceptable.
- **¿Por qué un `dict` y no una fuzzy match?** Porque los municipios son 13,
  cerrados y conocidos. Un diccionario es exacto y determinista; el fuzzy
  matching sólo se justifica cuando el universo es abierto (como los ~2,300
  nombres de escuela, donde sí se usó Jaccard).

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **confiar en el número de municipio del encarte** y mapear
`1→04001, 2→04002…`. Se descartó porque la correspondencia **no es estable**: la
enumeración depende de la fuente y del año. Y hay un caso concreto que lo
demuestra: **Campeche pasó de 11 a 13 municipios en 2021**, cuando el congreso
local creó Dzitbalché y Seybaplaya. Cualquier numeración posicional anterior a
ese cambio está corrida a partir del punto de inserción. Un cruce por posición
habría asignado los votos de un municipio a otro en silencio — y otra vez, con
totales que suman bien.

Ese mismo riesgo está documentado en
[frontend/data/geo/PENDIENTE-INEGI-INE.md](frontend/data/geo/PENDIENTE-INEGI-INE.md):
si el shapefile del INEGI que llegue es de edición anterior a 2021, va a traer
11 polígonos y **el mapa va a mentir en silencio**. Por eso lo primero que se
verifica al recibirlo es que traiga 13.

**Cómo lo dirías en una entrevista:**
> "Las dos fuentes numeraban los municipios distinto, así que hice el join por
> nombre canonicalizado en vez de por ID: normalizo con `unicodedata.normalize`
> en NFD más encode a ASCII para quitar acentos, `re.sub` para la puntuación, y
> mapeo contra una crosswalk table hacia la clave INEGI. Mantengo separada la
> clave de cruce del nombre de presentación. La razón concreta es que Campeche
> pasó de 11 a 13 municipios en 2021: cualquier join posicional queda corrido a
> partir de ahí y falla en silencio."

---

## 2026-08-15 — El pipeline lee el XLSX crudo pero nunca lo escribe

**El problema real:** Los insumos del INE y del IEEC llegan sucios: acentos
inconsistentes, índices pegados a los nombres, celdas vacías al final de las
filas, valores numéricos guardados como texto. La reacción instintiva es
"limpiar el Excel" — abrirlo, arreglar lo que está mal, guardarlo. En el momento
en que haces eso, **el archivo deja de ser lo que la institución publicó** y ya
no puedes demostrar que tu número sale de la fuente oficial.

**La solución aplicada:** El crudo es de sólo lectura, por convención estricta.
El pipeline lo abre, lo interpreta y escribe **en otro lado**. Toda limpieza
vive en el código, no en el archivo. Si mañana descubro que una regla de
limpieza estaba mal, corrijo el código y **vuelvo a correr sobre el mismo crudo
intacto** — no tengo que ir a pedir el archivo original de nuevo.

**Tecnología y librerías usadas:**

- **`openpyxl`** — `openpyxl.load_workbook(ruta, read_only=True)` abre el Excel.
  El flag **`read_only=True`** hace dos cosas: activa un modo de lectura por
  streaming (no carga los 3 MB completos en memoria) y **hace imposible
  modificar y guardar** el archivo por accidente. Es la garantía técnica de la
  convención, no sólo una promesa.
- **`.iter_rows(values_only=True)`** — itera fila por fila devolviendo tuplas de
  valores en vez de objetos `Cell`. Más rápido y más simple cuando sólo
  interesa el contenido.
- **`pathlib.Path`** — `pathlib.Path(__file__).resolve().parents[3]` calcula la
  raíz del repo desde la ubicación del script, para que las rutas de entrada y
  salida sean absolutas y el script funcione desde cualquier directorio.

**El proceso paso a paso:**

Rutas de entrada y salida **explícitamente separadas**, arriba del archivo
([build_electoral.py:51](backend/datalab/pipeline/build_electoral.py#L51)):

```python
RAIZ = pathlib.Path(__file__).resolve().parents[3]
ENTRADA = RAIZ / "backend/datalab/uploads/ResultadosYCasillas"
SALIDA_GEO = RAIZ / "frontend/data/geo"
SALIDA = RAIZ / "frontend/data/electoral"
```

`ENTRADA` sólo aparece en operaciones de lectura; `SALIDA*` sólo en escrituras.
No hay una sola línea que escriba dentro de `ENTRADA`.

La apertura en modo lectura
([build_electoral.py:185](backend/datalab/pipeline/build_electoral.py#L185)):

```python
def leer_encarte():
    ws = openpyxl.load_workbook(ENTRADA / "ubicacionCasillas.xlsx",
                                read_only=True).active
```

Y una consecuencia del modo streaming que hubo que manejar
([build_electoral.py:363](backend/datalab/pipeline/build_electoral.py#L363)):

```python
def celda(fila, i):
    """openpyxl en read_only recorta las celdas vacías del final de la fila."""
    return fila[i] if i < len(fila) else None
```

En `read_only`, `openpyxl` no rellena las celdas vacías finales, así que las
filas tienen largos distintos y `fila[15]` puede reventar con `IndexError`. Este
helper de dos líneas absorbe esa rareza en un solo lugar en vez de repartir
`try/except` por todo el código.

La limpieza que **sí** ocurre, pero en memoria y declarada:

```python
def sin_indice(s):
    """'1) SAN FRANCISCO DE CAMPECHE' -> 'SAN FRANCISCO DE CAMPECHE'"""
    return str(s).split(")", 1)[-1].strip()

def entero(v):
    return int(v) if isinstance(v, (int, float)) else 0
```

**El concepto con nombre:** **Immutable raw layer** o **raw zone**. En la
terminología de lakehouse moderna es la **arquitectura medallón**: capa *bronze*
(crudo, tal cual llegó, inmutable), *silver* (limpio y validado), *gold*
(agregado y listo para consumir). Aquí `uploads/` es bronce, los JSON de sección
son plata, y los de municipio son oro. También se le llama **ELT** (extract,
load, transform) frente a **ETL**: primero se guarda el crudo, después se
transforma.

La analogía: los negativos de un rollo fotográfico. Editas las copias tantas
veces como quieras; el negativo no se toca, porque es de donde puedes volver a
sacar cualquier copia. Si rayas el negativo, no hay vuelta atrás.

**Por qué esta tecnología y no otra:**

- **¿Por qué `openpyxl` y no `pandas.read_excel()`?** `pandas` usa `openpyxl`
  por debajo de todos modos, pero envuelve todo en un DataFrame y carga el
  archivo completo. Aquí hacía falta control fila por fila (los encabezados
  ocupan 5 filas de altura variable, las columnas cambian entre archivos) y
  acceso al ZIP interno para las imágenes. Con `pandas` habría terminado
  peleando contra la abstracción. Para 21 archivos donde cada uno se lee una
  vez y de forma secuencial, la abstracción no aporta.
- **¿Por qué `read_only=True` explícito?** Además de la memoria, es una
  **restricción intencional**: convierte "acordarse de no escribir el crudo" en
  algo que el código impide. Las convenciones que dependen de la memoria del
  desarrollador se rompen; las que las impone la librería, no.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **limpiar los archivos una vez y trabajar sobre los
limpios**: quitar acentos, arreglar los encabezados, guardar
`ubicacionCasillas_limpio.xlsx` y que el pipeline lea ése. Se descartó por tres
razones concretas:

1. **Se pierde la trazabilidad.** Ante "¿de dónde sale este número?", la
   respuesta tiene que llegar hasta el archivo que publicó la institución. Con
   un intermedio editado a mano, la cadena se corta ahí y la limpieza no está
   documentada en ningún lado.
2. **No es reproducible.** Una limpieza manual no se puede volver a correr. Si
   llegan los datos de 2027, hay que repetir el trabajo a mano y esperar haber
   hecho exactamente lo mismo.
3. **Los errores de limpieza son permanentes.** Si el arreglo manual estaba mal,
   el error queda congelado en el archivo y no hay a qué volver.

Con el crudo intacto, corregir una regla es cambiar una línea de Python y
re-ejecutar. El costo de re-procesar los 21 archivos es de segundos.

**Cómo lo dirías en una entrevista:**
> "Mantengo una capa raw inmutable: los Excel del INE y el IEEC nunca se editan.
> Los abro con `openpyxl` en `read_only=True` —que además de hacer streaming
> impide guardar por accidente— y toda la limpieza vive en el código, con la
> salida escrita en directorios separados. Es la capa bronze de una arquitectura
> medallón: si una regla de normalización resulta estar mal, corrijo el código y
> reproceso el crudo original en segundos, sin volver a pedir el archivo ni
> repetir un trabajo manual que no puedo garantizar que sea idéntico."

---

## 2026-08-13 — Cada cifra en pantalla declara de dónde viene

**El problema real:** En la misma pantalla conviven cosas que **parecen iguales
pero no lo son**: `"Participación: 62.3%"` es un cálculo sobre votos reales del
IEEC; `"NSE medio: 41%"` es el resultado de un modelo propio con incertidumbre;
`"Ventaja estimada: +2.8 pp"` es una proyección; y varios tableros traen números
de demostración inventados. Las cuatro se ven idénticas: un número con una
etiqueta. Alguien que abre la herramienta para decidir dónde mandar gente el día
de la elección **no tiene forma de distinguirlas**, y va a tratar la estimación
con la misma confianza que el cómputo oficial.

**La solución aplicada:** Ninguna cifra se muestra sin una etiqueta visual que
declare su naturaleza. Seis tipos: `Dato` (viene de una fuente, sin
transformar), `Cálculo` (fórmula sobre datos de fuente), `Estimación` (modelo,
con incertidumbre), `Inferencia` (interpretación analítica), `Recomendación`
(acción que requiere autorización humana) y `Simulado` (dummy de demostración,
no apto para decidir). **Un solo módulo produce esas etiquetas** en toda la
aplicación.

**Tecnología y librerías usadas:**

- **JavaScript vanilla con IIFE** (Immediately Invoked Function Expression) — el
  patrón `(function (global) { ... })(window)`. Ejecuta la función al instante y
  encierra todo lo de adentro en su propio ámbito: sólo sale al exterior lo que
  se asigna explícitamente a `global`. Es el equivalente a un módulo cuando no
  hay bundler ni `import`/`export`.
- **Template literals** (las comillas invertidas `` ` ``) — permiten interpolar
  con `${}` y escribir HTML multilínea sin concatenar strings.
- **`String.prototype.replace()` con función de reemplazo** — la base del
  escapado de HTML.
- **Lucide** (íconos SVG, por CDN) — `lucide.createIcons()` recorre el DOM y
  convierte cada `<i data-lucide="database">` en su SVG. Hay que volver a
  llamarlo cada vez que se inyecta HTML nuevo, porque sólo procesa lo que está
  en el DOM al momento de correr.
- **Atributo `title`** del HTML — el tooltip nativo del navegador. Sin librería
  de tooltips, sin CSS, sin JS: funciona en todos lados y es accesible.

**El proceso paso a paso:**

1. Los tipos se declaran como datos, cada uno con su texto de ayuda
   ([procedencia.js:31](frontend/js/procedencia.js#L31)):

```javascript
  const TIPOS = {
    dato: {
      etiqueta: 'Dato',
      icono: 'database',
      ayuda: 'Proviene directamente de una fuente. No fue transformado.',
    },
    calculo: {
      etiqueta: 'Cálculo',
      icono: 'sigma',
      ayuda: 'Resultado de una fórmula aplicada sobre datos de fuente.',
    },
    estimacion: {
      etiqueta: 'Estimación',
      icono: 'trending-up',
      ayuda: 'Resultado de un modelo. Tiene incertidumbre asociada.',
    },
    ...
  };
```

2. `simulado` se declara **fuera** de `TIPOS`, a propósito
   ([procedencia.js:62](frontend/js/procedencia.js#L62)):

```javascript
  // Datos de demostración: no salen de ninguna fuente real y no deben
  // usarse para decidir nada. Se marcan aparte de los cinco tipos para
  // que nadie confunda un dummy con un dato de fuente.
  const SIMULADO = {
    etiqueta: 'Simulado',
    icono: 'flask-conical',
    ayuda: 'Valor sintético de demostración. No apto para decisiones.',
  };
```

Es una decisión de modelado, no de estilo: `simulado` no es "un sexto tipo de
dato", es la ausencia de dato. Al estar fuera del objeto, no se puede iterar
`TIPOS` y pintarlo por descuido, y la leyenda tiene que pedirlo explícitamente
(`leyenda(incluirSimulado)`).

3. El generador único de badges
   ([procedencia.js:81](frontend/js/procedencia.js#L81)):

```javascript
  function badge(tipo, op) {
    op = op || {};
    const t = tipo === 'simulado' ? SIMULADO : TIPOS[tipo];
    if (!t) {
      console.warn('Procedencia: tipo desconocido:', tipo);
      return '';
    }

    // El tooltip carga la definición y, si vienen, fuente y corte:
    // así ninguna cifra queda sin procedencia consultable.
    const tip = [
      t.ayuda,
      op.fuente ? `Fuente: ${op.fuente}` : '',
      op.fechaCorte ? `Corte: ${op.fechaCorte}` : '',
      op.confianza ? CONFIANZA[op.confianza] || op.confianza : '',
    ].filter(Boolean).join(' · ');

    return `<span class="proc proc--${tipo}${op.compacto ? ' proc--compacto' : ''}"
                  title="${escapar(tip)}">
      <i data-lucide="${t.icono}"></i><span class="proc__txt">${t.etiqueta}</span>${detalle}
    </span>`;
  }
```

Qué hace cada parte:

- `const tip = [...].filter(Boolean).join(' · ')` — arma el tooltip juntando la
  definición del tipo con los metadatos que vengan. `.filter(Boolean)` elimina
  las cadenas vacías (`''` es *falsy*), así no quedan separadores sueltos cuando
  falta un campo. Truco idiomático de JS que evita un `if` por campo.
- `escapar(tip)` — escapa el texto antes de meterlo en el atributo `title`.

4. El escapado, obligatorio porque **el texto viene de archivos externos**
   ([procedencia.js:70](frontend/js/procedencia.js#L70)):

```javascript
  function escapar(v) {
    if (v === null || v === undefined || v === '') return '';
    return String(v).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }
```

`replace` con regex global y una función: por cada carácter peligroso encontrado,
busca su reemplazo en un objeto-diccionario. Los nombres de municipio y de
fuente salen de JSON generados por el pipeline; si alguno trajera `<` o `"`,
rompería el HTML o inyectaría markup. Escapar es barato; confiar, no.

5. Y el pie de ficha, que exige lo mismo a nivel de sección
   ([procedencia.js:121](frontend/js/procedencia.js#L121)):

```javascript
  /**
   * Pie de ficha: fuente, corte, metodología y confianza.
   * Ninguna cifra de la app debe quedar sin uno de estos.
   */
  function pie(op) {
    const filas = [
      ['Fuente', op.fuente],
      ['Fecha de corte', op.fechaCorte || 'no declarada por la fuente'],
      ['Metodología', op.metodologia],
      ...
    ].filter(([, v]) => v);
```

Detalle que vale la pena: `op.fechaCorte || 'no declarada por la fuente'`. Si no
hay fecha de corte, **se dice que no la hay** en vez de omitir la fila. La
ausencia de la fila se leería como descuido; el texto explícito informa que la
fuente misma no la publica.

**El concepto con nombre:** **Data lineage** (linaje de datos) y **data
provenance** (procedencia), expuestos en la capa de presentación. La distinción
entre `Dato / Cálculo / Estimación` es una **taxonomía de derivación**: qué tan
lejos está un número del hecho observado. En estadística oficial hay un
equivalente formal: los organismos marcan sus cifras como *observadas*,
*estimadas*, *provisionales* o *proyectadas*.

La analogía: la etiqueta nutricional de un alimento. No sólo dice cuántas
calorías tiene; dice si el valor es medido o estimado, y de qué porción. El
número solo no significa nada sin saber cómo se obtuvo.

**Por qué esta tecnología y no otra:**

- **¿Por qué generar strings de HTML y no crear nodos con
  `document.createElement`?** Con `createElement` el escapado sería automático
  (`textContent` no interpreta HTML) y sería más seguro por defecto. Se
  descartó porque el resto de la aplicación construye vistas completas como
  template literals, y `badge()` se **incrusta dentro** de esas plantillas
  (`${P.badge('dato')}`). Devolver un nodo obligaría a un post-procesado en cada
  llamada. Se paga con la función `escapar()`, aplicada consistentemente a todo
  lo que entra.
- **¿Por qué el atributo `title` nativo y no Tippy.js o Popper?** Un tooltip
  bonito costaría una dependencia, un init por cada badge inyectado y CSS. El
  `title` nativo funciona sin nada, es accesible y no se rompe. La información
  importa más que la animación.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **poner la procedencia en cada plantilla a mano**: escribir
`<span class="badge-dato">Dato</span>` donde tocara. Se descartó porque una
regla que depende de que alguien se acuerde de aplicarla **no es una regla, es
una intención**. Con 24 páginas y varias vistas por página, la primera cifra sin
badge aparece el mismo día, y la etiqueta pierde sentido: si algunas cifras
tienen badge y otras no, la ausencia de badge deja de significar algo.

Al centralizarlo: (a) marcar una cifra cuesta menos que no marcarla, (b) cambiar
el criterio visual de toda la app es editar un archivo, y (c) un tipo mal
escrito emite un `console.warn` y devuelve `''` en vez de pintar una etiqueta
inventada.

La segunda alternativa era **poner la procedencia sólo en el pie de página de
cada sección**, no por cifra. Se descartó porque en las vistas conviven cifras
de distinta naturaleza en la misma tabla — en `demografia.js`, la población es
INEGI, la lista nominal es INE, y el cruce de ambas es un cálculo. Un pie único
tendría que mentir por generalización.

**Cómo lo dirías en una entrevista:**
> "Implementé un sistema de linaje de datos visible en la capa de presentación:
> cada cifra se renderiza con un badge que declara si es dato de fuente,
> cálculo, estimación, inferencia, recomendación o valor simulado, con fuente y
> fecha de corte en el tooltip. Lo centralicé en un solo módulo JS —vanilla, con
> patrón IIFE— para que marcar una cifra sea más barato que no marcarla, y con
> escapado de HTML porque el texto viene de JSON generados por el pipeline. La
> categoría 'simulado' vive fuera del objeto de tipos a propósito, para que un
> dummy no se pueda confundir con un dato real por iterar la lista."

---

## 2026-08-13 — Los filtros mueren al cerrar la pestaña, y eso es una decisión de negocio

**El problema real:** La plataforma tiene filtros globales (municipio, sección,
partido, año…) que se mantienen al navegar entre módulos, para no re-filtrar en
cada pantalla. La pregunta era **cuánto deben durar**. Lo cómodo —y lo que uno
escribe por reflejo— es `localStorage`: el filtro sobrevive al cierre del
navegador y el usuario lo encuentra donde lo dejó.

El escenario que eso habilita: alguien filtra por Champotón un martes, cierra el
navegador, y el jueves abre la herramienta para revisar el estado del estado.
Ve la pantalla **recortada a un municipio**, sin acordarse de que filtró, y saca
conclusiones sobre datos parciales creyendo que ve el total. En una herramienta
electoral, **ése es el modo de fallo caro**: no se rompe nada, no hay error, y
la conclusión está mal.

**La solución aplicada:** El estado activo vive en `sessionStorage` (muere al
cerrar la pestaña) **y** en la URL (que manda cuando trae parámetros).
`localStorage` queda reservado para preferencias que de verdad deban durar, como
el municipio por defecto de un rol.

**Tecnología y librerías usadas:**

- **`sessionStorage`** (Web Storage API) — almacén clave-valor por **pestaña**:
  sobrevive recargas y navegación dentro de la pestaña, y se borra al cerrarla.
  Dos pestañas tienen almacenes independientes. `localStorage` tiene la misma
  API pero persiste indefinidamente y es compartido entre todas las pestañas del
  mismo origen. La API sólo guarda strings: por eso `JSON.stringify` al escribir
  y `JSON.parse` al leer.
- **`URLSearchParams`** (API del navegador) — parsea y construye query strings
  sin manipular texto a mano. `q.get('mun')` lee un parámetro; `q.set()` lo
  escribe; `.toString()` arma la cadena con el escapado correcto.
- **`history.replaceState(estado, titulo, url)`** (History API) — cambia la URL
  de la barra de direcciones **sin recargar** y **sin agregar** una entrada al
  historial. Su hermana `pushState()` sí agrega entrada.
- **Patrón observador**, a mano — un array de callbacks (`suscriptores`) a los
  que se avisa cuando el estado cambia.

**El proceso paso a paso:**

1. La declaración del almacén, con el porqué escrito en el propio archivo
   ([filtros.js:19](frontend/js/filtros.js#L19)):

```javascript
     localStorage     NO se usa para el set activo. Si los filtros
                      sobrevivieran al cierre del navegador, alguien
                      abriría la herramienta días después, vería todo
                      recortado a un municipio sin acordarse de por qué
                      y sacaría conclusiones sobre datos parciales. En
                      una herramienta electoral ese es el modo de fallo
                      caro.
```

2. Escritura con degradación elegante
   ([filtros.js:87](frontend/js/filtros.js#L87)):

```javascript
  function escribirAlmacen(f) {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify({ v: VERSION, f }));
    } catch (e) {
      // Modo privado o cuota llena: los filtros siguen vivos en memoria
      // y en la URL, solo no sobreviven el salto de página.
      console.warn('Filtros: no se pudo persistir en sessionStorage.', e);
    }
  }
```

El `try/catch` no es decorativo: `sessionStorage.setItem` **lanza excepción** en
modo privado de algunos navegadores y cuando la cuota está llena. Sin el catch,
la app entera se caería por no poder guardar un filtro. Y hay tres capas: si
falla el almacén, el estado sigue en memoria y en la URL.

3. La URL manda sobre lo guardado
   ([filtros.js:178](frontend/js/filtros.js#L178)):

```javascript
  /* La URL manda cuando trae algo; si no, se recupera lo guardado. */
  function inicializar() {
    const deURL = leerURL();
    if (deURL) {
      estado = Object.assign({}, VACIO, deURL);
      escribirAlmacen(estado);
    } else {
      estado = Object.assign({}, VACIO, leerAlmacen() || {});
      // Sin parámetros en la URL pero con filtros guardados: se reflejan,
      // para que lo que se ve y lo que dice la barra de direcciones coincidan.
      if (activos().length) sincronizarURL();
    }
    return estado;
  }
```

Qué hace cada parte:

- `Object.assign({}, VACIO, deURL)` — parte de un objeto con **todas** las
  claves en `null` y encima aplica lo que venga. Garantiza que el estado siempre
  tenga la misma forma, sin claves faltantes.
- La precedencia **URL > almacén** es lo que hace que un enlace compartido
  funcione: si te mando `?mun=04002`, ves Campeche aunque tú tuvieras otro
  filtro guardado.
- La rama `else` con `sincronizarURL()` cierra el caso incómodo: filtros
  guardados pero URL limpia. Se reflejan en la URL **para que el estado sea
  siempre visible en la barra de direcciones**. Un filtro activo nunca queda
  invisible.

4. `replaceState` y no `pushState`, con la razón escrita
   ([filtros.js:119](frontend/js/filtros.js#L119)):

```javascript
  /* replaceState y no pushState: cambiar un filtro no debería llenar el
     historial de entradas que el botón atrás tenga que recorrer una por una. */
  function sincronizarURL() {
    const qs = aQueryString();
    const nueva = location.pathname + (qs ? '?' + qs : '') + location.hash;
    history.replaceState(null, '', nueva);
  }
```

5. Y una guarda contra notificaciones inútiles
   ([filtros.js:141](frontend/js/filtros.js#L141)):

```javascript
    const antes = JSON.stringify(estado);
    ...
    if (JSON.stringify(estado) === antes) return estado;
```

Compara el estado serializado antes y después: si aplicar el parche no cambió
nada, no escribe, no toca la URL y no notifica. Evita re-renders en cascada
cuando la UI re-aplica el mismo filtro.

**El concepto con nombre:** **Ephemeral vs. durable state** (estado efímero vs.
persistente), y **state as a URL** o **shareable/bookmarkable state**. La
precedencia URL > almacén es *URL as the single source of truth*. El riesgo que
se evita —seguir viendo datos filtrados sin saberlo— es un **stale filter** o
"filtro fantasma", conocido en herramientas de BI.

La analogía: el modo incógnito frente a quedarte con la sesión abierta. Y el
"filtro fantasma" es el equivalente digital de leer un reporte al que alguien le
arrancó las páginas pares: todo lo que ves es correcto, la conclusión es falsa.

Sobre la URL: es lo que hace que en Google Maps puedas mandarle a alguien un
enlace y vea exactamente lo que tú ves. El estado está en la dirección, no
escondido en la memoria del navegador.

**Por qué esta tecnología y no otra:**

- **¿Por qué no una librería de estado (Redux, Zustand, MobX)?** Todas asumen
  una SPA — un solo documento donde el estado vive en memoria mientras el
  usuario navega. Aquí cada módulo es **una página HTML distinta**: la navegación
  recarga el documento y **cualquier estado en memoria se pierde**. El problema
  real no es gestionar estado dentro de una página, es **transportarlo entre
  cargas de página**, y para eso lo que sirve es la URL y el Web Storage, no un
  store en memoria.
- **¿Por qué `URLSearchParams` y no armar la query a mano?** Porque maneja el
  encoding correctamente. Un nombre de municipio con espacio o acento en una
  query concatenada a mano produce una URL rota; `URLSearchParams` lo codifica.
- **¿Por qué claves cortas (`mun`, `s`, `p`) y no los nombres completos?** Para
  que la URL siga siendo legible y compartible. Y está declarado en el código
  que **son parte del contrato**: cambiarlas rompe los enlaces guardados.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era `localStorage` con un botón de "limpiar filtros". Se descartó
porque **pone el trabajo del lado equivocado**: exige que el usuario recuerde
algo que precisamente ya olvidó. El diseño seguro es el que falla hacia el
estado inofensivo — al abrir de nuevo, ves todo; si querías el filtro, lo
vuelves a poner en dos clics. El costo de re-filtrar es de segundos; el costo de
decidir sobre datos parciales sin saberlo, no.

Una segunda alternativa era **sólo la URL, sin almacén**. Se descartó porque no
todos los enlaces internos de la app propagan la query string, y el filtro se
perdería al navegar entre módulos — que es justo lo que se quería evitar. El
almacén cubre la navegación interna; la URL cubre compartir y recargar.

**Cómo lo dirías en una entrevista:**
> "Para el estado de filtros usé `sessionStorage` más la URL con
> `URLSearchParams`, con la URL teniendo precedencia, y descarté `localStorage`
> por una razón de negocio, no técnica: si un filtro sobrevive al cierre del
> navegador, el usuario vuelve días después, ve datos recortados sin recordar
> que filtró y saca conclusiones sobre un subconjunto. En una herramienta
> electoral eso es un fallo silencioso caro. Sincronizo con
> `history.replaceState` para no contaminar el historial, y el estado queda
> siempre visible en la barra de direcciones, lo que además hace los enlaces
> compartibles."

---

## 2026-08-13 — Versionar el esquema del estado guardado para no reventar contra datos viejos

**El problema real:** El estado de filtros se guarda serializado en el navegador
del usuario. Ese estado **sobrevive a los despliegues**: si hoy guardo
`{municipio: "04002", partido: "MORENA"}` y mañana despliego una versión que
renombra `partido` a `bloque` o agrega un campo obligatorio, el navegador del
usuario sigue teniendo el formato viejo. El código nuevo lo lee, encuentra
campos que no espera, faltan otros que sí espera, y **falla en un lugar que no
tiene nada que ver con la causa** — típicamente un `undefined` a diez llamadas
de distancia del `JSON.parse`. Y el usuario no puede arreglarlo porque no sabe
que hay basura guardada en su navegador.

**La solución aplicada:** Guardar el estado envuelto en un sobre con un número
de versión. Al leer, si la versión no es la que el código espera, **el estado se
descarta entero** y se empieza limpio. Perder un filtro es gratis; arrastrar un
esquema incompatible, no.

**Tecnología y librerías usadas:**

- **`JSON.stringify()` / `JSON.parse()`** — serialización a texto y de vuelta.
  `sessionStorage` sólo guarda strings, así que no es opcional. `JSON.parse`
  **lanza excepción** si el texto está corrupto, lo que hace obligatorio el
  `try/catch`.
- **`sessionStorage.removeItem(clave)`** — borra una entrada del almacén.
- **`try/catch`** — captura tanto el `JSON.parse` fallido como el acceso a
  `sessionStorage` bloqueado.

**El proceso paso a paso:**

1. La constante de versión, con el motivo escrito al lado
   ([filtros.js:45](frontend/js/filtros.js#L45)):

```javascript
  /* Versión del esquema. Si mañana cambia la forma del set, este número
     sube y el estado viejo se descarta en vez de reventar contra campos
     que ya no existen. */
  const VERSION = 1;
```

2. Al escribir, el estado va **envuelto**, no plano
   ([filtros.js:89](frontend/js/filtros.js#L89)):

```javascript
      sessionStorage.setItem(CLAVE, JSON.stringify({ v: VERSION, f }));
```

Ésta es la decisión estructural: en vez de guardar `{municipio: ...}`
directamente, se guarda `{v: 1, f: {municipio: ...}}`. El sobre (`v`) y el
contenido (`f`) van separados. Guardar el estado plano dejaría sin lugar dónde
poner la versión sin colisionar con un campo de filtro llamado `v`.

3. Al leer, se valida la versión **antes** de confiar en el contenido
   ([filtros.js:70](frontend/js/filtros.js#L70)):

```javascript
  function leerAlmacen() {
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      if (!crudo) return null;
      const d = JSON.parse(crudo);
      // Estado de una versión anterior del esquema: se descarta entero.
      if (d.v !== VERSION) {
        sessionStorage.removeItem(CLAVE);
        return null;
      }
      return d.f || null;
    } catch (e) {
      sessionStorage.removeItem(CLAVE);
      return null;
    }
  }
```

Qué hace cada parte:

- `if (!crudo) return null` — no hay nada guardado. Caso normal, primera visita.
- `JSON.parse(crudo)` — puede lanzar si el texto está corrupto; por eso el
  `try`.
- `if (d.v !== VERSION)` — **la guarda**. Compara estricto (`!==`), así que
  `"1"` (string) tampoco pasa.
- `sessionStorage.removeItem(CLAVE)` — no sólo se ignora el estado viejo: **se
  borra**. Si sólo se ignorara, seguiría ahí ocupando espacio y volvería a
  evaluarse en cada carga.
- `return null` — el llamador ya sabe qué hacer con `null`: usar el estado vacío.
- `catch (e)` — **misma reacción** ante JSON corrupto que ante versión vieja:
  borrar y empezar limpio. No hay forma de recuperar parcialmente un estado
  corrupto que valga el riesgo de leerlo mal.

4. El resultado se compone contra un objeto completo, así que el estado siempre
   tiene forma válida:

```javascript
      estado = Object.assign({}, VACIO, leerAlmacen() || {});
```

`VACIO` tiene todas las claves en `null`, generado desde la misma declaración de
campos:

```javascript
  const VACIO = Object.fromEntries(Object.keys(CAMPOS).map((k) => [k, null]));
```

Esto cierra el círculo: si mañana se agrega un campo a `CAMPOS`, `VACIO` lo
incluye automáticamente y el estado leído del almacén —que no lo trae— queda con
`null` en vez de `undefined`.

**El concepto con nombre:** **Schema versioning** y **schema evolution**. La
estrategia concreta aquí es **discard on mismatch** (descartar ante versión
distinta), frente a la alternativa **migration on read** (migrar el dato viejo al
formato nuevo al leerlo). En bases de datos, el equivalente son las
*migrations*; en sistemas de mensajería, el *schema registry* de Avro o Protobuf
cumple este rol para los mensajes en tránsito.

La analogía: el número de versión de un formato de archivo. Cuando una app abre
un archivo guardado por una versión anterior, lee la cabecera y decide: lo
convierto, o te digo que no puedo abrirlo. Lo que **no** hace es leerlo asumiendo
que el formato es el actual, porque eso produce basura que parece contenido.

**Por qué esta tecnología y no otra:**

- **¿Por qué un número entero y no un hash del esquema o un semver?** Un entero
  que se incrementa a mano es suficiente cuando **hay un solo lugar** que decide
  el formato. Un hash automático detectaría cambios que no rompen nada (agregar
  un campo opcional) y descartaría estado innecesariamente. Un semver implicaría
  distinguir cambios compatibles de incompatibles, y con un solo esquema
  pequeño ese matiz no paga.
- **¿Por qué `!==` y no `<`?** Comparar por igualdad estricta cubre también el
  caso de un usuario que vuelve a una versión anterior de la app (un rollback):
  su almacén tendría `v: 2` contra un código que espera `1`. Con `<` ese estado
  "del futuro" pasaría la guarda y rompería.
- **¿Por qué se exporta `VERSION` en la API pública del módulo
  (`CAMPOS, VERSION`)?** Para que sea inspeccionable desde la consola al
  depurar: se puede comparar contra lo que hay guardado sin abrir el código.

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

La alternativa era **escribir migraciones**: al detectar `v: 1` con código que
espera `v: 2`, transformar el estado viejo al formato nuevo y conservarlo. Es lo
correcto cuando el dato es **valioso e irrecuperable** — datos del usuario, un
documento, una configuración que costó armar. Se descartó aquí porque este
estado son **cinco filtros que el usuario vuelve a poner en dos clics**. El
código de migración tendría que mantenerse para siempre, acumularse versión tras
versión, y ser probado — todo para ahorrarle a alguien dos clics. La regla de
decisión: **migrar cuando perder el dato duele; descartar cuando no.**

La otra alternativa era **no versionar y confiar en que el esquema no cambie**.
Se descartó porque ya cambió una vez durante el desarrollo, y porque el fallo que
produce es de los peores de diagnosticar: aparece sólo en el navegador de quien
usó la versión anterior, no se reproduce en local (donde el almacén está limpio),
y el síntoma no apunta a la causa.

**Cómo lo dirías en una entrevista:**
> "El estado de filtros persiste en el navegador del usuario y sobrevive a los
> despliegues, así que lo envolví con una clave de versión de esquema:
> `{v: VERSION, f: filtros}`. Al leer, si la versión no coincide exacto, borro
> la entrada y arranco limpio, con la misma reacción ante un JSON corrupto.
> Elegí discard-on-mismatch en vez de migration-on-read porque el dato son cinco
> filtros que se re-aplican en dos clics: no justifica mantener código de
> migración para siempre. Si fuera un documento del usuario, la decisión sería
> la contraria."

---

## Cómo se sigue alimentando este documento

> Cada vez que resolvamos un problema de datos nuevo — validación, limpieza,
> modelado, pipeline, manejo de errores, decisiones de arquitectura de datos —
> agrega una entrada nueva con la plantilla de arriba ANTES de darlo por cerrado
> en el reporte de la tarea. No esperes a que te lo pidan explícitamente cada
> vez. Si el usuario dice "explícamelo como si fueras el senior que me está
> enseñando", es la señal de que la entrada debe ser más detallada de lo normal.
>
> Nunca omitas la sección de tecnología/librerías ni el fragmento de código
> real, aunque parezca obvio o repetido de una entrada anterior. El usuario está
> aprendiendo data engineering activamente y quiere poder explicar en una
> entrevista no solo QUÉ se resolvió, sino CON QUÉ herramienta exacta y CÓMO se
> usó esa herramienta línea por línea.

**Plantilla:**

```markdown
## [Fecha] — [Título corto del problema]

**El problema real:**

**La solución aplicada:**

**Tecnología y librerías usadas:**

**El proceso paso a paso:**

**El concepto con nombre:**

**Por qué esta tecnología y no otra:**

**Por qué no lo hicimos de otra forma (a nivel de diseño):**

**Cómo lo dirías en una entrevista:**

---
```

Reglas de la bitácora:

- **Entradas nuevas arriba**, igual que la Bitácora de `CONTEXTO.md`.
- El fragmento de código se **copia del archivo real**, no se escribe de memoria
  ni se aproxima. Con enlace a archivo y línea.
- La sección de librerías dice **qué hace cada función**, no sólo su nombre.
- "Por qué no lo hicimos de otra forma" nombra una alternativa **concreta y
  razonable**, y la razón por la que no servía **en este caso** — no en general.
