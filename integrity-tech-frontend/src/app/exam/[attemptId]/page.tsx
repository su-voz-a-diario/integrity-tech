'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useExamStore } from '../../../store/exam.store';
import { useSecureTimer } from '../../../hooks/useSecureTimer';
import { useProctoring } from '../../../hooks/useProctoring';
import { syncEngine } from '../../../services/sync-engine';
import { analyticsService } from '../../../services/analytics';
import { QuestionRenderer } from '../../../components/exam/QuestionRenderer';
import { ProctoringMonitor } from '../../../components/exam/ProctoringMonitor';
import { FeedbackLayer } from '../../../components/exam/FeedbackLayer';
import { ProctoringCamera } from '../../../components/exam/ProctoringCamera';
import { QuestionDto } from '../../../types/exam-contract';

// Simulación de carga de datos desde el backend en tiempo de carga de página (mock)
const MOCK_EXAM = {
  id: 'mock-exam-id-1111',
  title: 'Batería de Evaluación Psicométrica Integrada (IT²)',
  durationMinutes: 60,
};

const CONSENT_VERSION = 'candidate-consent-v1';

function getProfessionalErrorMessage(status: number, fallback: string) {
  const messages: Record<number, string> = {
    401: 'Tu sesión expiró o no es válida. Vuelve a ingresar con tu enlace de evaluación.',
    403: 'No tienes autorización para acceder a esta evaluación.',
    409: 'El estado actual del intento no permite realizar esta acción.',
    429: 'Hay demasiadas solicitudes en este momento. Espera unos minutos e inténtalo nuevamente.',
  };
  return messages[status] || fallback;
}

