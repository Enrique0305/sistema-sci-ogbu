import { useCallback, useEffect, useState } from 'react';
import {
  actualizarUsuarioAdmin,
  crearUsuarioAdmin,
  desbloquearUsuario,
  listarUsuariosAdmin,
  obtenerUnidades,
  resetearClaveUsuario,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';

const ROLES = [
  { id: 'Administrador', desc: 'Todo el sistema y gestion de usuarios' },
  { id: 'Operador', desc: 'Registra y gestiona atenciones' },
  { id: 'Consulta', desc: 'Solo lectura de indicadores y listados' },
];

const ROL_BADGE = {
  Administrador: 'bg-purple-100 text-purple-800',
  Operador: 'bg-blue-100 text-blue-800',
  Consulta: 'bg-gray-100 text-gray-700',
};

const inputCls =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-ogbu-600 focus:outline-none focus:ring-1 focus:ring-ogbu-600';

function fmt(fecha) {
  return fecha ? new Date(fecha).toLocaleString('es-PE') : 'Nunca';
}

// Muestra una clave temporal UNA sola vez (el servidor no la guarda en claro).
function ClaveTemporalModal({ titulo, usuario, clave, onCerrar }) {
  const [copiada, setCopiada] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {usuario.nombres} {usuario.apellidos} &middot; {usuario.correo}
        </p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase text-amber-700">Clave temporal</p>
          <p className="mt-1 select-all font-mono text-xl font-bold tracking-wider text-gray-900">{clave}</p>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Entregala al usuario por un canal seguro. <strong>Se muestra una sola vez</strong>: no se puede
          volver a consultar. En su primer ingreso el sistema le pedira definir una clave personal.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={copiar}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copiada ? 'Copiada' : 'Copiar'}
          </button>
          <button
            onClick={onCerrar}
            className="rounded-md bg-ogbu-600 px-4 py-2 text-sm font-medium text-white hover:bg-ogbu-700"
          >
            Ya la anote
          </button>
        </div>
      </div>
    </div>
  );
}

