const { createClient } = require('@supabase/supabase-js');

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

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Netlify invokes functions at '/.netlify/functions/<name>'
  const base = '/.netlify/functions/prompts';
  const subpath = event.path && event.path.startsWith(base)
    ? event.path.slice(base.length)
    : event.path || '/';

  try {
    // GET /api/prompts -> list
    if (event.httpMethod === 'GET' && subpath === '/prompts') {
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
    return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Not found', path: subpath }) };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Server error', details: String(err.message || err) }) };
  }
};
