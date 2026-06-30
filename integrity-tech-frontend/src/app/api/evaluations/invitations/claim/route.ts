import { NextResponse } from 'next/server';
import { invitations } from '../../state';

export async function POST(request: Request) {
  try {
    const { accessCode, candidateName, email } = await request.json();

    if (!accessCode) {
      return NextResponse.json({ message: 'La clave de acceso es requerida.' }, { status: 400 });
    }

    const invitation = invitations.get(accessCode.toUpperCase());

    if (!invitation) {
      return NextResponse.json({ message: 'Invitación no encontrada.' }, { status: 404 });
    }

    if (invitation.claimed) {
      return NextResponse.json({ message: 'Esta clave de acceso ya ha sido utilizada.' }, { status: 400 });
    }

    // Generar un ID de intento aleatorio
    const attemptId = `att-${Math.floor(1000 + Math.random() * 9000)}`;

    // Marcar como reclamado
    invitation.claimed = true;
    invitation.attemptId = attemptId;

    return NextResponse.json({
      attemptId,
      token: `jwt-mock-token-for-${attemptId}`,
    });
  } catch (err) {
    return NextResponse.json({ message: 'Error al iniciar sesión en el examen.' }, { status: 500 });
  }
}
