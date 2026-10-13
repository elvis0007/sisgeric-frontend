-- =============================================================================
-- SCRIPT DE ACTUALIZACIÓN: FILTRO INDIVIDUAL POR RESPONSABLE Y PRÓRROGAS
-- =============================================================================
-- 1. Actualiza FN_RECOMENDACIONES_FILTROS_R para evaluar individualmente cada
--    responsable según su fecha máxima propia COALESCE(D.AREDR_FECHA_MAXIMA, R.ARERE_FECHA_MAXIMA).
-- 2. Sincroniza retroactivamente en AI_REC_DETALLE_RECOMENDACION cualquier prórroga
--    aprobada histórica en AI_REC_SOLICITUDES (ARESO_ESTADO_APROB = '3').
-- =============================================================================

CREATE OR REPLACE FUNCTION FN_RECOMENDACIONES_FILTROS_R (
    p_anio          IN NUMBER,
    p_arees_codigo  IN NUMBER,     -- 0 ó NULL = todos; 1 = en proceso; 2 = cumplida; 3 = vencida
    p_arers_codper  IN VARCHAR2
) RETURN SYS_REFCURSOR
IS
    v_cursor   SYS_REFCURSOR;
    v_sql      VARCHAR2(4000);
BEGIN
    /* ---------- 1. Sentencia base ---------- */
    v_sql :=
      'SELECT DISTINCT D.*, R.ARERE_FECHA_MAXIMA
         FROM ROOTSISREC.AI_INF_INFORMES            I
         JOIN ROOTSISREC.AI_REC_HALLAZGOS           H ON H.AININ_CODIGO = I.AININ_CODIGO
         JOIN ROOTSISREC.AI_REC_CONCLUSIONES        C ON C.AREHA_CODIGO = H.AREHA_CODIGO
         JOIN ROOTSISREC.AI_REC_RECOMENDACIONES     R ON R.ARECO_CODIGO = C.ARECO_CODIGO
         JOIN ROOTSISREC.AI_REC_DETALLE_RECOMENDACION D ON D.ARERE_CODIGO = R.ARERE_CODIGO
         JOIN ROOTSISREC.AI_REC_RESPONSABLES        S ON S.ARERS_CODIGO = D.ARERS_CODIGO
        WHERE R.ARERE_ESTADO = 1
          AND I.AININ_ESTADO = 1
          AND D.AREDR_ESTADO = 1
          AND S.ARERS_ESTADO = 1
          AND S.ARERS_CODIGO_PER = ''' || p_arers_codper || '''';

    /* ---------- 2. Filtro por estado individual del responsable (con fecha individual ampliada) ---------- */
    IF p_arees_codigo IS NOT NULL AND p_arees_codigo <> 0 THEN
        IF p_arees_codigo = 1 THEN
            -- EN PROCESO: No cumplida, con fecha individual vigente (>= SYSDATE) y sin verificable justificativo final
            v_sql := v_sql || ' AND (
                (R.AREES_CODIGO IN (1, 4) OR (R.AREES_CODIGO = 3 AND TRUNC(COALESCE(D.AREDR_FECHA_MAXIMA, R.ARERE_FECHA_MAXIMA)) >= TRUNC(SYSDATE)))
                AND NOT EXISTS (
                    SELECT 1 FROM ROOTSISREC.AI_REC_VERIFICABLES V 
                    WHERE V.AREDR_CODIGO = D.AREDR_CODIGO AND V.AREVE_ESTADO = 1 AND V.AREEV_CODIGO = 2
                )
            )';
        ELSIF p_arees_codigo = 2 THEN
            -- CUMPLIDA: Recomendación cumplida globalmente o este responsable ya tiene verificable que justifica
            v_sql := v_sql || ' AND (
                R.AREES_CODIGO = 2
                OR EXISTS (
                    SELECT 1 FROM ROOTSISREC.AI_REC_VERIFICABLES V 
                    WHERE V.AREDR_CODIGO = D.AREDR_CODIGO AND V.AREVE_ESTADO = 1 AND V.AREEV_CODIGO = 2
                )
            )';
        ELSIF p_arees_codigo = 3 THEN
            -- NO CUMPLIDA / VENCIDA: No cumplida, con fecha individual expirada (< SYSDATE) y sin verificable justificativo
            v_sql := v_sql || ' AND (
                R.AREES_CODIGO != 2
                AND TRUNC(COALESCE(D.AREDR_FECHA_MAXIMA, R.ARERE_FECHA_MAXIMA)) < TRUNC(SYSDATE)
                AND NOT EXISTS (
                    SELECT 1 FROM ROOTSISREC.AI_REC_VERIFICABLES V 
                    WHERE V.AREDR_CODIGO = D.AREDR_CODIGO AND V.AREVE_ESTADO = 1 AND V.AREEV_CODIGO = 2
                )
            )';
        END IF;
    END IF;

    /* ---------- 3. Filtro por año ---------- */
    IF p_anio IS NOT NULL AND p_anio <> 0 THEN
        v_sql := v_sql || ' AND EXTRACT(YEAR FROM NVL(R.ARERE_FECHA_INICIO_CONTROL, NVL(I.AININ_FECHA_APROBACION, I.AININ_FECHA_MEMO))) = ' || p_anio;
    END IF;

    /* ---------- 4. Orden por fecha individual (o general si no tiene individual) ---------- */
    v_sql := v_sql || ' ORDER BY COALESCE(D.AREDR_FECHA_MAXIMA, R.ARERE_FECHA_MAXIMA) DESC';

    /* ---------- 5. Abrir cursor ---------- */
    OPEN v_cursor FOR v_sql;
    RETURN v_cursor;

EXCEPTION
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(
            -20001,
            'Error en FN_RECOMENDACIONES_FILTROS_R: ' || SQLERRM || CHR(10) || 'SQL: ' || v_sql
        );
END;
/

-- =============================================================================
-- REGULARIZACIÓN Y SINCRONIZACIÓN DE FECHAS INDIVIDUALES POR RESPONSABLE
-- Ejecutar en Oracle para asegurar que todas las solicitudes de prórroga aprobadas
-- queden reflejadas de inmediato en AREDR_FECHA_MAXIMA.
-- =============================================================================
MERGE INTO ROOTSISREC.AI_REC_DETALLE_RECOMENDACION D
USING (
    SELECT 
        S.ARERE_CODIGO,
        S.ARERS_CODIGO,
        MAX(S.ARESO_FECHA_MAX_NUE) AS ULTIMA_FECHA_APROBADA
    FROM ROOTSISREC.AI_REC_SOLICITUDES S
    WHERE S.ARESO_ESTADO_APROB = '3'
      AND S.ARESO_FECHA_MAX_NUE IS NOT NULL
    GROUP BY S.ARERE_CODIGO, S.ARERS_CODIGO
) SOLIC_APROB
ON (
    D.ARERE_CODIGO = SOLIC_APROB.ARERE_CODIGO
    AND D.ARERS_CODIGO = SOLIC_APROB.ARERS_CODIGO
    AND D.AREDR_ESTADO = 1
)
WHEN MATCHED THEN
UPDATE SET 
    D.AREDR_FECHA_MAXIMA = SOLIC_APROB.ULTIMA_FECHA_APROBADA
WHERE D.AREDR_FECHA_MAXIMA IS NULL 
   OR D.AREDR_FECHA_MAXIMA < SOLIC_APROB.ULTIMA_FECHA_APROBADA;

COMMIT;
/
