# Prompt Management System

A modern, full-stack web application for managing prompts with a clean, minimalist design.

## Features

- **View All Prompts**: Display prompts in a clean table format
- **Add New Prompts**: Modal form to create new prompts
- **Edit Prompts**: Update existing prompts with pre-filled forms
- **Delete Prompts**: Confirmation dialog for safe deletion
- **View Full Prompt**: Modal to view complete prompt content
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- Modern UI components with hover effects

### Backend
- Node.js
- Express.js
- In-memory database (easily replaceable with real database)
- RESTful API

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. **Install all dependencies:**
   ```bash
   npm run install-all
   ```

2. **Start the development servers:**
   ```bash
   npm run dev
   ```

This will start:
- Backend server on http://localhost:5000
- Frontend development server on http://localhost:3000

### Manual Setup (Alternative)

If the quick start doesn't work, you can set up manually:

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **Install client dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Start backend server:**
   ```bash
   cd server
   npm run dev
   ```

5. **In a new terminal, start frontend:**
   ```bash
   cd client
   npm start
   ```

## API Endpoints

- `GET /api/prompts` - Get all prompts
- `POST /api/prompts` - Create a new prompt
- `PUT /api/prompts/:id` - Update a prompt
- `DELETE /api/prompts/:id` - Delete a prompt

## Default Data

The application comes pre-seeded with 5 sample prompts:
- No Response (Escalation)
- Response (Support)
- Processing (Reminder)
- Stuck (Follow-up)
- No Response (Pending)

## Usage

1. **View Prompts**: All prompts are displayed in the main table
2. **Add Prompt**: Click "Add New Prompt" button
3. **Edit Prompt**: Click "Edit" in the Actions column
4. **Delete Prompt**: Click "Delete" and confirm in the dialog
5. **View Full Prompt**: Click "View Full Prompt" link in the table
6. **Refresh**: Click "Refresh" to reload data from the server

## Customization

### Adding New Description Options
Edit the `descriptionOptions` array in `client/src/App.js`:

```javascript
const descriptionOptions = ['Escalation', 'Support', 'Reminder', 'Follow-up', 'Pending', 'Your Custom Option'];
```

### Styling
The application uses Tailwind CSS. Modify classes in the components or extend the theme in `client/tailwind.config.js`.

### Database
Currently uses in-memory storage. To use a real database:
1. Install your preferred database package (e.g., MongoDB, PostgreSQL)
2. Replace the in-memory `prompts` array in `server/index.js`
3. Update the CRUD operations to use your database

## Project Structure

```
prompt-management-system/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── App.js         # Main application component
│   │   ├── index.js       # React entry point
│   │   └── index.css      # Tailwind CSS imports
│   └── package.json
├── server/                 # Node.js backend
│   ├── index.js           # Express server with API routes
│   └── package.json
├── package.json           # Root package.json with scripts
└── README.md
```

## Development

The application is set up for easy development:
- Hot reloading for both frontend and backend
- Concurrent development servers
- Clean separation of concerns
- Modern React hooks and functional components

## Production Build

To build for production:

```bash
cd client
npm run build
```

The build files will be in `client/build/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for any purpose.
