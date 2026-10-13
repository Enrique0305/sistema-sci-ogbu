import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  EVENTO_SESION_EXPIRADA,
  cambiarClave as apiCambiarClave,
  cerrarSesion as apiCerrarSesion,
  iniciarSesion as apiIniciarSesion,
  obtenerSesion,
} from '../api/client';

// Permisos por rol (espejo de la validacion que hace el backend; el backend
// es la autoridad, esto solo decide que mostrar en la interfaz).
const PERMISOS = {
  Administrador: { operar: true, administrarUsuarios: true },
  Operador: { operar: true, administrarUsuarios: false },
  Consulta: { operar: false, administrarUsuarios: false },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sesionExpirada, setSesionExpirada] = useState(false);

  // Al montar: ¿hay una sesion vigente (cookie)?
  useEffect(() => {
    obtenerSesion()
      .then((d) => setUsuario(d.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  // Cualquier 401 en un endpoint protegido: volver al login con aviso.
  useEffect(() => {
    const alExpirar = () => {
      setUsuario((actual) => {
        if (actual) setSesionExpirada(true);
        return null;
      });
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  const iniciarSesion = useCallback(async (correo, clave) => {
    const d = await apiIniciarSesion(correo, clave);
    setSesionExpirada(false);
    setUsuario(d.usuario);
    return d.usuario;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await apiCerrarSesion();
    } finally {
      setSesionExpirada(false);
      setUsuario(null);
    }
  }, []);

  const cambiarClave = useCallback(async (actual, nueva) => {
    const d = await apiCambiarClave(actual, nueva);
    setUsuario(d.usuario);
    return d.usuario;
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      sesionExpirada,
      permisos: usuario ? PERMISOS[usuario.rol_sistema] || {} : {},
      iniciarSesion,
      cerrarSesion,
      cambiarClave,
    }),
    [usuario, cargando, sesionExpirada, iniciarSesion, cerrarSesion, cambiarClave]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
