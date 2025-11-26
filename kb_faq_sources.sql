-- Table for storing FAQ content from Knowledge Sources
CREATE TABLE public.kb_faq_sources (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  prompt_id INTEGER NULL REFERENCES prompts(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_kb_faq_sources_prompt_id ON kb_faq_sources(prompt_id);
CREATE INDEX idx_kb_faq_sources_created_at ON kb_faq_sources(created_at);
CREATE INDEX idx_kb_faq_sources_status ON kb_faq_sources(status);

-- Add full-text search index for questions and answers
CREATE INDEX idx_kb_faq_sources_search ON kb_faq_sources USING gin(to_tsvector('english', question || ' ' || answer));

-- Sample data (optional)
-- INSERT INTO kb_faq_sources (question, answer, prompt_id) VALUES 
-- ('What are your business hours?', 'We are open Monday to Friday from 9 AM to 6 PM, and Saturday from 10 AM to 4 PM.', 1),
-- ('How can I contact customer support?', 'You can reach our customer support team via email at support@company.com or by calling (555) 123-4567.', 1);
