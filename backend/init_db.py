from app import create_app, db
from app.models import Project, URLInfo, Question, QuestionNote
import traceback
from sqlalchemy import inspect, text

app = create_app()

def table_exists(table_name):
    inspector = inspect(db.engine)
    return table_name in inspector.get_table_names()

def column_exists(table_name, column_name):
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def add_column(table_name, column):
    column_name = column.name
    column_type = column.type.compile(dialect=db.engine.dialect)
    nullable = "NULL" if column.nullable else "NOT NULL"
    
    # Handle default values
    if column.server_default:
        default = f"DEFAULT {column.server_default.arg}"
    elif not column.nullable:
        # For non-nullable columns without a server_default, use 0 for integers
        if isinstance(column.type, db.Integer):
            default = "DEFAULT 0"
        else:
            default = ""
    else:
        default = ""
    
    sql = f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type} {nullable} {default}'
    return text(sql)

def recreate_table_with_fk():
    # Create new table with all columns including foreign key
    db.session.execute(text("""
        CREATE TABLE question_new (
            id INTEGER NOT NULL PRIMARY KEY,
            text VARCHAR(500) NOT NULL,
            project_id INTEGER NOT NULL,
            created_at DATETIME,
            status VARCHAR(20) NOT NULL,
            hierarchy INTEGER NOT NULL DEFAULT 0,
            parent_id INTEGER,
            FOREIGN KEY(project_id) REFERENCES project (id),
            FOREIGN KEY(parent_id) REFERENCES question_new (id) ON DELETE SET NULL
        )
    """))
    
    # Copy data from old table to new table
    db.session.execute(text("""
        INSERT INTO question_new (id, text, project_id, created_at, status, hierarchy, parent_id)
        SELECT id, text, project_id, created_at, status, hierarchy, parent_id
        FROM question
    """))
    
    # Drop old table
    db.session.execute(text("DROP TABLE question"))
    
    # Rename new table to original name
    db.session.execute(text("ALTER TABLE question_new RENAME TO question"))

with app.app_context():
    try:
        # Create tables only if they don't exist
        print("Checking database tables...")
        db.create_all()
        
        # Verify tables were created
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"Existing tables: {tables}")
        
        # Add new columns to Question table if they don't exist
        if table_exists('question'):
            needs_fk = False
            
            # Add hierarchy column
            if not column_exists('question', 'hierarchy'):
                print("Adding hierarchy column to question table...")
                db.session.execute(add_column('question', Question.__table__.c.hierarchy))
            
            # Add parent_id column
            if not column_exists('question', 'parent_id'):
                print("Adding parent_id column to question table...")
                db.session.execute(add_column('question', Question.__table__.c.parent_id))
                needs_fk = True
            
            db.session.commit()
            
            # If we added parent_id, we need to recreate the table to add the foreign key
            if needs_fk:
                print("Recreating table with foreign key constraint...")
                recreate_table_with_fk()
                db.session.commit()
            
            # Verify Question table schema
            columns = [col['name'] for col in inspector.get_columns('question')]
            print(f"Question table columns: {columns}")
        
        print("Database check completed successfully")
    except Exception as e:
        print(f"Error checking database: {str(e)}")
        print("Traceback:")
        traceback.print_exc() 