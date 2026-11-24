import { serviceRpc } from '../_shared/db.ts';
import { getGroup } from '../_shared/endpoints.ts';
import { handler } from '../_shared/http.ts';

Deno.serve(handler(getGroup(serviceRpc())));
