import { NextResponse } from 'next/server';
import { invitations } from '../../state';

export async function POST(request: Request) {
  try {
    const { accessCode } = await request.json();

    if (!accessCode) {
      return NextResponse.json({ message: 'La clave de acceso es requerida.' }, { status: 400 });
    }

    const invitation = invitations.get(accessCode.toUpperCase());

    if (!invitation) {
      return NextResponse.json({ message: 'La clave de acceso es incorrecta.' }, { status: 404 });
    }

    if (invitation.claimed) {
      return NextResponse.json({ message: 'Esta clave de acceso ya ha sido utilizada.' }, { status: 400 });
    }

    return NextResponse.json({
      candidateName: invitation.candidateName,
      email: invitation.email,
      examId: invitation.examId,
      examTitle: invitation.examTitle,
    });
  } catch (err) {
    return NextResponse.json({ message: 'Error al verificar la clave de acceso.' }, { status: 500 });
  }
}