const MOCK_QUESTIONS: QuestionDto[] = [
  {
    id: 'q-1',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Al final de su turno, el cuadre de caja muestra un sobrante de $50 que no corresponde a ninguna venta. Usted sabe que ese dinero probablemente pasará desapercibido. ¿Qué hace?',
      options: [
        { id: 'opt-a', text: 'A) Lo guarda, total es un error del sistema y nadie lo notará.' },
        { id: 'opt-b', text: 'B) Lo reporta inmediatamente a su supervisor y lo deja registrado en el informe de cierre.' },
        { id: 'opt-c', text: 'C) Lo deja en la caja sin decir nada; si alguien lo reclama, que lo busque.' },
        { id: 'opt-d', text: 'D) Se lo queda como compensación por horas extra no pagadas.' },
      ],
    },
  },
  {
    id: 'q-2',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un compañero muy cercano le pide que marque su tarjeta de asistencia porque llegará 20 minutos tarde, asegurando que “nunca lo revisan”. Usted sabe que el reglamento lo prohíbe. ¿Cómo actúa?',
      options: [
        { id: 'opt-a', text: 'A) Accede, es un favor entre colegas y la amistad está primero.' },
        { id: 'opt-b', text: 'B) Se niega amablemente, explicando que prefiere no violar la norma, y sugiere que él hable con el jefe.' },
        { id: 'opt-c', text: 'C) Lo hace, pero le advierte que es la última vez.' },
        { id: 'opt-d', text: 'D) Lo ignora y no marca nada; que él resuelva su problema.' },
      ],
    },
  },
  {
    id: 'q-3',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Encuentra en la impresora un informe con datos confidenciales de salarios de varios empleados. Su puesto no le da acceso a esa información. ¿Qué hace?',
      options: [
        { id: 'opt-a', text: 'A) Lo lee detenidamente para saber cómo están los demás.' },
        { id: 'opt-b', text: 'B) Lo recoge y lo entrega de inmediato a Recursos Humanos o a su supervisor directo, sin leerlo.' },
        { id: 'opt-c', text: 'C) Lo deja donde está, no es asunto suyo.' },
        { id: 'opt-d', text: 'D) Lo fotocopia “por si acaso” y después lo devuelve discretamente.' },
      ],
    },
  },
  {
    id: 'q-4',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un proveedor con quien su empresa tiene un contrato en licitación le ofrece una tarjeta de regalo de $200 como “agradecimiento por la buena relación”. Las políticas internas prohíben recibir obsequios superiores a $25. Usted:',
      options: [
        { id: 'opt-a', text: 'A) La acepta, no cree que eso influya en sus decisiones profesionales.' },
        { id: 'opt-b', text: 'B) La rechaza cortésmente y notifica el ofrecimiento al área de compras/ética.' },
        { id: 'opt-c', text: 'C) La acepta pero la declara informalmente a su jefe.' },
        { id: 'opt-d', text: 'D) La acepta y la comparte con el equipo para que nadie hable.' },
      ],
    },
  },
  {
    id: 'q-5',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Su jefe le pide que “ajuste” ligeramente una cifra en un reporte de resultados para que el área quede mejor parada. El cambio no es ilegal pero desvirtúa la realidad. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Lo hace, es su jefe y hay que alinearse.' },
        { id: 'opt-b', text: 'B) Se niega explicando que prefiere mantener la exactitud de los datos y ofrece alternativas para presentar los resultados sin falsearlos.' },
        { id: 'opt-c', text: 'C) Lo hace, pero deja una nota interna aclaratoria por si acaso.' },
        { id: 'opt-d', text: 'D) Lo deriva a un colega para no tener que involucrarse directamente.' },
      ],
    },
  },
  {
    id: 'q-6',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Soy una persona habladora, me gusta iniciar conversaciones.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-7',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Prefiero mantenerme en un segundo plano, soy más bien reservado/a.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-8',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Tiendo a encontrar defectos en los demás fácilmente.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-9',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Soy comprensivo/a y amable con casi todo el mundo.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-10',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Hago las cosas con cuidado, me esfuerzo para que queden bien hechas.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-11',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'A veces soy un poco descuidado/a o desordenado/a.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-12',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Con frecuencia me siento tenso/a o preocupado/a.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-13',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'En general soy una persona relajada y difícil de estresar.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-14',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Me gustan las experiencias nuevas, la variedad y probar cosas distintas.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-15',
    type: 'LIKERT',
    defaultPoints: 1.0,
    content: {
      text: 'Prefiero seguir rutinas conocidas, no soy muy imaginativo/a.',
      scale: {
        min: 1,
        max: 5,
        labels: {
          '1': 'Totalmente en desacuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
    },
  },
  {
    id: 'q-16',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Lea el siguiente argumento: “Se ha comprobado que los empleados que participan en programas de capacitación mejoran su productividad. Carlos participó en un programa de capacitación. Por tanto, Carlos mejorará su productividad.” ¿Qué tan sólida es esta conclusión?',
      options: [
        { id: 'opt-a', text: 'A) Verdadera, porque la capacitación siempre mejora la productividad.' },
        { id: 'opt-b', text: 'B) Probablemente verdadera, si no hay otros factores que lo impidan.' },
        { id: 'opt-c', text: 'C) Falsa, porque no todos los que se capacitan mejoran.' },
        { id: 'opt-d', text: 'D) No se puede determinar en absoluto.' },
      ],
    },
  },
  {
    id: 'q-17',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Considere el siguiente razonamiento: “Todas las empresas exitosas invierten en innovación. La empresa XYZ invierte en innovación. Por lo tanto, la empresa XYZ es exitosa.” Este razonamiento es…',
      options: [
        { id: 'opt-a', text: 'A) Válido y verdadero.' },
        { id: 'opt-b', text: 'B) Inválido, porque la premisa no garantiza la conclusión.' },
        { id: 'opt-c', text: 'C) Válido, pero falso.' },
        { id: 'opt-d', text: 'D) Inválido y falso.' },
      ],
    },
  },
  {
    id: 'q-18',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Seleccione la opción que complete la analogía de la misma manera que el primer par: Cirujano es a bisturí como escritor es a…',
      options: [
        { id: 'opt-a', text: 'A) Pluma' },
        { id: 'opt-b', text: 'B) Libro' },
        { id: 'opt-c', text: 'C) Biblioteca' },
        { id: 'opt-d', text: 'D) Lector' },
      ],
    },
  },
  {
    id: 'q-19',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: '¿Qué número completa la siguiente serie? 2, 6, 12, 20, 30, ___',
      options: [
        { id: 'opt-a', text: 'A) 38' },
        { id: 'opt-b', text: 'B) 40' },
        { id: 'opt-c', text: 'C) 42' },
        { id: 'opt-d', text: 'D) 48' },
      ],
    },
  },
  {
    id: 'q-20',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Un artículo tiene un precio de $150 y se le aplica un descuento del 20%. ¿Cuál es el precio final?',
      options: [
        { id: 'opt-a', text: 'A) $120' },
        { id: 'opt-b', text: 'B) $130' },
        { id: 'opt-c', text: 'C) $100' },
        { id: 'opt-d', text: 'D) $125' },
      ],
    },
  },
  {
    id: 'q-21',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Un grifo llena un tanque en 6 horas. Otro grifo más potente lo llena en 4 horas. Si se abren ambos a la vez, ¿en cuánto tiempo se llenará el tanque?',
      options: [
        { id: 'opt-a', text: 'A) 2 horas' },
        { id: 'opt-b', text: 'B) 2 horas y 24 minutos' },
        { id: 'opt-c', text: 'C) 2 horas y 30 minutos' },
        { id: 'opt-d', text: 'D) 10 horas' },
      ],
    },
  },
  {
    id: 'q-22',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Observe la secuencia de figuras:\n• Figura 1: ● (círculo, 1 lado curvo)\n• Figura 2: ▲ (triángulo, 3 lados)\n• Figura 3: ■ (cuadrado, 4 lados)\n¿Cuál debe ir en el lugar de la interrogación (?)?',
      options: [
        { id: 'opt-a', text: 'A) Pentágono (5 lados)' },
        { id: 'opt-b', text: 'B) Hexágono (6 lados)' },
        { id: 'opt-c', text: 'C) Círculo' },
        { id: 'opt-d', text: 'D) Rombo' },
      ],
    },
  },
  {
    id: 'q-23',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Seleccione la opción que completa lógicamente esta matriz 2×2:\n• Arriba izquierda: flecha hacia arriba (↑)\n• Arriba derecha: flecha hacia la derecha (→)\n• Abajo izquierda: flecha hacia abajo (↓)\n• Abajo derecha: ?',
      options: [
        { id: 'opt-a', text: 'A) Flecha hacia arriba (↑)' },
        { id: 'opt-b', text: 'B) Flecha hacia la derecha (→)' },
        { id: 'opt-c', text: 'C) Flecha hacia abajo (↓)' },
        { id: 'opt-d', text: 'D) Flecha hacia la izquierda (←)' },
      ],
    },
  },
  {
    id: 'q-24',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: 'Observe la secuencia de posiciones de un triángulo que gira:\n• Posición 1: apunta hacia arriba (▲)\n• Posición 2: apunta hacia la derecha (►)\n• Posición 3: apunta hacia abajo (▼)\n¿Cuál es la Posición 4?',
      options: [
        { id: 'opt-a', text: 'A) Apunta hacia arriba (▲)' },
        { id: 'opt-b', text: 'B) Apunta hacia la derecha (►)' },
        { id: 'opt-c', text: 'C) Apunta hacia abajo (▼)' },
        { id: 'opt-d', text: 'D) Apunta hacia la izquierda (◄)' },
      ],
    },
  },
  {
    id: 'q-25',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 1.0,
    content: {
      text: '¿Cuál es la figura que sigue en esta secuencia?\n• Figura 1: un punto (●)\n• Figura 2: dos puntos (●●)\n• Figura 3: tres puntos (●●●)\n¿Qué sigue en la Figura 4?',
      options: [
        { id: 'opt-a', text: 'A) ●' },
        { id: 'opt-b', text: 'B) ●●' },
        { id: 'opt-c', text: 'C) ●●●' },
        { id: 'opt-d', text: 'D) ●●●●' },
      ],
    },
  },
  {
    id: 'q-26',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Dos miembros de su equipo discuten acaloradamente frente a otros colegas por un desacuerdo sobre la distribución de tareas. La tensión empieza a afectar el ambiente. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Les pide que se calmen y resuelvan el asunto en privado, ofreciéndose a mediar si lo necesitan.' },
        { id: 'opt-b', text: 'B) Les dice en público que ese comportamiento es inaceptable.' },
        { id: 'opt-c', text: 'C) Ignora la situación, son adultos y deben resolverlo solos.' },
        { id: 'opt-d', text: 'D) Le pide a su jefe que intervenga para no verse involucrado.' },
      ],
    },
  },
  {
    id: 'q-27',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un cliente importante llama muy alterado porque su pedido llegó con un error. Usted no fue responsable del error, pero es quien atiende la llamada. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Escucha con empatía, se disculpa por la experiencia y le explica que investigará y resolverá en menos de 24 horas.' },
        { id: 'opt-b', text: 'B) Le explica que usted no cometió el error y que lo derivará al departamento correspondiente.' },
        { id: 'opt-c', text: 'C) Le promete una compensación inmediata aunque no está seguro de que pueda autorizarla.' },
        { id: 'opt-d', text: 'D) Le pide que envíe un correo detallando el problema para pasarlo a incidencias.' },
      ],
    },
  },
  {
    id: 'q-28',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Llega un empleado nuevo a su área y se le asigna como su mentor informal. El primer día está visiblemente perdido y nervioso. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Le prepara un plan de orientación con las claves del área y se reúne con él al final del día para resolver dudas.' },
        { id: 'opt-b', text: 'B) Le dice que no se preocupe, que poco a poco irá aprendiendo.' },
        { id: 'opt-c', text: 'C) Le presenta a los demás y espera que los compañeros le ayuden.' },
        { id: 'opt-d', text: 'D) Le asigna tareas sencillas y le dice que pregunte si necesita algo.' },
      ],
    },
  },
  {
    id: 'q-29',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un miembro de su equipo no entregó un informe clave a tiempo. Es la segunda vez en el mes. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Habla en privado con él, le expresa su preocupación y juntos buscan una solución para evitar que se repita.' },
        { id: 'opt-b', text: 'B) Le advierte que si vuelve a ocurrir habrá consecuencias formales.' },
        { id: 'opt-c', text: 'C) Lo reporta inmediatamente a Recursos Humanos para que quede constancia.' },
        { id: 'opt-d', text: 'D) Asume usted la tarea para que no vuelva a fallar.' },
      ],
    },
  },
  {
    id: 'q-30',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'La dirección impone un nuevo procedimiento que su equipo considera ineficiente. Nadie está contento. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Escucha las quejas del equipo, canaliza sus sugerencias y las transmite a la dirección con propuestas de mejora.' },
        { id: 'opt-b', text: 'B) Les dice que es una decisión de arriba y que no hay nada que hacer.' },
        { id: 'opt-c', text: 'C) Les permite que no lo apliquen mientras no haya supervisión.' },
        { id: 'opt-d', text: 'D) Aplica el procedimiento sin comentarlo; si protestan, explica que así son las cosas.' },
      ],
    },
  },
  {
    id: 'q-31',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'En una reunión con clientes, su colega dice un dato incorrecto. Usted sabe que es un error. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Espera un momento y, con tacto, corrige el dato explicando la fuente correcta.' },
        { id: 'opt-b', text: 'B) Lo corrige inmediatamente, es importante que el cliente tenga información exacta.' },
        { id: 'opt-c', text: 'C) No dice nada para no hacerle quedar mal.' },
        { id: 'opt-d', text: 'D) Le envía un mensaje por debajo de la mesa para que se corrija él mismo.' },
      ],
    },
  },
  {
    id: 'q-32',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Todo el equipo está saturado, pero un cliente interno pide algo urgente para “ayer”. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Evalúa con el cliente la urgencia real, negocia un plazo factible y redistribuye prioridades en el equipo.' },
        { id: 'opt-b', text: 'B) Le dice que no se puede y que espere su turno.' },
        { id: 'opt-c', text: 'C) Acepta el trabajo sin consultar, total el cliente siempre tiene razón.' },
        { id: 'opt-d', text: 'D) Le pide a un miembro del equipo que lo haga en horas extra sin consultarle.' },
      ],
    },
  },
  {
    id: 'q-33',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Un proyecto fue un éxito y usted sabe que el mérito principal es de una compañera que trabajó silenciosamente horas extra. El jefe le atribuye el éxito a usted en público. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Agradece el reconocimiento pero inmediatamente señala la contribución clave de su compañera.' },
        { id: 'opt-b', text: 'B) Acepta el elogio, usted también trabajó duro.' },
        { id: 'opt-c', text: 'C) En privado le dice a su compañera que lo siente, pero que no quiso contradecir al jefe.' },
        { id: 'opt-d', text: 'D) Desvía el tema para no tener que aclarar nada.' },
      ],
    },
  },
  {
    id: 'q-34',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Nota que desde hace semanas el equipo está apagado, sin iniciativa y con poca participación en las reuniones. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Organiza una reunión informal para escuchar cómo se sienten y qué necesidades tienen, sin presión.' },
        { id: 'opt-b', text: 'B) Les recuerda los objetivos y la importancia de mantener el ritmo.' },
        { id: 'opt-c', text: 'C) Lo ignora, son rachas que pasan solas.' },
        { id: 'opt-d', text: 'D) Les envía un mensaje motivador por correo.' },
      ],
    },
  },
  {
    id: 'q-35',
    type: 'MULTIPLE_CHOICE',
    defaultPoints: 2.0,
    content: {
      text: 'Su jefe tiene un estilo de comunicación que a veces resulta brusco y desmotiva al equipo. Varios compañeros se lo han comentado a usted en confianza. Usted:',
      options: [
        { id: 'opt-a', text: 'A) Solicita una reunión con su jefe y, con respeto y datos objetivos, le transmite cómo está afectando al equipo y sugiere ajustes.' },
        { id: 'opt-b', text: 'B) Le dice a los compañeros que hablen ellos directamente.' },
        { id: 'opt-c', text: 'C) No hace nada, es el jefe y no le corresponde a usted educarlo.' },
        { id: 'opt-d', text: 'D) Envía un correo anónimo a Recursos Humanos.' },
      ],
    },
  },
];

