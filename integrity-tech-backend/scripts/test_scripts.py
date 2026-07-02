import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Añadir directorio actual al path para importar los scripts
sys.path.append(os.path.dirname(__file__))

import calibrate
import analyze_dif
import continuous_norming
import equating

class TestPsychometricScripts(unittest.TestCase):
    def setUp(self):
        self.mock_conn = MagicMock()
        self.mock_cur = MagicMock()
        self.mock_conn.cursor.return_value = self.mock_cur
        
    @patch('psycopg2.connect')
    def test_calibrate_script(self, mock_connect):
        mock_connect.return_value = self.mock_conn
        
        # Ejecutar calibración
        calibrate.run_calibration()
        
        # Verificar que se conectó y llamó al cursor
        mock_connect.assert_called()
        self.mock_conn.cursor.assert_called()
        
        # Verificar que se ejecutó la query de archivado histórico
        self.assertTrue(any("INSERT INTO parametros_items_historial" in call[0][0] 
                            for call in self.mock_cur.execute.call_args_list))
                            
        # Verificar que se insertaron parámetros con p_value_ajuste y rmsea_item
        self.assertTrue(any("p_value_ajuste" in call[0][0] and "rmsea_item" in call[0][0]
                            for call in self.mock_cur.execute.call_args_list))
        
        # Verificar que los valores de p_value_ajuste y rmsea_item son números reales no nulos
        insert_calls = [call for call in self.mock_cur.execute.call_args_list if "INSERT INTO parametros_items (" in call[0][0]]
        self.assertTrue(len(insert_calls) > 0)
        for call in insert_calls:
            if len(call[0]) >= 2:
                args = call[0][1]
                p_val = args[-2]
                rmsea = args[-1]
                self.assertIsNotNone(p_val)
                self.assertIsNotNone(rmsea)
                self.assertIsInstance(p_val, float)
                self.assertIsInstance(rmsea, float)
                # El p-value debe ser un valor de probabilidad entre 0 y 1
                self.assertTrue(0.0 <= p_val <= 1.0)
                # El RMSEA debe ser un residuo no negativo
                self.assertTrue(rmsea >= 0.0)
        
        # Verificar commit y cierres
        self.mock_conn.commit.assert_called()
        self.mock_cur.close.assert_called()
        self.mock_conn.close.assert_called()

    @patch('psycopg2.connect')
    def test_dif_analysis_script(self, mock_connect):
        mock_connect.return_value = self.mock_conn
        
        # Simular algunos items cargados de parametros_items
        self.mock_cur.fetchall.return_value = [('IT2_AC10', 'Q1'), ('IT2_I', 'Q2')]
        
        # Ejecutar DIF
        analyze_dif.run_dif_analysis()
        
        # Verificar truncado de dif_flags
        self.assertTrue(any("TRUNCATE TABLE dif_flags" in call[0][0] 
                            for call in self.mock_cur.execute.call_args_list))
                            
        # Verificar inserciones en dif_flags
        self.assertTrue(any("INSERT INTO dif_flags" in call[0][0] 
                            for call in self.mock_cur.execute.call_args_list))
                            
        # Verificar actualización de flag_dif en parametros_items
        self.assertTrue(any("UPDATE parametros_items" in call[0][0] and "SET flag_dif" in call[0][0]
                            for call in self.mock_cur.execute.call_args_list))

    @patch('psycopg2.connect')
    def test_validity_analysis_script(self, mock_connect):
        import json
        mock_connect.return_value = self.mock_conn
        
        # Simular respuestas en DB (15 candidatos coincidentes)
        self.mock_cur.fetchall.return_value = [
            (f'cand{i}@test.com', 'IT2_I', 0.5, 75.0) for i in range(15)
        ]
        
        # Crear json de desempeño de prueba
        perf_data = [
            {'email': f'cand{i}@test.com', 'desempeno': float(5.0 + (i % 5))} for i in range(15)
        ]
        
        temp_path = 'temp_perf_test.json'
        with open(temp_path, 'w') as f:
            json.dump(perf_data, f)
            
        output_img = 'temp_roc_test.png'
        
        try:
            import analyze_validity
            # Ejecutar análisis
            analyze_validity.run_validity_analysis(temp_path, output_img)
            
            # Verificar que se consultó la DB
            self.assertTrue(any("resultados_test" in call[0][0] 
                                for call in self.mock_cur.execute.call_args_list))
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if os.path.exists(output_img):
                os.remove(output_img)

    @patch('psycopg2.connect')
    def test_continuous_norming_script(self, mock_connect):
        mock_connect.return_value = self.mock_conn
        
        # Simular respuestas en DB (15 candidatos coincidentes)
        self.mock_cur.fetchall.return_value = [
            (0.5, 'Colombia', 'Universitario', 'Gerente') for _ in range(15)
        ]
        
        # Ejecutar suavizado continuo
        continuous_norming.run_continuous_norming('IT2_AC10')
        
        # Verificar que se borraron las normas previas y se insertaron las nuevas
        self.assertTrue(any("DELETE FROM continuous_norms" in call[0][0] 
                            for call in self.mock_cur.execute.call_args_list))
        self.assertTrue(any("INSERT INTO continuous_norms" in call[0][0] 
                            for call in self.mock_cur.executemany.call_args_list))

    @patch('psycopg2.connect')
    def test_equating_script(self, mock_connect):
        import datetime
        mock_connect.return_value = self.mock_conn
        
        # Simular respuestas en DB para los querys
        # 1. Nuevos ítems
        # 2. Fecha de calibración histórica
        # 3. Ítems históricos
        self.mock_cur.fetchone.return_value = (datetime.datetime(2026, 1, 1),)
        
        self.mock_cur.fetchall.side_effect = [
            [('Q1', '2PL', -0.5, None, None, None, None), ('Q2', '2PL', 0.5, None, None, None, None)], # nuevos
            [('Q1', '2PL', -0.6, None, None, None, None), ('Q2', '2PL', 0.4, None, None, None, None)]  # históricos (base)
        ]
        
        # Ejecutar equating
        equating.run_equating('IT2_AC10')
        
        # Verificar que se guardaron los coeficientes en equating_coefficients
        self.assertTrue(any("INSERT INTO equating_coefficients" in call[0][0]
                            for call in self.mock_cur.execute.call_args_list))

if __name__ == '__main__':
    unittest.main()
