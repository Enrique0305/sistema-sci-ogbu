-- ============================================================================
-- Migración 003 — Autenticación y administración de usuarios
-- ============================================================================
-- Aplica SOBRE UNA BASE EXISTENTE. Para instalaciones limpias ya está
-- incluido en database/schema_mysql.sql.
--
--   docker compose exec -T mysql sh -c \
--     'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" sci_ogbu' < database/migrations/003_auth.sql
--
-- Cambios:
--   * usuarios_responsables: password_hash, rol_sistema (Administrador /
--     Operador / Consulta), control de intentos fallidos y bloqueo temporal,
--     cambio de clave obligatorio, ultimo acceso.
--   * tabla sesiones: sesiones del lado del servidor (token opaco, solo se
--     guarda su hash SHA-256; permite revocar al instante).
--
-- Los operadores existentes quedan SIN clave (password_hash NULL): no pueden
-- iniciar sesion hasta que un administrador les genere una clave temporal.
-- El primer administrador se crea con:
--   docker compose run --rm backend npm run create:admin -- correo@unmsm.edu.pe
-- ============================================================================

SET NAMES utf8mb4;

ALTER TABLE usuarios_responsables
    ADD COLUMN password_hash        VARCHAR(255) NULL AFTER correo_institucional,
    ADD COLUMN rol_sistema          ENUM('Administrador', 'Operador', 'Consulta')
                                    NOT NULL DEFAULT 'Operador' AFTER rol,
    ADD COLUMN debe_cambiar_clave   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN intentos_fallidos    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN bloqueado_hasta      DATETIME NULL,
    ADD COLUMN ultimo_acceso        DATETIME NULL,
    ADD COLUMN clave_actualizada_en DATETIME NULL,
    ADD INDEX idx_usuarios_rol_sistema (rol_sistema);

CREATE TABLE IF NOT EXISTS sesiones (
    sesion_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    usuario_id  INT NOT NULL,
    creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en   DATETIME NOT NULL,
    ip          VARCHAR(45) NULL,
    user_agent  VARCHAR(255) NULL,
    CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios_responsables (usuario_id) ON DELETE CASCADE,
    INDEX idx_sesiones_usuario (usuario_id),
    INDEX idx_sesiones_expira (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
