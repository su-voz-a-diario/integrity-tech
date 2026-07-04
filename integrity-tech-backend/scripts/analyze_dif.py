#!/usr/bin/env python3
"""
IRT Differential Item Functioning (DIF) Analysis Script
Evaluates item bias across demographic groups (e.g. gender) using Logistic Regression.
Stores flags in dif_flags and updates parametros_items flag_dif.
"""
import os
import sys

DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:localpassword123@localhost:5432/integrity_tech_db?schema=public')
if "?" in DB_URL:
    DB_URL = DB_URL.split("?")[0]

def resolve_organization_id():
    organization_id = os.environ.get('ORGANIZATION_ID') or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not organization_id:
        print('[IRT DIF Error] organizationId es obligatorio. No se permite ejecutar análisis DIF global.')
        sys.exit(1)
    return organization_id

def run_dif_analysis():
    organization_id = resolve_organization_id()
    print(f"[IRT DIF] Iniciando análisis de Funcionamiento Diferencial del Ítem (DIF) para organización {organization_id}...")

    try:
        import psycopg2
    except ImportError:
        print("[IRT DIF Error] Falta psycopg2. Ejecuta 'pip install psycopg2-binary'")
        sys.exit(1)

    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        print("[IRT DIF] Conexión exitosa a la base de datos.")
    except Exception as e:
        print(f"[IRT DIF Error] No se pudo conectar a la base de datos: {e}")
        sys.exit(1)

    try:
        # Analizar ítems para cada test
        test_ids = ['IT2_I', 'IT2_P10', 'IT2_AC10', 'IT2_CB10']
        
        # Obtener lista de ítems configurados en DB
        cur.execute("SELECT test_id, item_id FROM parametros_items WHERE organization_id = %s;", (organization_id,))
        items = cur.fetchall()

        if len(items) == 0:
            print("[IRT DIF Error] No hay ítems reales en parametros_items para analizar. Ejecuta una calibración real antes del análisis DIF.")
            sys.exit(1)

        print(f"[IRT DIF] Encontrados {len(items)} ítems para evaluar sesgo demográfico (variable: género, método: regresión logística).")
        print("[IRT DIF Error] El análisis DIF real todavía no está implementado en este script. No se permite generar p-values simulados ni escribir resultados ficticios.")
        sys.exit(1)

    except Exception as e:
        conn.rollback()
        print(f"[IRT DIF Error] Fallo al procesar el análisis DIF: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_dif_analysis()
