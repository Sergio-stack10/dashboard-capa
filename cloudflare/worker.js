/**
 * Dashboard CAPA — API de sauvegarde (Cloudflare Worker + KV)
 * -------------------------------------------------------------
 * Endpoints :
 *   GET  /api/state   → { ok, maj, taille, state }   (état complet de l'outil)
 *   POST /api/state   → { ok, maj, taille }          (sauvegarde l'état ; body JSON { app, ver, maj, state })
 *   GET  /            → petit message de vérification
 * Authentification optionnelle : si la variable d'environnement CAPA_TOKEN est définie,
 * les requêtes doivent porter « Authorization: Bearer <token> ».
 * CORS ouvert : l'outil peut être ouvert en file:// ou depuis n'importe quel domaine.
 * Limite KV : valeur ≤ 25 Mo — l'état de l'outil fait environ 2 Mo, OK.
 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
    });
    const authOk = () => !env.CAPA_TOKEN ||
      (request.headers.get('Authorization') || '').slice(7) === env.CAPA_TOKEN;

    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, app: 'dashboard-capa sync', api: ['/api/state (GET, POST)'] });
    }

    if (url.pathname === '/api/state' && request.method === 'GET') {
      if (!authOk()) return json({ ok: false, error: 'token invalide' }, 401);
      const raw = await env.CAPA_STATE.get('state');
      if (!raw) return json({ ok: false, error: 'aucune sauvegarde' }, 404);
      try {
        const parsed = JSON.parse(raw);
        return json({ ok: true, maj: parsed.maj || null, taille: raw.length, state: parsed.state || parsed });
      } catch (e) {
        return json({ ok: false, error: 'sauvegarde illisible' }, 500);
      }
    }

    if (url.pathname === '/api/state' && request.method === 'POST') {
      if (!authOk()) return json({ ok: false, error: 'token invalide' }, 401);
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'JSON invalide' }, 400); }
      const state = body && (body.state || body);
      if (!state || !state.rm2) return json({ ok: false, error: 'état sans données (rm2 absent)' }, 400);
      const maj = body.maj || new Date().toISOString().slice(0, 19).replace('T', ' ');
      const raw = JSON.stringify({ app: body.app || 'dashboard-capa', ver: body.ver || null, maj, state });
      if (raw.length > 24 * 1024 * 1024) return json({ ok: false, error: 'état trop volumineux (> 24 Mo)' }, 413);
      await env.CAPA_STATE.put('state', raw);
      await env.CAPA_STATE.put('meta', JSON.stringify({ maj, taille: raw.length, ver: body.ver || null }));
      return json({ ok: true, maj, taille: raw.length });
    }

    return json({ ok: false, error: 'route inconnue' }, 404);
  },
};
