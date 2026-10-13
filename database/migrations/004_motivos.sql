-- ============================================================================
-- Migración 004 — Motivos de atención recurrentes
-- ============================================================================
-- Catálogo de "motivos frecuentes" que cada servicio (y opcionalmente cada
-- categoría) recibe a menudo. En el formulario de registro se ofrecen como
-- atajo que rellena el campo "Motivo"; el campo sigue siendo texto libre, así
-- que el operador puede editarlo o escribir uno distinto.
--
--   docker compose exec -T mysql sh -c \
--     'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" sci_ogbu' < database/migrations/004_motivos.sql
--
-- Se carga desde la hoja "Motivos" de la plantilla Excel con
--   docker compose run --rm backend npm run import:catalogo
-- ============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS motivos_recurrentes (
    motivo_id          INT AUTO_INCREMENT PRIMARY KEY,
    servicio_id        INT NOT NULL,
    categoria_id       INT NULL,
    texto              VARCHAR(300) NOT NULL,
    frecuencia_mensual SMALLINT UNSIGNED NULL,
    activo             TINYINT(1) NOT NULL DEFAULT 1,
    creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_motivos_servicio FOREIGN KEY (servicio_id)
        REFERENCES servicios_ogbu (servicio_id) ON DELETE CASCADE,
    CONSTRAINT fk_motivos_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias_atencion (categoria_id) ON DELETE SET NULL,
    CONSTRAINT uq_motivo_servicio_texto UNIQUE (servicio_id, texto),
    INDEX idx_motivos_categoria (categoria_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
