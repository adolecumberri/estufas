import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';

// NativeWind NO intercepta expo-image por defecto: sin este registro, las
// clases className de tamaño (h-[60px] w-full, h-full w-full...) se ignoran y
// las imágenes quedan a tamaño 0 (invisibles). Registrarlo una vez al arrancar
// hace que className se aplique a `style` igual que en el <Image> de RN.
cssInterop(Image, { className: 'style' });
