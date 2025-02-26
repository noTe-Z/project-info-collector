from datetime import datetime
from . import db

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    urls = db.relationship('URLInfo', backref='project', lazy=True)
    questions = db.relationship('Question', backref='project', lazy=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat()
        }

class URLInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(2048), nullable=False)
    title = db.Column(db.String(500), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.relationship('QuestionNote', backref='url_info', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'url': self.url,
            'title': self.title,
            'project_id': self.project_id,
            'created_at': self.created_at.isoformat()
        }

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='to_research', nullable=False)  # 'to_research' or 'finished'
    notes = db.relationship('QuestionNote', backref='question', lazy=True, cascade='all, delete-orphan')
    hierarchy = db.Column(db.Integer, default=0, nullable=False)  # Level in question hierarchy
    parent_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=True)  # Parent question ID
    children = db.relationship('Question', backref=db.backref('parent', remote_side=[id]), lazy=True)

    def to_dict(self, include_notes=True):
        result = {
            'id': self.id,
            'text': self.text,
            'project_id': self.project_id,
            'created_at': self.created_at.isoformat(),
            'status': self.status,
            'hierarchy': self.hierarchy,
            'parent_id': self.parent_id
        }
        if include_notes:
            result['notes'] = [note.to_dict() for note in self.notes]
        return result

class QuestionNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    url_id = db.Column(db.Integer, db.ForeignKey('url_info.id'), nullable=True)  # URL reference is optional
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        result = {
            'id': self.id,
            'question_id': self.question_id,
            'note': self.note,
            'created_at': self.created_at.isoformat()
        }
        if self.url_id:
            result['url'] = self.url_info.to_dict()
        return result 