#!/usr/bin/env python3
import os
import sys
import numpy as np
import psycopg2

DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:localpassword123@localhost:5432/integrity_tech_db?schema=public')
if "?" in DB_URL:
    DB_URL = DB_URL.split("?")[0]

def run_equating(test_id):
    print(f"[IRT Equating] Iniciando equiparación de test para {test_id}...")
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
    except Exception as e:
        print(f"[IRT Equating Error] No se pudo conectar a la base de datos: {e}")
        sys.exit(1)

    try:
        # 1. Recuperar los parámetros recién calibrados (versión destino)
        cur.execute("""
            SELECT item_id, modelo, parametro_b, parametro_c1, parametro_c2, parametro_c3, parametro_c4
            FROM parametros_items
            WHERE test_id = %s AND activo = TRUE;
        """, (test_id,))
        new_rows = cur.fetchall()
        if not new_rows:
            print("[IRT Equating Info] No se encontraron ítems nuevos para equiparación.")
            conn.close()
            return

        # 2. Recuperar la última calibración archivada para este test (versión origen)
        # Primero buscamos la fecha de calibración más reciente en el historial que sea distinta de la actual
        cur.execute("""
            SELECT DISTINCT fecha_calibracion
            FROM parametros_items_historial
            WHERE test_id = %s
            ORDER BY fecha_calibracion DESC
            LIMIT 1;
        """, (test_id,))
        date_row = cur.fetchone()
        if not date_row:
            print("[IRT Equating Info] No hay calibraciones históricas previas. Se establece escala base por defecto (A=1.0, B=0.0).")
            # Guardar coeficientes de identidad
            save_coefficients(cur, test_id, "None", "v1", 1.0, 0.0)
            conn.commit()
            conn.close()
            return

        last_calib_date = date_row[0]

        cur.execute("""
            SELECT item_id, modelo, parametro_b, parametro_c1, parametro_c2, parametro_c3, parametro_c4
            FROM parametros_items_historial
            WHERE test_id = %s AND fecha_calibracion = %s;
        """, (test_id, last_calib_date))
        base_rows = cur.fetchall()

        # 3. Mapear parámetros y buscar intersección (reactivos ancla comunes)
        base_params = {}
        for r in base_rows:
            item_id = r[0]
            # Dificultad general: parametro_b para 2PL o la media de los umbrales para GRM
            if r[1] == '2PL':
                diff = r[2] if r[2] is not None else 0.0
            else:
                thresholds = [val for val in r[3:7] if val is not None]
                diff = np.mean(thresholds) if thresholds else 0.0
            base_params[item_id] = diff

        new_params = {}
        for r in new_rows:
            item_id = r[0]
            if r[1] == '2PL':
                diff = r[2] if r[2] is not None else 0.0
            else:
                thresholds = [val for val in r[3:7] if val is not None]
                diff = np.mean(thresholds) if thresholds else 0.0
            new_params[item_id] = diff

        # Intersección
        anchor_item_ids = set(base_params.keys()).intersection(set(new_params.keys()))
        print(f"[IRT Equating] Reactivos ancla comunes encontrados: {len(anchor_item_ids)}")

        if len(anchor_item_ids) < 2:
            print("[IRT Equating Info] Menos de 2 reactivos ancla. Usando coeficientes identidad por defecto.")
            save_coefficients(cur, test_id, last_calib_date.strftime("%Y-%m-%d %H:%M:%S"), "current", 1.0, 0.0)
            conn.commit()
            conn.close()
            return

        # 4. Calcular equiparación lineal por método de la Media-Sigma
        base_vals = [base_params[iid] for iid in anchor_item_ids]
        new_vals = [new_params[iid] for iid in anchor_item_ids]

        mean_base, sd_base = np.mean(base_vals), np.std(base_vals)
        mean_new, sd_new = np.mean(new_vals), np.std(new_vals)

        # Prevenir división por cero
        if sd_new < 1e-6:
            A = 1.0
            B = mean_base - mean_new
        else:
            A = sd_base / sd_new
            B = mean_base - A * mean_new

        version_origen = last_calib_date.strftime("%Y-%m-%d %H:%M:%S")
        version_destino = "current"

        print(f"[IRT Equating Result] Coeficientes calculados: A={A:.6f}, B={B:.6f}")
        save_coefficients(cur, test_id, version_origen, version_destino, A, B)
        conn.commit()
        conn.close()

    except Exception as e:
        print(f"[IRT Equating Error] Excepción en equiparación: {e}")
        conn.rollback()
        conn.close()
        sys.exit(1)

def save_coefficients(cur, test_id, version_origen, version_destino, A, B):
    # Guardar en equating_coefficients
    cur.execute("""
        INSERT INTO equating_coefficients (test_id, version_origen, version_destino, metodo, coeficiente_a, coeficiente_b, fecha_creacion)
        VALUES (%s, %s, %s, 'mean_sigma', %s, %s, NOW());
    """, (test_id, version_origen, version_destino, A, B))
    print("[IRT Equating] Coeficientes guardados correctamente en la base de datos.")

if __name__ == '__main__':
    test_id = sys.argv[1] if len(sys.argv) > 1 else 'IT2_AC10'
    run_equating(test_id)
