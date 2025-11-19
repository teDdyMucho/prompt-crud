const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
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

  let supabase;
  try {
    // ESM-only package: dynamically import inside handler for CJS functions
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  } catch (importErr) {
    console.error('Supabase import/init error:', importErr);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Initialization error', details: String(importErr && importErr.message ? importErr.message : importErr) }) };
  }

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
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data || []) };
    }

    // POST /api/prompts -> create
    if (event.httpMethod === 'POST' && subpath === '/prompts') {
      const { name, description, prompt } = JSON.parse(event.body || '{}');
      if (!name || !description || !prompt) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Name, description, and prompt are required' }) };
      }

      const { data, error } = await supabase
        .from('prompts')
        .insert([{ name, description, prompt }])
        .select()
        .single();

      if (error) throw error;
      return { statusCode: 201, headers: jsonHeaders, body: JSON.stringify(data) };
    }

    // PUT /api/prompts/:id -> update
    const putMatch = event.httpMethod === 'PUT' && /^\/prompts\/([^\/]+)$/.test(subpath);
    if (putMatch) {
      const id = subpath.split('/')[2];
      const { name, description, prompt } = JSON.parse(event.body || '{}');
      if (!name || !description || !prompt) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Name, description, and prompt are required' }) };
      }

      const { data, error } = await supabase
        .from('prompts')
        .update({ name, description, prompt })
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
