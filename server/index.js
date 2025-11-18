const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { supabase } = require('./supabaseClient');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// GET all prompts from Supabase
app.get('/api/prompts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching prompts from Supabase:', error);
      return res.status(500).json({ error: 'Failed to fetch prompts' });
    }

    return res.json(data || []);
  } catch (err) {
    console.error('Unexpected error fetching prompts:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// POST create new prompt in Supabase
app.post('/api/prompts', async (req, res) => {
  const { name, description, prompt } = req.body;

  if (!name || !description || !prompt) {
    return res.status(400).json({ error: 'Name, description, and prompt are required' });
  }

  try {
    const { data, error } = await supabase
      .from('prompts')
      .insert([{ name, description, prompt }])
      .select()
      .single();

    if (error) {
      console.error('Error creating prompt in Supabase:', error);
      return res.status(500).json({ error: 'Failed to create prompt' });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('Unexpected error creating prompt:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// PUT update prompt in Supabase
app.put('/api/prompts/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, prompt } = req.body;

  if (!name || !description || !prompt) {
    return res.status(400).json({ error: 'Name, description, and prompt are required' });
  }

  try {
    const { data, error } = await supabase
      .from('prompts')
      .update({ name, description, prompt })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prompt in Supabase:', error);
      // If Supabase returns no rows, treat as 404
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      return res.status(500).json({ error: 'Failed to update prompt' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    return res.json(data);
  } catch (err) {
    console.error('Unexpected error updating prompt:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// DELETE prompt in Supabase
app.delete('/api/prompts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('prompts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prompt in Supabase:', error);
      return res.status(500).json({ error: 'Failed to delete prompt' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('Unexpected error deleting prompt:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