export default function ExamTakingPage({ params }: { params: { attemptId: string } }) {
  const attemptId = params.attemptId;
  const startExam = useExamStore((state) => state.startExam);
  const status = useExamStore((state) => state.status);
  const setStatus = useExamStore((state) => state.setStatus);
  const isOffline = useExamStore((state) => state.isOffline);
  const answers = useExamStore((state) => state.answers);

  const [examSession, setExamSession] = useState<{
    exam: { id: string; title: string; durationMinutes?: number | null };
    questions: QuestionDto[];
    status: string;
  } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isAcceptingConsent, setIsAcceptingConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [initialServerTimeMs] = useState(Date.now());
  const [endTimeMs, setEndTimeMs] = useState(Date.now() + 10 * 60 * 1000);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [showFeedbackSurvey, setShowFeedbackSurvey] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth-token') || '';
      const response = await fetch(`/api/evaluations/attempts/${attemptId}/session`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getProfessionalErrorMessage(response.status, errorData.message || 'No se pudo cargar la evaluación asignada.'));
      }

      const data = await response.json();
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('La evaluación no tiene preguntas configuradas.');
      }

      setExamSession(data);
      startExam(attemptId, data.exam.id);
      setStatus(data.status === 'SUBMITTED' ? 'SUBMITTED' : 'IN_PROGRESS');
      const durationMinutes = data.exam.durationMinutes || 10;
      setEndTimeMs(Date.now() + durationMinutes * 60 * 1000);
      analyticsService.track('assessment_started', { attemptId, examId: data.exam.id });
    } catch (err: any) {
      setSessionError(err.message || 'No se pudo cargar la sesión de examen.');
    } finally {
      setIsLoadingSession(false);
    }
  }, [attemptId, startExam, setStatus]);

  // Inicializar el store de Zustand con los parámetros de la sesión
  useEffect(() => {
    async function verifyConsentAndLoadSession() {
      try {
        const token = localStorage.getItem('auth-token') || '';
        const response = await fetch(`/api/evaluations/attempts/${attemptId}/consent`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(getProfessionalErrorMessage(response.status, errorData.message || 'No se pudo verificar el consentimiento.'));
        }

        const data = await response.json();
        if (!data.accepted) {
          setConsentAccepted(false);
          setIsLoadingSession(false);
          return;
        }

        setConsentAccepted(true);
        await loadSession();
      } catch (err: any) {
        setSessionError(err.message || 'No se pudo preparar la evaluación.');
        setIsLoadingSession(false);
      }
    }

    verifyConsentAndLoadSession();
  }, [attemptId, loadSession]);

  const acceptConsent = async () => {
    try {
      setIsAcceptingConsent(true);
      setConsentError(null);
      const token = localStorage.getItem('auth-token') || '';
      const response = await fetch(`/api/evaluations/attempts/${attemptId}/consent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consentVersion: CONSENT_VERSION }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getProfessionalErrorMessage(response.status, errorData.message || 'No se pudo registrar el consentimiento.'));
      }

      setConsentAccepted(true);
      setIsLoadingSession(true);
      await loadSession();
    } catch (err: any) {
      setConsentError(err.message || 'No se pudo registrar el consentimiento.');
    } finally {
      setIsAcceptingConsent(false);
    }
  };

  // Tracking de navegación de preguntas para embudos de drop-off
  const questions = examSession?.questions || [];
  const activeQuestion = questions[activeQuestionIndex];
  useEffect(() => {
    if (activeQuestion) {
      analyticsService.track('question_viewed', {
        attemptId,
        questionId: activeQuestion.id,
        questionIndex: activeQuestionIndex,
        questionType: activeQuestion.type,
      });
    }
  }, [activeQuestionIndex, attemptId, activeQuestion]);

  // Manejo de la expiración de tiempo (Auto-Submit)
  const handleTimeUp = () => {
    if (status === 'IN_PROGRESS') {
      setStatus('EXPIRED');
      console.warn('El tiempo del examen ha expirado. Forzando envío automático...');
      triggerFinalSubmit();
    }
  };

  // Manejo de alarmas por alteración del reloj local
  const handleClockTampered = () => {
    alert('⚠️ Se ha detectado una alteración en el reloj de tu dispositivo. El examen se guardará y bloqueará.');
    handleTimeUp();
  };

  // Hook del Temporizador Seguro
  const { formattedTime, isExpired } = useSecureTimer({
    initialServerTimeMs,
    endTimeMs,
    onTimeUp: handleTimeUp,
    onTamperDetected: handleClockTampered,
  });

  // Activar monitoreo silencioso de Proctoring (inactividad e integridad de pestaña)
  useProctoring({ idleTimeoutMs: 60000 });

  // Envío final del examen
  const triggerFinalSubmit = async () => {
    try {
      const flushed = await syncEngine?.flushAnswers(6000);
      if (flushed === false) {
        throw new Error('Aún hay respuestas pendientes de sincronización. Espera unos segundos y vuelve a finalizar.');
      }

      const token = localStorage.getItem('auth-token') || '';
      const response = await fetch(`/api/evaluations/attempts/${attemptId}/finalize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getProfessionalErrorMessage(response.status, errorData.message || 'No se pudo finalizar la evaluación.'));
      }

      setStatus('SUBMITTED');
      setShowFeedbackSurvey(true);
      analyticsService.track('assessment_submitted', { attemptId });
      console.log('Respuestas locales al finalizar:', answers);
    } catch (err: any) {
      alert(err.message || 'No se pudo finalizar la evaluación. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-sm text-slate-500 font-medium">Cargando evaluación asignada...</div>
      </div>
    );
  }

  if (!consentAccepted && !examSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6">
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h1 className="text-lg font-bold text-white">Consentimiento informado</h1>
          <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              Autorizo realizar esta evaluación como parte de un proceso de selección o valoración profesional.
            </p>
            <p>
              Acepto que mis respuestas y datos asociados al intento sean tratados para generar resultados, métricas y
              reportes relacionados con la evaluación.
            </p>
            <p>
              Entiendo que la sesión puede registrar señales de monitoreo o proctoring cuando aplique, como eventos de
              navegación, actividad de sesión o metadata técnica.
            </p>
            <p>
              Comprendo que los resultados podrán ser usados por la organización solicitante como una herramienta de
              apoyo para la toma de decisiones dentro del proceso correspondiente.
            </p>
            <p className="text-xs text-slate-500">Versión del consentimiento: {CONSENT_VERSION}</p>
          </div>
          {consentError && <p className="mt-4 text-sm text-red-400">{consentError}</p>}
          <button
            type="button"
            onClick={acceptConsent}
            disabled={isAcceptingConsent}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAcceptingConsent ? 'Registrando...' : 'Acepto y continuar'}
          </button>
        </div>
      </div>
    );
  }

  if (sessionError || !examSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6">
        <div className="max-w-md text-center bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h1 className="text-lg font-bold text-white">No se pudo abrir la evaluación</h1>
          <p className="text-sm text-slate-400 mt-2">{sessionError || 'La sesión no está disponible.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* CABECERA (Header) - Responsiva para Móvil/Escritorio */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
        <div className="w-full md:w-auto flex items-center gap-3.5">
          <img 
            src="/integrity-logo-2.png" 
            alt="Logo" 
            className="w-7 h-7 object-contain rounded-md flex-shrink-0"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-200 tracking-wide text-left">{examSession.exam.title}</h1>
            <p className="text-3xs text-slate-500 mt-0.5">ID de Intento: {attemptId}</p>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-slate-800/40 md:border-none pt-2.5 md:pt-0">
          {/* Indicador de Estado de Conexión */}
          {isOffline ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Modo Offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sincronizado
            </span>
          )}

          {/* Temporizador Seguro */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-3xs text-slate-500 uppercase font-mono">Restan:</span>
            <span className={`font-mono text-xs font-bold ${isExpired ? 'text-red-500' : 'text-indigo-400'}`}>
              {formattedTime}
            </span>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Encuesta NPS de Retroalimentación en Caliente (Product-Market Fit) */}
        {showFeedbackSurvey ? (
          <FeedbackLayer 
            attemptId={attemptId}
            onFeedbackSubmitted={() => setShowFeedbackSurvey(false)}
          />
        ) : status !== 'IN_PROGRESS' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl gap-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl">
              {status === 'SUBMITTED' ? '✅' : '⏳'}
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              {status === 'SUBMITTED' ? 'Examen Entregado' : 'Tiempo Expirado'}
            </h2>
            <p className="text-sm text-slate-400 max-w-md">
              El examen ha sido cerrado y tus respuestas se encuentran procesadas de forma segura. No puedes realizar más modificaciones.
            </p>
          </div>
        ) : (
          <>
            {/* Indicador de Navegación de Preguntas (Minimalista y Unificado) */}
            <div className="flex justify-center items-center py-3 border-b border-slate-900">
              <span className="text-2xs uppercase tracking-widest font-mono text-slate-500 font-semibold">
                Pregunta <span className="text-indigo-400 font-bold text-sm mx-1">{activeQuestionIndex + 1}</span> de <span className="text-slate-300 font-bold text-sm mx-1">{questions.length}</span>
              </span>
            </div>

            {/* Renderizador de Pregunta Activa */}
            <div className="flex-1">
              {activeQuestion && (
                <QuestionRenderer question={activeQuestion} />
              )}
            </div>

            {/* Supervisión Activa por Cámara (Webcam Proctoring) - Ubicación Inline Perfecta */}
            <ProctoringCamera attemptId={attemptId} activeQuestionIndex={activeQuestionIndex} />

            {/* Botones de Navegación del Examen */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-900">
              <button
                disabled={activeQuestionIndex === 0}
                onClick={() => setActiveQuestionIndex((prev) => prev - 1)}
                className="px-6 py-2.5 rounded-lg border border-slate-800 text-slate-400 text-sm font-medium hover:bg-slate-900/50 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Anterior
              </button>

              {activeQuestionIndex < questions.length - 1 ? (
                <button
                  onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 rounded-lg bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  onClick={triggerFinalSubmit}
                  className="px-8 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Finalizar y Entregar
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Alerta de Auditoría de Proctoring de Alto Riesgo */}
      <ProctoringMonitor />
    </div>
  );
}
