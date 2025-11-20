import { createClient } from '@supabase/supabase-js';

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables' }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Normalize path after '/.netlify/functions/prompts'
  const baseMatch = /\.netlify\/functions\/prompts(.*)$/;
  let subpath = '/';
  try {
    const m = (event.path || '/').match(baseMatch);
    subpath = (m && m[1]) || '/';
  } catch {}
  if (!subpath.startsWith('/')) subpath = '/' + subpath;

  try {
    // GET /api/health -> quick diagnostics (does not leak secrets)
    if (event.httpMethod === 'GET' && subpath === '/health') {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: true,
          env: {
            SUPABASE_URL_SET: Boolean(supabaseUrl),
            SUPABASE_ANON_KEY_SET: Boolean(supabaseKey),
            node: process.version,
          },
        }),
      };
    }

    // GET /api or /api/prompts -> list
    if (event.httpMethod === 'GET' && (subpath === '/' || subpath === '/prompts')) {
      const { data, error } = await supabase
        .from('prompts')
        .select('id, name, prompt, location_id, business_name, knowledgebase, inventory')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data || []) };
    }

    // POST /api/prompts -> create
    if (event.httpMethod === 'POST' && subpath === '/prompts') {
      const { name, prompt, location_id, business_name, knowledgebase, inventory } = JSON.parse(event.body || '{}');
      if (!name || !prompt) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Name and prompt are required' }) };
      }

      const { data, error } = await supabase
        .from('prompts')
        .insert([{ name, prompt, location_id, business_name, knowledgebase, inventory }])
        .select()
        .single();

      if (error) throw error;

      // If location_id was not provided, set it equal to the generated id
      if (!location_id && data && data.id) {
        const { data: updated, error: updErr } = await supabase
          .from('prompts')
          .update({ location_id: data.id })
          .eq('id', data.id)
          .select()
          .single();
        if (updErr) {
          // Not fatal for the create, but return meaningful info
          return { statusCode: 201, headers: jsonHeaders, body: JSON.stringify({ ...data, _warning: 'Failed to auto-set location_id', _details: String(updErr.message || updErr) }) };
        }
        return { statusCode: 201, headers: jsonHeaders, body: JSON.stringify(updated) };
      }

      return { statusCode: 201, headers: jsonHeaders, body: JSON.stringify(data) };
    }

    // PUT /api/prompts/:id -> update
    const putMatch = event.httpMethod === 'PUT' && /^\/prompts\/([^\/]+)$/.test(subpath);
    if (putMatch) {
      const id = subpath.split('/')[2];
      const { name, prompt, location_id, business_name, knowledgebase, inventory } = JSON.parse(event.body || '{}');
      if (!name || !prompt) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Name and prompt are required' }) };
      }

      const { data, error } = await supabase
        .from('prompts')
        .update({ name, prompt, location_id, business_name, knowledgebase, inventory })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Prompt not found' }) };
        }
        throw error;
      }

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data) };
    }

    // DELETE /api/prompts/:id -> delete
    const delMatch = event.httpMethod === 'DELETE' && /^\/prompts\/([^\/]+)$/.test(subpath);
    if (delMatch) {
      const id = subpath.split('/')[2];

      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { statusCode: 204, headers: jsonHeaders, body: '' };
    }

    // Not found
    return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Not found', method: event.httpMethod, path: subpath }) };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Server error', details: String(err && err.message ? err.message : err) }) };
  }
};
