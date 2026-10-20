// Configuración de Metro con NativeWind (estilo shadcn/ui vía react-native-reusables).
// inlineRem: 16 normaliza las unidades rem en web y nativo.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
