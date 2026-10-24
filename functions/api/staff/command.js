import { json } from '../../_lib/data.js';
import { applySafeAction, readControlState, writeControlState } from '../../_lib/staff-control.js';
import { requireStaff } from '../../_lib/staff-auth.js';

const BUILT_IN_CODES = {
  '#0998': 'full-on',
  '#565': 'links-off-redirect'
};

export async function onRequestPost({ request, env }) {
  const denied = await requireStaff(request, env);
  if (denied) return denied;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (typeof body?.code !== 'string' || body.code.length > 12) return json({ error: 'Enter a valid staff code.' }, 400);
  try {
    const state = await readControlState(env);
    if (body.code === '#7878') {
      const storage = await env.ENTRIES.get('staff-control').then(() => 'ok');
      return json({
        result: 'Diagnostic complete.',
        health: {
          status: 'ok',
          website: state.full.enabled ? 'maintenance' : 'online',
          storage,
          pages: Object.fromEntries(Object.entries(state.pages).map(([page, settings]) => [page, settings.enabled ? 'online' : 'maintenance'])),
          time: new Date().toISOString()
        }
      });
    }
    const action = BUILT_IN_CODES[body.code] || state.customCodes.find((item) => item.code === body.code)?.action;
    if (!action) return json({ error: 'Unknown staff code.' }, 404);
    applySafeAction(state, action);
    await writeControlState(env, state);
    return json({ result: `Code ${body.code} executed.`, state });
  } catch {
    return json({ error: 'Could not execute the staff code.' }, 503);
  }
}