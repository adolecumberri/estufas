import CatalogoScreen from '@/screens/catalogo-screen';

// El catálogo es la pantalla raíz: sin Redirect para que el botón "atrás"
// de Android se comporte correctamente (sin "GO_BACK was not handled").
export default function Index() {
  return <CatalogoScreen />;
}
