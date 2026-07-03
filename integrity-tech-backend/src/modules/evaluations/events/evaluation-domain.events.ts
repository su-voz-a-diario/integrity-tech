export class InvitationCreated {
  constructor(
    public readonly invitationId: string,
    public readonly organizationId: string,
    public readonly examId: string,
  ) {}
}

export class AttemptStarted {
  constructor(
    public readonly attemptId: string,
    public readonly organizationId: string,
    public readonly examId: string,
    public readonly userId: string,
  ) {}
}

export class AttemptFinalized {
  constructor(
    public readonly attemptId: string,
    public readonly organizationId: string,
    public readonly status: string,
  ) {}
}

export class ReportGenerated {
  constructor(
    public readonly attemptId: string,
    public readonly organizationId: string,
  ) {}
}
