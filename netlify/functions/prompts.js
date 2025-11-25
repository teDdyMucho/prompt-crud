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

    // GET /api/kb-file-sources -> list uploaded files
    if (event.httpMethod === 'GET' && subpath === '/kb-file-sources') {
      const { prompt_id } = event.queryStringParameters || {};

      let query = supabase
        .from('kb_file_sources')
        .select('id, file_name, file_size, mime_type, status, created_at, file_url, prompt_id')
        .order('created_at', { ascending: false });

      // Filter by prompt_id if provided
      if (prompt_id) {
        query = query.eq('prompt_id', prompt_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data || []) };
    }

    // GET /api/kb-table-sources -> list uploaded CSV files
    if (event.httpMethod === 'GET' && subpath === '/kb-table-sources') {
      const { prompt_id } = event.queryStringParameters || {};

      let query = supabase
        .from('kb_table_sources')
        .select('id, name, file_name, file_size, mime_type, status, created_at, file_url, prompt_id')
        .order('created_at', { ascending: false });

      // Filter by prompt_id if provided
      if (prompt_id) {
        query = query.eq('prompt_id', prompt_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data || []) };
    }

    // DELETE /api/kb-file-sources/:id -> delete uploaded file
    const deleteFileMatch = event.httpMethod === 'DELETE' && /^\/kb-file-sources\/([^\/]+)$/.test(subpath);
    if (deleteFileMatch) {
      const id = subpath.split('/')[2];

      const { error } = await supabase
        .from('kb_file_sources')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'File not found' }) };
        }
        throw error;
      }

      return { statusCode: 204, headers: jsonHeaders, body: '' };
    }

    // GET /api/kb-rich-text-sources -> list rich text sources
    if (event.httpMethod === 'GET' && subpath === '/kb-rich-text-sources') {
      const { prompt_id } = event.queryStringParameters || {};

      let query = supabase
        .from('kb_rich_text_sources')
        .select('id, name, content, block_type, font_family, font_size, line_height, is_bold, is_italic, is_underline, status, created_at, updated_at, prompt_id')
        .order('created_at', { ascending: false });

      // Filter by prompt_id if provided
      if (prompt_id) {
        query = query.eq('prompt_id', prompt_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data || []) };
    }

    // POST /api/kb-rich-text-sources -> create rich text source
    if (event.httpMethod === 'POST' && subpath === '/kb-rich-text-sources') {
      const { 
        name, 
        content, 
        block_type, 
        font_family, 
        font_size, 
        line_height, 
        is_bold, 
        is_italic, 
        is_underline, 
        prompt_id 
      } = JSON.parse(event.body || '{}');

      if (!name || !name.trim()) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Name is required' }) };
      }

      if (!content || !content.trim()) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Content is required' }) };
      }

      const { data, error } = await supabase
        .from('kb_rich_text_sources')
        .insert([{
          name: name.trim(),
          content: content.trim(),
          block_type: block_type || 'Paragraph',
          font_family: font_family || 'Inter',
          font_size: font_size || '14px',
          line_height: line_height || '1.5',
          is_bold: Boolean(is_bold),
          is_italic: Boolean(is_italic),
          is_underline: Boolean(is_underline),
          status: 'saved',
          prompt_id: prompt_id && prompt_id.trim() ? parseInt(prompt_id) : null
        }])
        .select()
        .single();

      if (error) throw error;
      return { statusCode: 201, headers: jsonHeaders, body: JSON.stringify(data) };
    }

    // PUT /api/kb-rich-text-sources/:id -> update rich text source
    const updateRichTextMatch = event.httpMethod === 'PUT' && /^\/kb-rich-text-sources\/([^\/]+)$/.test(subpath);
    if (updateRichTextMatch) {
      const id = subpath.split('/')[2];
      const { 
        name, 
        content, 
        block_type, 
        font_family, 
        font_size, 
        line_height, 
        is_bold, 
        is_italic, 
        is_underline, 
        prompt_id 
      } = JSON.parse(event.body || '{}');

      if (!name || !name.trim()) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Name is required' }) };
      }

      if (!content || !content.trim()) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Content is required' }) };
      }

      const { data, error } = await supabase
        .from('kb_rich_text_sources')
        .update({
          name: name.trim(),
          content: content.trim(),
          block_type: block_type || 'Paragraph',
          font_family: font_family || 'Inter',
          font_size: font_size || '14px',
          line_height: line_height || '1.5',
          is_bold: Boolean(is_bold),
          is_italic: Boolean(is_italic),
          is_underline: Boolean(is_underline),
          status: 'saved',
          updated_at: new Date().toISOString(),
          prompt_id: prompt_id ? parseInt(prompt_id) : null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Rich text source not found' }) };
        }
        throw error;
      }

      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify(data) };
    }

    // DELETE /api/kb-rich-text-sources/:id -> delete rich text source
    const deleteRichTextMatch = event.httpMethod === 'DELETE' && /^\/kb-rich-text-sources\/([^\/]+)$/.test(subpath);
    if (deleteRichTextMatch) {
      const id = subpath.split('/')[2];

      const { error } = await supabase
        .from('kb_rich_text_sources')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Rich text source not found' }) };
        }
        throw error;
      }

      return { statusCode: 204, headers: jsonHeaders, body: '' };
    }

    // Not found
    return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Not found', method: event.httpMethod, path: subpath }) };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Server error', details: String(err && err.message ? err.message : err) }) };
  }
};
