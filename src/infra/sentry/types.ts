export type HttpErrorContext = {
  error: unknown;
  set: { status?: number | string };
};

export type ElysiaErrorContext = HttpErrorContext & {
  request: Request;
  route: string;
  path: string;
};
