// Error propio con código HTTP, para que las reglas y el Service puedan avisar qué pasó.
export class AppError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}
