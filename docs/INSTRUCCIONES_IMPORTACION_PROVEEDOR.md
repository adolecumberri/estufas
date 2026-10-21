# Instrucciones para procesar un JSON crudo de productos de un proveedor

> Pega TODO este documento (o la sección "PROMPT") a otro LLM junto con el JSON
> crudo del proveedor. La salida del LLM es un JSON normalizado que nuestro
> pipeline convierte en datos de base de datos (proveedor, productos, precios
> por transporte y datos técnicos), igual que se hizo con "Eider Biomasa".

---

## PROMPT

Actúa como ingeniero de datos. Vas a recibir un JSON crudo con productos de un
proveedor. Tu trabajo es transformarlo en un JSON **normalizado y validado**
según el contrato de abajo, sin inventar NINGÚN dato: si un campo falta o es
ilegible, lo omites o lo marcas para revisión.

### Reglas de procesamiento

1. **Identidad del proveedor**
   - Extrae de la entrada (o pregunta en "dudas") el nombre legal del
     proveedor, su NIF/CIF y su email/teléfono si existen.
   - En la salida, `proveedor` lleva esos campos. El UUID y las asignaciones a
     comerciales NO los generas tú: los añade nuestro pipeline (lo dejamos
     vacío en `"id"` y lo indicamos).

2. **Referencias**
   - Si el producto ya trae referencia (p. ej. `CB640002`), consérvala
     **exactamente** (mayúsculas, sin espacios).
   - Si no trae, genera una secuencial con el prefijo del proveedor y 3
     dígitos: `{PREFIJO}-001`, `{PREFIJO}-002`... El prefijo son 3-5 letras
     derivadas del nombre del proveedor (p. ej. Eider Biomasa → `EID`).
   - La referencia debe ser única en todo el lote.

3. **Nombres**
   - Normaliza a Title Case (mayúscula inicial, el resto en minúscula; respeta
     mayúsculas de marcas propias como "EKO" o "BBQ").
   - Corrige errores de OCR evidentes (p. ej. "para fi na" → "Parafina",
     "estra" → "Extra", "fl ame" → "Flame").
   - Mantén las medidas/formato del nombre original (p. ej. `(16,5x3,5)`).

4. **Gama (categoría)**
   - Asigna cada producto a UNA de estas gamas (clave entre paréntesis):
     Combustible (`combustible`), Fuego (`fuego`), Fuego EKO (`fuego-eko`),
     Citronela (`citronela`), Cerillas y mecheros (`cerillas-mecheros`).
   - Si un producto no encaja en ninguna, usa `accesorio` y añádelo a "dudas".

5. **Tipo de producto**
   - Gama Combustible → `Combustible`; el resto → `Accesorio`.

6. **Precios por transporte** (3 valores por producto)
   - Objeto `precios`: `{ "camion": number|null, "palet": number|null, "franquicia": number|null }`.
   - Convierte formato europeo: "1,95 €" → `1.95`. Quita símbolos de moneda.
   - `"-"` → `null`. `"Consultar"` → `null` y añade `"consultar": true` en ese
     transporte.
   - Si la fuente solo muestra 2 columnas (Camión/Palet), `franquicia` es
     `null`.
   - Regla heredada de Eider: el precio base del catálogo es **camión**; si
     camión es null el producto se crea igualmente pero no saldrá en el
     catálogo hasta tener precio (indícalo en "dudas" solo si es dudoso).

7. **Datos técnicos (`datos`)** — contrato JSONB de grupos
   ```json
   [
     {
       "grupo": "Datos generales",
       "filas": [
         { "clave": "peso", "nombre": "Peso", "valor": "15 kg", "unidad": null }
       ]
     }
   ]
   ```
   - Grupos habituales y sus filas:
     - `Datos generales`: `peso` (string tal cual, p. ej. "15 kg" o "170 g"),
       `uds_caja` (número, unidades por caja), `unidad_venta` (string).
     - `Dimensiones unidad de venta`: `alto`, `ancho`, `largo` (números, unidad
       `"cm"`).
     - `Dimensiones caja`: `alto`, `ancho`, `largo` (números, unidad `"cm"`).
     - `Logística`: `unidades_por_caja`, `peso_caja_kg`, `cajas_por_manto`,
       `cajas_por_palet` (números).
   - Reglas: valores numéricos como `number`; textos tal cual; booleanos como
     `true`/`false`; `"-"` o vacío → **omitir la fila**; si no hay ninguna fila
     para un grupo, omite el grupo; unidades en minúscula y separadas del
     valor (`"cm"`, `"kg"`, `"g"`, `"ml"`, `"l"`).
   - Si el proveedor trae más datos (potencias, materiales, composición...),
     añádelos como filas nuevas con `clave` en snake_case y `nombre` legible.
     No te limites a las listas anteriores: el esquema es flexible.

8. **Integridad y trazabilidad**
   - NO inventes datos que no estén en la fuente.
   - Si hay valores raros o contradictorios (duplicados con precios distintos,
     pesos inconsistentes, OCR dudoso), NO los "arregles" en silencio:
     consérvalos como están y anótalos en `"revisar"` del producto y en
     `"dudas"` finales.
   - Comprueba que ninguna referencia se repite y que todo producto tiene
     gama, tipo, nombre y referencia.

### Formato de salida (JSON, sin texto adicional salvo la sección "dudas")

```json
{
  "proveedor": {
    "nombre": "...",
    "nif": "...",
    "email": null,
    "telefono": null
  },
  "productos": [
    {
      "referencia": "EID-001",
      "nombre": "Saco De Pellets 15 Kg Fireplus",
      "slug": "eid-001-saco-de-pellets-15-kg-fireplus",
      "descripcion": null,
      "gama": "combustible",
      "tipo": "Combustible",
      "activo": true,
      "destacado": false,
      "precios": { "camion": 3.75, "palet": null, "franquicia": null },
      "consultar": [],
      "datos": [
        {
          "grupo": "Datos generales",
          "filas": [
            { "clave": "peso", "nombre": "Peso", "valor": "15 kg", "unidad": null }
          ]
        }
      ],
      "revisar": []
    }
  ],
  "dudas": [
    "El proveedor trae dos filas casi idénticas de terracota con precios distintos; conservadas ambas."
  ]
}
```

- `consultar`: lista de transportes con precio "Consultar" (p. ej.
  `["camion"]`).
- `revisar`: notas breves por producto cuando haya algo dudoso.
- `dudas`: preguntas o avisos para el humano antes de importar.

### Validación final antes de entregar

1. JSON sintácticamente válido.
2. Referencias únicas en todo el lote.
3. Todos los `precios.*` son números o `null`.
4. Todos los productos tienen `gama` de la lista permitida.
5. Ningún dato inventado: si algo no está en la fuente, no está en la salida.

---

## Notas internas (no las pegues al otro LLM)

- Este contrato es el que ya se aplicó a Eider Biomasa (95 productos).
- El pipeline posterior hace: crear proveedor (UUID del bloque reservado
  `91000000-0000-4000-8000-00000000000X`), asignarlo al comercial que
  corresponda, insertar categorías de gama que falten, insertar productos
  (UUIDs del bloque `f2000000-...`), `producto_precios` base con el precio
  camión y `producto_precios_transporte` con los 3 precios.
- Los INSERTs de seed deben quedar RE-EJECUTABLES (`ON CONFLICT ... DO
  NOTHING`) para poder aplicarlos también sobre la BD viva.
