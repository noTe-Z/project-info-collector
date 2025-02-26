# Project Info Collector

A Chrome extension with Flask backend for collecting and organizing project-related URLs. This tool helps you save and organize URLs by project, add notes, and easily access your saved links.

## Features

- Save URLs to specific projects
- Add notes to saved URLs
- Automatic webpage title capture
- View saved URLs filtered by project
- Persistent project selection
- Clean, modern interface
- One-click URL opening
- Export project data to markdown files

## Setup Instructions

### Backend Setup

1. Create a Python virtual environment (Python 3.10 recommended):
```bash
python -m venv py310
source py310/bin/activate  # On Windows: py310\Scripts\activate
```

2. Install backend dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Initialize the database:
```bash
python init_db.py
```

4. Start the Flask server:
```bash
python run.py
```

The backend will run on `http://localhost:5000` by default.

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` directory from this project
4. The extension icon should appear in your Chrome toolbar

## Usage

### Basic Usage

1. Click the extension icon to open the popup
2. To save a URL:
   - Select or create a project
   - Add optional notes
   - Click "Save URL"
3. To view saved URLs:
   - Click "View URLs" in the popup
   - Use the project dropdown to filter URLs
   - Click any URL to open it in a new tab

### Exporting Project Data

You can export all URLs and notes from a project to a markdown file using the export tool:

```bash
python tools/export_project.py <project_id>
```

This will create a markdown file named `project_<id>_export_<timestamp>.md` containing:
- Project name
- All saved URLs with their titles
- Associated notes organized by questions/topics
- Timestamps for each entry

## Development

### Project Structure

```
.
├── backend/                 # Flask backend
│   ├── app/                # Application code
│   └── requirements.txt    # Backend dependencies
├── extension/              # Chrome extension
│   ├── manifest.json       # Extension configuration
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   └── background.js      # Background scripts
├── tools/                  # Utility tools
│   └── export_project.py   # Project data export utility
└── requirements.txt        # Project dependencies
```

### API Endpoints

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/urls` - Get all URLs
- `POST /api/urls` - Save new URL
- `GET /api/projects/{id}/urls` - Get URLs for specific project

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
