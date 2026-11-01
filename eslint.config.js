// Configuración flat de ESLint para Expo SDK 57 (estándar de `npx expo lint`).
// Reglas del plugin de Expo + TypeScript + React recomendadas.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.tmp-verify/*'],
  },
  {
    rules: {
      // --- Reglas del plugin react-hooks nuevo (era React Compiler) ---
      // El patrón de carga de datos del repo dispara recargar()/setEstado()
      // desde useEffect en TODOS los hooks: es el patrón establecido y
      // estable; migrarlo al estilo del Compiler es una fase aparte. Se
      // silencian estas dos reglas ruidosas (23 de los 24 errores del lint).
      'react-hooks/set-state-in-effect': 'off',
      // El carrito mantiene un espejo síncrono del estado en un ref
      // (carritosRef.current = carritos durante el render) para leerlo justo
      // antes del reset de hidratación; el patrón es deliberado y está
      // documentado en src/features/carrito/contexto.tsx.
      'react-hooks/refs': 'off',
    },
  },
]);
