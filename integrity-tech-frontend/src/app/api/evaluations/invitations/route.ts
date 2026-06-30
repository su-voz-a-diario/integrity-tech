import { NextResponse } from 'next/server';
import { invitations } from '../state';

export async function POST(request: Request) {
  try {
    const { candidateName, email, examId } = await request.json();

    if (!candidateName || !email) {
      return NextResponse.json({ message: 'Nombre y correo son requeridos.' }, { status: 400 });
    }

    // Generar un código aleatorio de 6 dígitos
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const accessCode = `IT-${randomCode}`;

    invitations.set(accessCode, {
      accessCode,
      candidateName,
      email,
      examId: examId || 'mock-exam-id-1111',
      examTitle: 'Batería de Evaluación Psicométrica Integrada (IT²)',
      claimed: false,
      attemptId: null,
    });

    return NextResponse.json({
      accessCode,
      directLink: `/exam/login?code=${accessCode}`,
    });
  } catch (err) {
    return NextResponse.json({ message: 'Error interno del servidor.' }, { status: 500 });
  }
}
