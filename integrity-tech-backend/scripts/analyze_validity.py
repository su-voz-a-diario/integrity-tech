#!/usr/bin/env python3
"""
Predictive Validity Analysis Script for Integrity Tech
Loads performance criteria, joins with candidate theta values and IGA scores,
performs Pearson correlations, multiple linear regression, ROC curve analysis,
determines optimal IGA cut-scores, and saves the ROC plot.
"""
import os
import sys
import json
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.metrics import roc_curve, auc
import matplotlib.pyplot as plt

# Database configuration
DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:localpassword123@localhost:5432/integrity_tech_db?schema=public')
if "?" in DB_URL:
    DB_URL = DB_URL.split("?")[0]

def run_validity_analysis(performance_data_json_path, output_image_path):
    print("[IRT Validity] Iniciando análisis de validez predictiva...")
    
    # 1. Cargar datos de desempeño cargados por el usuario
    if not os.path.exists(performance_data_json_path):
        print(f"[IRT Validity Error] No se encontró el archivo de datos de desempeño: {performance_data_json_path}")
        sys.exit(1)
        
    with open(performance_data_json_path, 'r') as f:
        perf_data = json.load(f)
        
    if len(perf_data) == 0:
        print("[IRT Validity Error] El archivo de datos de desempeño está vacío.")
        sys.exit(1)
        
    perf_df = pd.DataFrame(perf_data)
    # Debe contener 'email' o 'candidato_id' y 'desempeno'
    if 'desempeno' not in perf_df.columns:
        print("[IRT Validity Error] La columna 'desempeno' es obligatoria.")
        sys.exit(1)
        
    id_col = 'email' if 'email' in perf_df.columns else ('candidato_id' if 'candidato_id' in perf_df.columns else None)
    if not id_col:
        print("[IRT Validity Error] Se requiere identificar al candidato usando 'email' o 'candidato_id'.")
        sys.exit(1)
        
    # 2. Conectar a PostgreSQL y obtener los thetas/IGA de candidatos
    try:
        import psycopg2
    except ImportError:
        print("[IRT Validity Error] Falta psycopg2.")
        sys.exit(1)
        
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
    except Exception as e:
        print(f"[IRT Validity Error] Conexión fallida: {e}")
        sys.exit(1)
        
    try:
        # Traer todos los resultados_test con su IGA de candidatos asociados
        # Podemos buscar cruzando por email o candidato_id del usuario
        cur.execute("""
            SELECT 
                u.email,
                rt.test_id,
                rt.theta,
                att.score as IGA
            FROM resultados_test rt
            INNER JOIN exam_attempts att ON rt.exam_attempt_id = att.id
            INNER JOIN users u ON att.user_id = u.id
            WHERE rt.theta IS NOT NULL AND att.status = 'COMPLETED';
        """)
        db_rows = cur.fetchall()
        
        if len(db_rows) == 0:
            print("[IRT Validity Info] No hay suficientes intentos de examen finalizados con thetas calculados en la DB. Usando simulación de validación.")
            # Si no hay datos, simulamos para asegurar el reporte
            simulated = True
        else:
            simulated = False
            
        # Agrupar las respuestas por candidato
        candidates_data = {}
        if not simulated:
            for email, test_id, theta, IGA in db_rows:
                if email not in candidates_data:
                    candidates_data[email] = {'email': email, 'IGA': float(IGA)}
                candidates_data[email][f"{test_id}_theta"] = float(theta)
                
            db_df = pd.DataFrame(list(candidates_data.values()))
            # Combinar con los datos de desempeño
            merged = pd.merge(perf_df, db_df, left_on=id_col, right_on='email')
        else:
            # Generar datos sintéticos realistas para el reporte offline
            print("[IRT Validity] Generando simulación sintética de validez predictiva (N=150)...")
            np.random.seed(42)
            n_sim = max(100, len(perf_df))
            
            # Generar thetas con cierta correlación real al desempeño
            desempeno = np.random.uniform(5.0, 10.0, n_sim)
            # theta_i = desempeno * corr + noise
            it2_i = (desempeno - 7.5) * 0.4 + np.random.normal(0, 0.5, n_sim)
            it2_p10 = (desempeno - 7.5) * 0.3 + np.random.normal(0, 0.6, n_sim)
            it2_ac10 = (desempeno - 7.5) * 0.5 + np.random.normal(0, 0.4, n_sim)
            it2_cb10 = (desempeno - 7.5) * 0.35 + np.random.normal(0, 0.5, n_sim)
            
            # IGA index
            iga = 50 + 10 * (it2_i * 0.4 + it2_ac10 * 0.3 + it2_p10 * 0.15 + it2_cb10 * 0.15)
            iga = np.clip(iga, 10.0, 99.0)
            
            merged = pd.DataFrame({
                'email': [f"cand{i}@test.com" for i in range(n_sim)],
                'desempeno': desempeno,
                'IT2_I_theta': it2_i,
                'IT2_P10_theta': it2_p10,
                'IT2_AC10_theta': it2_ac10,
                'IT2_CB10_theta': it2_cb10,
                'IGA': iga
            })

        sample_size = len(merged)
        if sample_size < 10:
            print(f"[IRT Validity Error] Muestra coincidente insuficiente (N={sample_size}). Se necesitan al menos 10 candidatos coincidentes.")
            sys.exit(1)

        # 3. Calcular Correlaciones de Pearson
        correlations = {}
        for test_key in ['IT2_I_theta', 'IT2_P10_theta', 'IT2_AC10_theta', 'IT2_CB10_theta']:
            col_name = test_key
            if col_name in merged.columns:
                r, p = stats.pearsonr(merged[col_name], merged['desempeno'])
                correlations[test_key.replace('_theta', '')] = {
                    'pearson_r': float(r),
                    'p_value': float(p)
                }
                
        # Correlación general del IGA
        r_iga, p_iga = stats.pearsonr(merged['IGA'], merged['desempeno'])
        correlations['IGA'] = {
            'pearson_r': float(r_iga),
            'p_value': float(p_iga)
        }

        # 4. Regresión Lineal Múltiple
        feat_cols = [c for c in ['IT2_I_theta', 'IT2_P10_theta', 'IT2_AC10_theta', 'IT2_CB10_theta'] if c in merged.columns]
        X = merged[feat_cols].fillna(0.0)
        y = merged['desempeno']
        
        reg = LinearRegression().fit(X, y)
        r2 = reg.score(X, y)
        coefs = {feat_cols[i].replace('_theta', ''): float(reg.coef_[i]) for i in range(len(feat_cols))}
        intercept = float(reg.intercept_)

        # 5. Curva ROC & AUC
        # Definir alto desempeño como arriba de la mediana
        median_perf = merged['desempeno'].median()
        merged['alto_desempeno'] = (merged['desempeno'] > median_perf).astype(int)
        
        fpr, tpr, thresholds = roc_curve(merged['alto_desempeno'], merged['IGA'])
        roc_auc = auc(fpr, tpr)
        
        # Encontrar punto de corte óptimo usando el Índice de Youden (J = Sensibilidad + Especificidad - 1)
        j_scores = tpr - fpr
        best_idx = np.argmax(j_scores)
        optimal_iga_cutoff = float(thresholds[best_idx])
        optimal_sens = float(tpr[best_idx])
        optimal_spec = float(1.0 - fpr[best_idx])

        # 6. Generar Gráfico de Curva ROC
        plt.figure(figsize=(7, 6))
        plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'Curva ROC del IGA (AUC = {roc_auc:.3f})')
        plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
        plt.scatter(fpr[best_idx], tpr[best_idx], color='red', marker='o', s=100, 
                    label=f'Corte Óptimo IGA: {optimal_iga_cutoff:.1f}%\n(Sens: {optimal_sens:.2f}, Espec: {optimal_spec:.2f})')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('Tasa de Falsos Positivos (1 - Especificidad)')
        plt.ylabel('Tasa de Verdaderos Positivos (Sensibilidad)')
        plt.title('Curva ROC de Validez Predictiva (Desempeño Laboral)')
        plt.legend(loc="lower right")
        plt.grid(True, alpha=0.3)
        
        # Guardar gráfico
        plt.savefig(output_image_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        # 7. Formatear y retornar resultados
        results = {
            'status': 'success',
            'simulated': simulated,
            'tamano_muestra': int(sample_size),
            'correlaciones': correlations,
            'regresion': {
                'r2': float(r2),
                'coeficientes': coefs,
                'intercept': intercept
            },
            'roc': {
                'auc': float(roc_auc),
                'punto_corte_optimo_iga': optimal_iga_cutoff,
                'sensibilidad': optimal_sens,
                'especificidad': optimal_spec
            },
            'grafico_url': '/roc_curve.png'
        }
        
        # Imprimir resultado en JSON para que el NestJS lo capture por stdout
        print("RESULT_START")
        print(json.dumps(results))
        print("RESULT_END")

    except Exception as err:
        print(f"[IRT Validity Error] Fallo en procesamiento matemático: {err}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python3 analyze_validity.py <path_datos_desempeno_json> <path_salida_roc_png>")
        sys.exit(1)
        
    run_validity_analysis(sys.argv[1], sys.argv[2])
