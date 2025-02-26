from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    
    # Configure CORS for Chrome extension
    CORS(app, resources={
        r"/api/*": {
            "origins": ["chrome-extension://*"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Accept", "Origin"],
            "supports_credentials": True
        }
    })
    
    # Configure SQLite database with absolute path
    db_path = os.path.join(os.path.dirname(__file__), 'project_info.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    
    from .routes import main_bp
    app.register_blueprint(main_bp)
    
    with app.app_context():
        db.create_all()
    
    return app 