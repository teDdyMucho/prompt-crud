const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { supabase } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer configuration for CSV uploads
const uploadCSV = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Multer configuration for file uploads (PDF, DOC, DOCX)
const uploadFiles = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// GET all prompts from Supabase
app.get('/api/prompts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('id, name, prompt, location_id, business_name, knowledgebase, inventory, created_at')
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
  const { name, prompt, location_id, business_name, knowledgebase, inventory } = req.body;

  if (!name || !prompt) {
    return res.status(400).json({ error: 'Name and prompt are required' });
  }

  try {
    const { data, error } = await supabase
      .from('prompts')
      .insert([{ name, prompt, location_id, business_name, knowledgebase, inventory }])
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
  const { name, prompt, location_id, business_name, knowledgebase, inventory } = req.body;

  if (!name || !prompt) {
    return res.status(400).json({ error: 'Name and prompt are required' });
  }

  try {
    const { data, error } = await supabase
      .from('prompts')
      .update({ name, prompt, location_id, business_name, knowledgebase, inventory })
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

// POST upload CSV file to kb_table_sources
app.post('/api/kb-table-sources', uploadCSV.single('file'), async (req, res) => {
  try {
    const { name, prompt_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    console.log('Uploading CSV:', { name, prompt_id, file: file.originalname, size: file.size });

    // Insert record into kb_table_sources table
    const { data, error } = await supabase
      .from('kb_table_sources')
      .insert([{
        name: name.trim(),
        file_path: file.path,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype || 'text/csv',
        status: 'uploaded',
        file_url: `/uploads/${file.filename}`, // Relative URL for serving the file
        prompt_id: prompt_id && prompt_id.trim() ? parseInt(prompt_id) : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting into kb_table_sources:', error);
      // Clean up uploaded file if database insert fails
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
      return res.status(500).json({ error: 'Failed to save file record' });
    }

    console.log('CSV upload successful:', data);
    return res.status(201).json(data);
  } catch (err) {
    console.error('Unexpected error uploading CSV:', err);
    // Clean up uploaded file if there's an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// GET uploaded files from kb_file_sources
app.get('/api/kb-file-sources', async (req, res) => {
  try {
    const { prompt_id } = req.query;

    let query = supabase
      .from('kb_file_sources')
      .select('id, file_name, file_size, mime_type, status, created_at, file_url, prompt_id')
      .order('created_at', { ascending: false });

    // Filter by prompt_id if provided
    if (prompt_id) {
      query = query.eq('prompt_id', prompt_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching files from kb_file_sources:', error);
      return res.status(500).json({ error: 'Failed to fetch files' });
    }

    return res.json(data || []);
  } catch (err) {
    console.error('Unexpected error fetching files:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// POST upload PDF/DOC files to kb_file_sources
app.post('/api/kb-file-sources', uploadFiles.single('file'), async (req, res) => {
  try {
    const { prompt_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Uploading File:', { prompt_id, file: file.originalname, size: file.size, type: file.mimetype });

    // Insert record into kb_file_sources table
    const { data, error } = await supabase
      .from('kb_file_sources')
      .insert([{
        file_path: file.path,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        status: 'uploaded',
        file_url: `/uploads/${file.filename}`,
        prompt_id: prompt_id && prompt_id.trim() ? parseInt(prompt_id) : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting into kb_file_sources:', error);
      // Clean up uploaded file if database insert fails
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
      return res.status(500).json({ error: 'Failed to save file record' });
    }

    console.log('File upload successful:', data);
    return res.status(201).json(data);
  } catch (err) {
    console.error('Unexpected error uploading file:', err);
    // Clean up uploaded file if there's an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
