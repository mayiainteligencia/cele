#!/usr/bin/env bash
#
# Detecta colores hardcoded fuera de css/colors.css.
#
#     ./frontend/verificar-colores.sh
#
# Sale con 1 si encuentra alguno, para poder colgarlo de un hook o de CI.
#
# Regla dura del proyecto: TODO color vive en css/colors.css como token.
# Ninguna página, hoja ni script define un color literal.
#
# Excepciones, y son solo dos:
#   1. Una línea marcada con  /* color-ok: motivo */  o  // color-ok: motivo
#      El motivo es obligatorio: si no se puede explicar, no es excepción.
#      Caso real: el #000 de un mask-image es el canal alfa, no un color.
#   2. Los archivos *.prueba.js, que simulan getComputedStyle con literales.

set -u
cd "$(dirname "$0")" || exit 2

PATRON='#[0-9a-fA-F]{3,8}\b|rgba?\([0-9]'
fallos=0

archivos=$(ls *.html css/*.css js/*.js js/vistas/*.js 2>/dev/null \
  | grep -v '^css/colors.css$' \
  | grep -v '\.prueba\.js$')

for f in $archivos; do
  # -n para el número de línea; luego se descartan las líneas exentas y la
  # línea inmediatamente posterior a un marcador color-ok (el marcador suele
  # ir en el comentario de arriba).
  hallazgos=$(grep -nE "$PATRON" "$f" 2>/dev/null | awk -v archivo="$f" '
    { lineas[NR] = $0; num[NR] = $0; sub(/:.*/, "", num[NR]) }
    END { for (i = 1; i <= NR; i++) print lineas[i] }
  ')

  [ -z "$hallazgos" ] && continue

  # Números de línea que están exentos: la del marcador y las 3 siguientes.
  exentas=$(grep -nE 'color-ok:' "$f" 2>/dev/null | cut -d: -f1 | awk '{for(i=0;i<4;i++) print $1+i}')

  while IFS= read -r linea; do
    [ -z "$linea" ] && continue
    n=${linea%%:*}
    if echo "$exentas" | grep -qx "$n"; then continue; fi
    if [ "$fallos" -eq 0 ]; then
      echo "Colores hardcoded fuera de css/colors.css:"
      echo
    fi
    fallos=$((fallos + 1))
    printf '  %s:%s  %s\n' "$f" "$n" "$(echo "${linea#*:}" | sed 's/^[[:space:]]*//' | cut -c1-100)"
  done <<< "$hallazgos"
done

echo
if [ "$fallos" -gt 0 ]; then
  echo "FALLA — $fallos color(es) sin token."
  echo "Agrega el token en css/colors.css y usa var(--nombre)."
  echo "Si de verdad no es un color de paleta, marca la línea con /* color-ok: motivo */."
  exit 1
fi

tokens=$(grep -cE '^\s*--' css/colors.css)
echo "OK — cero colores hardcoded. $tokens tokens en css/colors.css."
