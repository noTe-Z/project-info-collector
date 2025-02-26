from flask import Blueprint, jsonify, request
from .models import db, Project, URLInfo, Question, QuestionNote

main_bp = Blueprint('main', __name__)

# Add OPTIONS route handler for CORS preflight
@main_bp.route('/api/notes/<int:note_id>', methods=['OPTIONS'])
def handle_notes_options(note_id):
    return '', 204

@main_bp.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    note = QuestionNote.query.get(note_id)
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    
    data = request.get_json()
    if not data or 'note' not in data:
        return jsonify({'error': 'Note content is required'}), 400
    
    try:
        note.note = data['note']
        db.session.commit()
        return jsonify(note.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update note'}), 400

@main_bp.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = QuestionNote.query.get(note_id)
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    
    try:
        db.session.delete(note)
        db.session.commit()
        return jsonify({'message': 'Note deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete note'}), 400

@main_bp.route('/api/projects', methods=['GET'])
def get_projects():
    projects = Project.query.all()
    return jsonify([project.to_dict() for project in projects])

@main_bp.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Project name is required'}), 400
    
    project = Project(name=data['name'])
    try:
        db.session.add(project)
        db.session.commit()
        return jsonify(project.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Project name already exists'}), 400

@main_bp.route('/api/projects/<int:project_id>/questions', methods=['GET'])
def get_project_questions(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Add status filter if provided
    status = request.args.get('status')
    query = Question.query.filter_by(project_id=project_id)
    if status:
        query = query.filter_by(status=status)
    
    questions = query.order_by(Question.created_at.desc()).all()
    return jsonify([question.to_dict() for question in questions])

@main_bp.route('/api/questions', methods=['POST'])
def create_question():
    data = request.get_json()
    if not data or 'text' not in data or 'project_id' not in data:
        return jsonify({'error': 'Question text and project_id are required'}), 400
    
    project = Project.query.get(data['project_id'])
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Check for duplicate question text in the same project
    existing_question = Question.query.filter_by(
        project_id=data['project_id'],
        text=data['text'].strip()
    ).first()
    
    if existing_question:
        return jsonify({'error': 'A question with this text already exists in the project'}), 400
    
    try:
        # If parent_id is provided, get parent question and set hierarchy level
        hierarchy = 0
        parent_id = data.get('parent_id')
        if parent_id:
            parent = Question.query.get(parent_id)
            if not parent:
                return jsonify({'error': 'Parent question not found'}), 404
            if parent.project_id != project.id:
                return jsonify({'error': 'Parent question must be in the same project'}), 400
            hierarchy = parent.hierarchy + 1

        question = Question(
            text=data['text'],
            project_id=data['project_id'],
            parent_id=parent_id,
            hierarchy=hierarchy
        )
        db.session.add(question)
        db.session.commit()
        return jsonify(question.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create question'}), 400

@main_bp.route('/api/questions/<int:question_id>/notes', methods=['GET'])
def get_question_notes(question_id):
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    return jsonify([note.to_dict() for note in question.notes])

@main_bp.route('/api/urls', methods=['POST'])
def save_url():
    data = request.get_json()
    if not data or 'project_id' not in data:
        return jsonify({'error': 'Project ID is required'}), 400
    
    if not data.get('question_id'):
        return jsonify({'error': 'Question ID is required'}), 400
    
    project = Project.query.get(data['project_id'])
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    try:
        # Get or create URL info if provided
        url_info = None
        if data.get('url'):
            url_info = URLInfo.query.filter_by(url=data['url'], project_id=data['project_id']).first()
            if not url_info:
                url_info = URLInfo(
                    url=data['url'], 
                    project_id=data['project_id'],
                    title=data.get('title', '')
                )
                db.session.add(url_info)
                db.session.flush()  # Get the URL ID
        
        # Create note with question association
        if data.get('note'):
            question = Question.query.get(data['question_id'])
            if not question:
                return jsonify({'error': 'Question not found'}), 404
            
            note = QuestionNote(
                question_id=data['question_id'],
                url_id=url_info.id if url_info else None,
                note=data['note']
            )
            db.session.add(note)
        
        db.session.commit()
        
        return jsonify({
            'note': note.to_dict() if data.get('note') else None,
            'url_info': url_info.to_dict() if url_info else None
        }), 201
            
    except Exception as e:
        db.session.rollback()
        print(f"Error saving: {str(e)}")  # Add debug logging
        return jsonify({'error': 'Failed to save'}), 400

@main_bp.route('/api/projects/<int:project_id>/urls', methods=['GET'])
def get_project_urls(project_id):
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Get all URLs for the project
    urls = URLInfo.query.filter_by(project_id=project_id).order_by(URLInfo.created_at.desc()).all()
    return jsonify([url.to_dict() for url in urls])

@main_bp.route('/api/urls', methods=['GET'])
def get_all_urls():
    urls = URLInfo.query.order_by(URLInfo.id.desc()).all()
    return jsonify({
        'urls': [url.to_dict() for url in urls]
    })

@main_bp.route('/api/urls/<int:url_id>/notes', methods=['GET'])
def get_url_notes(url_id):
    url_info = URLInfo.query.get(url_id)
    if not url_info:
        return jsonify({'error': 'URL not found'}), 404
    
    return jsonify([note.to_dict() for note in url_info.notes])

@main_bp.route('/api/urls/<int:url_id>/notes', methods=['POST'])
def add_url_note(url_id):
    data = request.get_json()
    if not data or 'note' not in data:
        return jsonify({'error': 'Note content is required'}), 400
    if not data.get('question_id'):
        return jsonify({'error': 'Question ID is required'}), 400
    
    url_info = URLInfo.query.get(url_id)
    if not url_info:
        return jsonify({'error': 'URL not found'}), 404
    
    question = Question.query.get(data['question_id'])
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    note = QuestionNote(
        question_id=data['question_id'],
        url_id=url_id,
        note=data['note']
    )
    try:
        db.session.add(note)
        db.session.commit()
        return jsonify(note.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to save note'}), 400

@main_bp.route('/api/questions', methods=['GET'])
def get_all_questions():
    questions = Question.query.order_by(Question.created_at.desc()).all()
    return jsonify([question.to_dict() for question in questions])

@main_bp.route('/api/questions/<int:question_id>', methods=['DELETE'])
def delete_question(question_id):
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    try:
        db.session.delete(question)
        db.session.commit()
        return jsonify({'message': 'Question deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete question'}), 400

@main_bp.route('/api/questions/<int:question_id>/status', methods=['PUT'])
def update_question_status(question_id):
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    try:
        # Toggle status
        question.status = 'finished' if question.status == 'to_research' else 'to_research'
        db.session.commit()
        return jsonify(question.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update question status'}), 400 

@main_bp.route('/api/questions/<int:question_id>', methods=['PUT'])
def update_question(question_id):
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Question text is required'}), 400
    
    try:
        question.text = data['text']
        db.session.commit()
        return jsonify(question.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update question'}), 400

@main_bp.route('/api/questions/<int:question_id>/notes', methods=['PUT'])
def update_question_notes(question_id):
    question = Question.query.get(question_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    
    data = request.get_json()
    if not data or 'notes' not in data:
        return jsonify({'error': 'Notes are required'}), 400
    
    try:
        # Start a transaction
        db.session.begin_nested()
        
        # Get existing notes with their URL associations
        existing_notes = {note.note.strip(): note.url_id for note in question.notes}
        
        # Get or create URL info for current URL if provided
        current_url_id = None
        if data.get('current_url'):
            url_info = URLInfo.query.filter_by(url=data['current_url'], project_id=question.project_id).first()
            if not url_info:
                url_info = URLInfo(
                    url=data['current_url'],
                    project_id=question.project_id,
                    title=data.get('current_title', '')
                )
                db.session.add(url_info)
                db.session.flush()  # Get the URL ID
            current_url_id = url_info.id
        
        # Delete all existing notes
        QuestionNote.query.filter_by(question_id=question_id).delete()
        
        # Create new notes, preserving URL associations
        new_notes_text = data['notes'].strip().split('\n\n')
        for note_text in new_notes_text:
            note_text = note_text.strip()
            if note_text:
                # If this is a new note (edited note), associate it with current URL
                # Otherwise, preserve the existing URL association
                url_id = existing_notes.get(note_text, current_url_id)
                
                note = QuestionNote(
                    question_id=question_id,
                    url_id=url_id,
                    note=note_text
                )
                db.session.add(note)
        
        db.session.commit()
        
        # Return updated question with notes
        question = Question.query.get(question_id)
        return jsonify(question.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating notes: {str(e)}")  # Add debug logging
        return jsonify({'error': 'Failed to update notes'}), 400 