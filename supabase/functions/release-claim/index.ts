import { serviceRpc } from '../_shared/db.ts';
import { releaseClaim } from '../_shared/endpoints.ts';
import { handler } from '../_shared/http.ts';

Deno.serve(handler(releaseClaim(serviceRpc())));