// Alta y edicion de usuario (el correo identifica la cuenta: solo se fija al crear).
function UsuarioFormModal({ usuario, unidades, onCerrar, onGuardado }) {
  const editando = Boolean(usuario);
  const [form, setForm] = useState({
    nombres: usuario?.nombres || '',
    apellidos: usuario?.apellidos || '',
    correo: usuario?.correo || '',
    rol_sistema: usuario?.rol_sistema || 'Operador',
    unidad_id: usuario?.unidad_id ? String(usuario.unidad_id) : '',
    cargo: usuario?.cargo || '',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      if (editando) {
        const r = await actualizarUsuarioAdmin(usuario.usuario_id, {
          nombres: form.nombres,
          apellidos: form.apellidos,
          rol_sistema: form.rol_sistema,
          unidad_id: form.unidad_id ? Number(form.unidad_id) : null,
          cargo: form.cargo || null,
        });
        onGuardado({ usuario: r.usuario });
      } else {
        const r = await crearUsuarioAdmin({
          nombres: form.nombres,
          apellidos: form.apellidos,
          correo: form.correo,
          rol_sistema: form.rol_sistema,
          unidad_id: form.unidad_id ? Number(form.unidad_id) : undefined,
          cargo: form.cargo || undefined,
        });
        onGuardado({ usuario: r.usuario, claveTemporal: r.clave_temporal });
      }
    } catch (err) {
      const detalle = err.detalles?.map((d) => d.mensaje).join('. ');
      setError(detalle || err.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          {editando ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>
        {!editando && (
          <p className="mt-1 text-sm text-gray-500">
            Se generara una clave temporal que el usuario debera cambiar en su primer ingreso.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombres</label>
            <input required maxLength={100} value={form.nombres} onChange={(e) => set('nombres', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Apellidos</label>
            <input required maxLength={100} value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Correo institucional</label>
          <input
            type="email"
            required
            disabled={editando}
            maxLength={150}
            value={form.correo}
            onChange={(e) => set('correo', e.target.value)}
            placeholder="usuario@unmsm.edu.pe"
            className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-500`}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Rol en el sistema</label>
          <select value={form.rol_sistema} onChange={(e) => set('rol_sistema', e.target.value)} className={inputCls}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.id} — {r.desc}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Unidad <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <select value={form.unidad_id} onChange={(e) => set('unidad_id', e.target.value)} className={inputCls}>
              <option value="">Sin unidad</option>
              {unidades.map((u) => (
                <option key={u.unidad_id} value={u.unidad_id}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cargo <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input maxLength={80} value={form.cargo} onChange={(e) => set('cargo', e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-ogbu-600 px-4 py-2 text-sm font-medium text-white hover:bg-ogbu-700 disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminUsuarios() {
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [filtros, setFiltros] = useState({ q: '', rol_sistema: '', unidad_id: '', estado: '' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [formAbierto, setFormAbierto] = useState(null); // null | 'nuevo' | usuario
  const [claveModal, setClaveModal] = useState(null); // { titulo, usuario, clave }

  const cargar = useCallback(async (f = filtros) => {
    setCargando(true);
    setError('');
    try {
      const d = await listarUsuariosAdmin(f);
      setUsuarios(d.usuarios);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista de usuarios.');
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    obtenerUnidades().then((d) => setUnidades(d.unidades)).catch(() => setUnidades([]));
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ejecutar = async (accion, mensajeOk) => {
    setError('');
    setAviso('');
    try {
      const r = await accion();
      if (mensajeOk) setAviso(mensajeOk);
      await cargar();
      return r;
    } catch (err) {
      setError(err.message || 'La operacion no pudo completarse.');
      return null;
    }
  };

  const generarClave = async (u) => {
    const verbo = u.tiene_clave ? 'restablecer la clave de' : 'generar una clave para';
    if (!window.confirm(`¿Seguro que deseas ${verbo} ${u.nombres} ${u.apellidos}?\nSe cerraran sus sesiones abiertas.`)) return;
    const r = await ejecutar(() => resetearClaveUsuario(u.usuario_id));
    if (r) setClaveModal({ titulo: 'Clave temporal generada', usuario: r.usuario, clave: r.clave_temporal });
  };

  const alternarEstado = async (u) => {
    const activar = !u.estado;
    if (!activar && !window.confirm(`¿Desactivar a ${u.nombres} ${u.apellidos}? Perdera el acceso de inmediato.`)) return;
    await ejecutar(
      () => actualizarUsuarioAdmin(u.usuario_id, { estado: activar }),
      `Usuario ${activar ? 'activado' : 'desactivado'}.`
    );
  };

  const alGuardarFormulario = async ({ usuario, claveTemporal }) => {
    const eraNuevo = formAbierto === 'nuevo';
    setFormAbierto(null);
    setAviso(eraNuevo ? 'Usuario creado.' : 'Cambios guardados.');
    await cargar();
    if (claveTemporal) setClaveModal({ titulo: 'Usuario creado', usuario, clave: claveTemporal });
  };

  const selectCls = 'mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm';
  const btnLink = 'text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Administracion de usuarios</h2>
          <p className="mt-1 text-sm text-gray-500">
            Cuentas con acceso al sistema, su rol y su unidad. No se eliminan: se desactivan.
          </p>
        </div>
        <button
          onClick={() => setFormAbierto('nuevo')}
          className="rounded-md bg-ogbu-600 px-4 py-2 text-sm font-medium text-white hover:bg-ogbu-700"
        >
          Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-[14rem] flex-1">
          <label className="block text-xs font-medium text-gray-500">Buscar</label>
          <input
            value={filtros.q}
            onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && cargar()}
            placeholder="Nombre, apellido o correo"
            className={`${selectCls} w-full`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Rol</label>
          <select value={filtros.rol_sistema} onChange={(e) => setFiltros((f) => ({ ...f, rol_sistema: e.target.value }))} className={selectCls}>
            <option value="">Todos</option>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Unidad</label>
          <select value={filtros.unidad_id} onChange={(e) => setFiltros((f) => ({ ...f, unidad_id: e.target.value }))} className={selectCls}>
            <option value="">Todas</option>
            {unidades.map((u) => <option key={u.unidad_id} value={u.unidad_id}>{u.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Estado</label>
          <select value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))} className={selectCls}>
            <option value="">Todos</option>
            <option value="1">Activos</option>
            <option value="0">Inactivos</option>
          </select>
        </div>
        <button
          onClick={() => cargar()}
          disabled={cargando}
          className="rounded-md bg-gray-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
        >
          {cargando ? 'Cargando...' : 'Filtrar'}
        </button>
      </div>

      {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {aviso && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</div>}

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs text-gray-400">{usuarios.length} usuario(s)</p>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase text-gray-500">
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Unidad / cargo</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Ultimo acceso</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => {
                const soyYo = yo && u.usuario_id === yo.usuario_id;
                return (
                  <tr key={u.usuario_id} className={u.estado ? '' : 'bg-gray-50 text-gray-400'}>
                    <td className="py-2 pr-4">
                      <span className="font-medium text-gray-900">{u.nombres} {u.apellidos}</span>
                      {soyYo && <span className="ml-1 rounded bg-ogbu-100 px-1 text-xs text-ogbu-700">tu</span>}
                      <span className="block text-xs text-gray-500">{u.correo}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROL_BADGE[u.rol_sistema]}`}>
                        {u.rol_sistema}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {u.unidad_nombre || <span className="text-gray-400">-</span>}
                      {u.cargo && <span className="block text-xs text-gray-400">{u.cargo}</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.estado ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                          {u.estado ? 'Activo' : 'Inactivo'}
                        </span>
                        {u.bloqueado && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Bloqueado</span>}
                        {!u.tiene_clave && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Sin clave</span>}
                        {u.tiene_clave && u.debe_cambiar_clave && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Clave temporal</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs">{fmt(u.ultimo_acceso)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <button className={`${btnLink} text-ogbu-700`} onClick={() => setFormAbierto(u)}>Editar</button>
                        {u.estado && !soyYo && (
                          <button className={`${btnLink} text-blue-700`} onClick={() => generarClave(u)}>
                            {u.tiene_clave ? 'Restablecer clave' : 'Generar clave'}
                          </button>
                        )}
                        {u.bloqueado && (
                          <button className={`${btnLink} text-amber-700`} onClick={() => ejecutar(() => desbloquearUsuario(u.usuario_id), 'Usuario desbloqueado.')}>
                            Desbloquear
                          </button>
                        )}
                        {!soyYo && (
                          <button className={`${btnLink} ${u.estado ? 'text-red-700' : 'text-green-700'}`} onClick={() => alternarEstado(u)}>
                            {u.estado ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">No hay usuarios para los filtros seleccionados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formAbierto && (
        <UsuarioFormModal
          usuario={formAbierto === 'nuevo' ? null : formAbierto}
          unidades={unidades}
          onCerrar={() => setFormAbierto(null)}
          onGuardado={alGuardarFormulario}
        />
      )}
      {claveModal && <ClaveTemporalModal {...claveModal} onCerrar={() => setClaveModal(null)} />}
    </div>
  );
}
