// The slice of the Deno runtime these functions use, so they type-check with tsc as well.
declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  env: { get(key: string): string | undefined };
};
