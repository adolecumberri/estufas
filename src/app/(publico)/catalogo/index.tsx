import CatalogoScreen from '@/features/catalogo/screens/catalogo-screen';

// Segunda entrada al catálogo: /catalogo?comercial=<id> (vista del admin
// desde la preview de un comercial). La MISMA pantalla que la raíz, con el
// parámetro `comercial` leído por catalogo-screen para acotar los proveedores
// a los de ese comercial.
export default function Catalogo() {
  return <CatalogoScreen />;
}
