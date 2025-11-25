-- Table for storing Rich Text content from Knowledge Sources
CREATE TABLE public.kb_rich_text_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  block_type VARCHAR(50) DEFAULT 'Paragraph',
  font_family VARCHAR(100) DEFAULT 'Inter',
  font_size VARCHAR(20) DEFAULT '14px',
  line_height VARCHAR(20) DEFAULT '1.5',
  is_bold BOOLEAN DEFAULT FALSE,
  is_italic BOOLEAN DEFAULT FALSE,
  is_underline BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'saved',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  prompt_id INTEGER NULL REFERENCES prompts(id) ON DELETE SET NULL
);

-- Create index for better performance
CREATE INDEX idx_kb_rich_text_sources_prompt_id ON kb_rich_text_sources(prompt_id);
CREATE INDEX idx_kb_rich_text_sources_created_at ON kb_rich_text_sources(created_at);

-- Add RLS (Row Level Security) if needed
-- ALTER TABLE kb_rich_text_sources ENABLE ROW LEVEL SECURITY;

-- Sample data (optional)
-- INSERT INTO kb_rich_text_sources (name, content, prompt_id) VALUES 
-- ('Sample Rich Text', '<p>This is a sample rich text content with <b>bold</b> and <i>italic</i> formatting.</p>', 1);
