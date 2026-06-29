import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    this.logger.log(`Consultando base de datos de IAM para permisos del usuario: ${userId}`);
    
    // Simulación: el usuario con ID 'student-id' solo tiene acceso a tomar exámenes ('exam:attempt')
    // El usuario 'teacher-id' tiene acceso completo a crear exámenes ('exam:create')
    if (userId === 'student-id' && permission === 'exam:attempt') return true;
    if (userId === 'teacher-id' && (permission === 'exam:create' || permission === 'exam:attempt')) return true;
    
    return false;
  }
}
