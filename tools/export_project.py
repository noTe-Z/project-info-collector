#!/usr/bin/env python
import os
import sys
import sqlite3
from datetime import datetime

def get_db_path():
    # Get the absolute path to the database
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(current_dir, 'backend', 'app', 'project_info.db')

def export_project_to_markdown(project_id, output_file):
    # Connect to the database
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get project name
    cursor.execute('SELECT name FROM project WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    if not project:
        print(f"Project with ID {project_id} not found.")
        return
    
    # Get all questions for the project
    cursor.execute('''
        SELECT id, text, status, created_at 
        FROM question 
        WHERE project_id = ? 
        ORDER BY created_at DESC
    ''', (project_id,))
    questions = cursor.fetchall()
    
    # Prepare the markdown content
    content = [f"# {project['name']}\n\nExported on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"]
    
    for question in questions:
        # Get notes for this question
        cursor.execute('''
            SELECT qn.note, qn.created_at, u.url, u.title
            FROM question_note qn
            LEFT JOIN url_info u ON qn.url_id = u.id
            WHERE qn.question_id = ?
            ORDER BY qn.created_at DESC
        ''', (question['id'],))
        notes = cursor.fetchall()
        
        # Add question as a level 2 heading
        content.append(f"\n## {question['text']}")
        
        # Add notes with URLs
        if notes:
            notes_content = []
            for note in notes:
                note_text = note['note'].strip()
                if note['url']:
                    url_text = f"\nURL: [{note['title'] or note['url']}]({note['url']})"
                    notes_content.append(f"{note_text}{url_text}")
                else:
                    notes_content.append(note_text)
            
            content.append('\n\n--------\n'.join(notes_content))
        else:
            content.append('\nNo notes yet.')
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(content))
    
    print(f"Project data has been exported to {output_file}")
    conn.close()

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python export_project.py <project_id>")
        sys.exit(1)
    
    try:
        project_id = int(sys.argv[1])
        output_file = f"project_{project_id}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        export_project_to_markdown(project_id, output_file)
    except ValueError:
        print("Error: Project ID must be a number")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1) 