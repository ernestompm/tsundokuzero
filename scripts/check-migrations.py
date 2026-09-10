"""
Guardarrail de migraciones.

PostgreSQL NO deja cambiar el tipo de retorno de una funcion con
`create or replace`: falla con «cannot change return type of existing
function». Paso de verdad con `pending_mentions`, que en la migracion 035
devolvia tres columnas y en la 036 siete.

Este script busca funciones redefinidas con la misma forma de argumentos
pero distinto retorno, y avisa si el fichero nuevo no la borra antes con
`drop function if exists`.

    python scripts/check-migrations.py
"""

import glob
import io
import os
import re
import sys

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# Para cada funcion: en que migracion se define y que devuelve
defs = {}
for f in sorted(glob.glob('supabase/migrations/*.sql')):
    s = io.open(f, encoding='utf-8').read()
    for m in re.finditer(
        r"create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_]+)\s*\((.*?)\)\s*returns\s+(.*?)\s+language",
        s, re.S | re.I,
    ):
        nombre = m.group(1)
        args = ' '.join(m.group(2).split())
        ret = ' '.join(m.group(3).split())
        defs.setdefault(nombre, []).append((os.path.basename(f), args, ret))

problemas = []
for nombre, lista in defs.items():
    if len(lista) < 2:
        continue
    for i in range(1, len(lista)):
        f0, a0, r0 = lista[i - 1]
        f1, a1, r1 = lista[i]
        # Solo choca si la firma de argumentos tiene la misma forma
        n0 = a0.count(',') if a0.strip() else -1
        n1 = a1.count(',') if a1.strip() else -1
        if n0 != n1 or r0.lower() == r1.lower():
            continue
        # Si el fichero nuevo la BORRA antes de crearla, no hay choque
        txt = io.open('supabase/migrations/' + f1, encoding='utf-8').read()
        if re.search(r'drop\s+function\s+if\s+exists\s+(?:public\.)?' + nombre, txt, re.I):
            continue
        problemas.append((nombre, f0, r0[:70], f1, r1[:70]))

print('funciones definidas mas de una vez:', sum(1 for v in defs.values() if len(v) > 1))
print('choques de tipo de retorno:', len(problemas))
for p in problemas:
    print('  ' + p[0])
    print('     ' + p[1] + ': returns ' + p[2])
    print('     ' + p[3] + ': returns ' + p[4])
    print('     -> anade: drop function if exists public.' + p[0] + '(...);')

sys.exit(1 if problemas else 0)
