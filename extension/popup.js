const API_BASE_URL = 'http://localhost:5000/api';

// Show message in the popup
function showMessage(text, isError = false) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
    messageDiv.className = isError ? 'error' : 'success';
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

// Store last selected project
function storeLastProject(projectId) {
    chrome.storage.local.set({ lastProjectId: projectId });
}

// Store last selected question
function storeLastQuestion(questionId) {
    chrome.storage.local.set({ lastQuestionId: questionId });
}

// Load projects into select dropdown
async function loadProjects(targetSelect = 'projectSelect') {
    try {
        const response = await fetch(`${API_BASE_URL}/projects`);
        const projects = await response.json();
        const select = document.getElementById(targetSelect);
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add projects to select
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
        });

        // Set last selected project if this is the main project select
        if (targetSelect === 'projectSelect') {
            chrome.storage.local.get('lastProjectId', function(data) {
                if (data.lastProjectId) {
                    select.value = data.lastProjectId;
                }
            });
        }
    } catch (error) {
        showMessage('Failed to load projects', true);
    }
}

// Load questions for a project
async function loadQuestions(projectId) {
    try {
        if (!projectId) {
            const questionSelect = document.getElementById('questionSelect');
            questionSelect.innerHTML = '<option value="" class="question-placeholder">Select or add a question...</option>';
            return;
        }

        // Only load 'to_research' questions for the dropdown
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/questions?status=to_research`);
        const questions = await response.json();
        const questionSelect = document.getElementById('questionSelect');
        
        // Clear existing options except the placeholder
        questionSelect.innerHTML = '<option value="" class="question-placeholder">Select or add a question...</option>';
        
        // Add questions to select with indentation based on hierarchy
        questions.forEach(question => {
            const option = document.createElement('option');
            option.value = question.id;
            // Add indentation based on hierarchy level
            const indent = '  '.repeat(question.hierarchy);
            option.textContent = indent + question.text;
            questionSelect.appendChild(option);
        });

        // Set last selected question
        chrome.storage.local.get('lastQuestionId', function(data) {
            if (data.lastQuestionId) {
                // Only set if the question belongs to current project
                const questionExists = Array.from(questionSelect.options).some(opt => opt.value === data.lastQuestionId.toString());
                if (questionExists) {
                    questionSelect.value = data.lastQuestionId;
                }
            }
        });
    } catch (error) {
        showMessage('Failed to load questions', true);
    }
}

// Create new project
async function createProject(name) {
    try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        const project = await response.json();
        await loadProjects();
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.value = project.id;
        storeLastProject(project.id);
        return true;
    } catch (error) {
        showMessage(error.message, true);
        return false;
    }
}

// Create new question
async function createQuestion(projectId, text, parentId = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                project_id: projectId,
                text: text.trim(),
                parent_id: parentId
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create question');
        }
        
        const question = await response.json();
        // First store the new question ID
        storeLastQuestion(question.id);
        // Then reload questions and ensure the new one is selected
        await loadQuestions(projectId);
        const questionSelect = document.getElementById('questionSelect');
        questionSelect.value = question.id;
        return true;
    } catch (error) {
        // Show error message and keep input visible if it's a duplicate
        showMessage(error.message, true);
        if (error.message.includes('already exists')) {
            // Keep the input visible and focused
            const questionInput = document.getElementById('questionInput');
            questionInput.focus();
            questionInput.select(); // Select the text for easy editing
            return false;
        }
        return false;
    }
}

// Save current URL or question note
async function saveCurrentUrl(projectId) {
    try {
        // Get note from textarea and question ID
        const note = document.getElementById('noteInput').value.trim();
        const questionId = document.getElementById('questionSelect').value;
        
        if (!note) {
            showMessage('Please enter a note', true);
            return;
        }

        // Get current tab info first
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Prepare request body
        const requestBody = {
            project_id: projectId,
            note: note,
            question_id: questionId || null,
            url: tab.url,
            title: tab.title
        };
        
        const response = await fetch(`${API_BASE_URL}/urls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        // Store last selected project and question
        storeLastProject(projectId);
        if (questionId) {
            storeLastQuestion(questionId);
        }
        
        // Clear the note input after successful save
        document.getElementById('noteInput').value = '';
        showMessage('Note saved successfully!');
    } catch (error) {
        showMessage(error.message, true);
    }
}

// Load saved URLs
async function loadSavedUrls() {
    try {
        const projectId = document.getElementById('historyProjectSelect').value;
        const response = await fetch(`${API_BASE_URL}${projectId ? `/projects/${projectId}/urls` : '/urls'}`);
        const data = await response.json();
        displayUrls(data.urls || data);
    } catch (error) {
        showMessage('Failed to load saved URLs', true);
    }
}

// Display URLs in history view
function displayUrls(urls) {
    const historyView = document.getElementById('historyView');
    const urlsList = document.getElementById('urlsList');
    urlsList.innerHTML = '';

    if (!urls || urls.length === 0) {
        urlsList.innerHTML = '<div class="url-item">No saved URLs yet</div>';
        return;
    }

    urls.forEach(url => {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';

        const titleLink = document.createElement('a');
        titleLink.href = url.url;
        titleLink.className = 'url-title';
        titleLink.textContent = url.title || url.url;
        titleLink.target = '_blank';

        const noteDiv = document.createElement('div');
        noteDiv.className = 'url-note';
        noteDiv.textContent = url.note || 'No note';

        urlItem.appendChild(titleLink);
        urlItem.appendChild(noteDiv);
        urlsList.appendChild(urlItem);
    });
}

// Load questions for history view
async function loadQuestionHistory() {
    try {
        const projectId = document.getElementById('historyProjectSelect').value;
        const response = await fetch(`${API_BASE_URL}${projectId ? `/projects/${projectId}/questions` : '/questions'}`);
        const questions = await response.json();
        
        // For each question, fetch its notes
        const questionsWithNotes = await Promise.all(questions.map(async (question) => {
            const notesResponse = await fetch(`${API_BASE_URL}/questions/${question.id}/notes`);
            const notes = await notesResponse.json();
            return {
                ...question,
                notes: notes
            };
        }));
        
        displayQuestions(questionsWithNotes);
    } catch (error) {
        showMessage('Failed to load questions', true);
    }
}

// Handle question status toggle
async function toggleQuestionStatus(questionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/questions/${questionId}/status`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        // Reload questions list
        loadQuestionHistory();
        // Also reload dropdown in case the status changed to finished
        const projectId = document.getElementById('projectSelect').value;
        if (projectId) {
            loadQuestions(projectId);
        }
    } catch (error) {
        showMessage('Failed to update question status', true);
    }
}

// Handle question deletion
async function deleteQuestion(questionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        // Reload questions list
        loadQuestionHistory();
        // Also reload dropdown
        const projectId = document.getElementById('projectSelect').value;
        if (projectId) {
            loadQuestions(projectId);
        }
        
        showMessage('Question deleted successfully');
    } catch (error) {
        showMessage('Failed to delete question', true);
    }
}

// Show context menu
function showContextMenu(e, question) {
    e.preventDefault();
    
    // Remove any existing context menus
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    
    // Edit question item
    const editQuestionItem = document.createElement('div');
    editQuestionItem.className = 'context-menu-item';
    editQuestionItem.textContent = 'Edit Question';
    editQuestionItem.onclick = () => {
        makeQuestionEditable(question);
        menu.remove();
    };
    
    // Edit notes item
    const editNotesItem = document.createElement('div');
    editNotesItem.className = 'context-menu-item';
    editNotesItem.textContent = 'Edit Notes';
    editNotesItem.onclick = () => {
        makeNotesEditable(question);
        menu.remove();
    };
    
    // Delete item
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = 'Delete Question';
    deleteItem.onclick = () => {
        deleteQuestion(question.id);
        menu.remove();
    };
    
    menu.appendChild(editQuestionItem);
    menu.appendChild(editNotesItem);
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

// Make question text editable
function makeQuestionEditable(question) {
    const questionItem = document.querySelector(`[data-question-id="${question.id}"]`);
    const questionText = questionItem.querySelector('.url-title');
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = question.text;
    input.className = 'edit-input';
    input.style.width = '100%';
    input.style.padding = '5px';
    input.style.marginBottom = '5px';
    
    // Replace text with input
    questionText.replaceWith(input);
    input.focus();
    
    // Handle save on enter or cancel on escape
    input.addEventListener('keyup', async (e) => {
        if (e.key === 'Enter') {
            const newText = input.value.trim();
            if (newText && newText !== question.text) {
                await updateQuestionText(question.id, newText);
            }
            restoreQuestionDisplay(question.id);
        } else if (e.key === 'Escape') {
            restoreQuestionDisplay(question.id);
        }
    });
    
    // Handle blur
    input.addEventListener('blur', () => {
        restoreQuestionDisplay(question.id);
    });
}

// Make notes editable
function makeNotesEditable(question) {
    const questionItem = document.querySelector(`[data-question-id="${question.id}"]`);
    const notesDiv = questionItem.querySelector('.url-note');
    
    // Create container for textarea and buttons
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.style.width = '100%';
    
    // Create textarea element
    const textarea = document.createElement('textarea');
    // Use the new separator for notes
    textarea.value = question.notes
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(note => note.note)
        .join('\n--------\n');
    textarea.className = 'edit-input';
    textarea.style.width = '100%';
    textarea.style.height = '100px';
    textarea.style.padding = '5px';
    textarea.style.marginTop = '5px';
    textarea.style.marginBottom = '5px';
    textarea.style.whiteSpace = 'pre-wrap';  // Preserve whitespace and line breaks
    
    // Create buttons container
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'question-buttons';
    buttonsDiv.style.display = 'flex';
    buttonsDiv.style.gap = '5px';
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Notes';
    saveButton.style.flex = '1';
    saveButton.onclick = async (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const newNotes = textarea.value.trim();
        if (newNotes) {
            await updateQuestionNotes(question.id, newNotes);
            // Update the question object with new notes
            question.notes = newNotes.split(/\n-{8}\n/).map(note => ({
                note: note.trim(),
                created_at: new Date().toISOString()
            }));
        }
        restoreQuestionDisplay(question.id);
    };
    
    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.flex = '1';
    cancelButton.onclick = (e) => {
        e.stopPropagation(); // Prevent event bubbling
        restoreQuestionDisplay(question.id);
    };
    
    // Add buttons to container
    buttonsDiv.appendChild(saveButton);
    buttonsDiv.appendChild(cancelButton);
    
    // Add textarea and buttons to container
    editContainer.appendChild(textarea);
    editContainer.appendChild(buttonsDiv);
    
    // Replace notes div with edit container
    notesDiv.replaceWith(editContainer);
    textarea.focus();
    
    // Still keep keyboard shortcuts
    textarea.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault(); // Prevent newline
            const newNotes = textarea.value.trim();
            if (newNotes) {
                await updateQuestionNotes(question.id, newNotes);
                // Update the question object with new notes
                question.notes = newNotes.split(/\n-{8}\n/).map(note => ({
                    note: note.trim(),
                    created_at: new Date().toISOString()
                }));
            }
            restoreQuestionDisplay(question.id);
        } else if (e.key === 'Escape') {
            restoreQuestionDisplay(question.id);
        }
    });
    
    // Prevent accidental closing
    textarea.addEventListener('blur', (e) => {
        // Only close if clicking outside the edit container
        if (!editContainer.contains(e.relatedTarget)) {
            setTimeout(() => {
                // Give time for button clicks to register
                if (!editContainer.contains(document.activeElement)) {
                    restoreQuestionDisplay(question.id);
                }
            }, 100);
        }
    });
}

// Update question text
async function updateQuestionText(questionId, newText) {
    try {
        const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: newText }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to update question');
        }
        
        // Reload questions to refresh the display
        loadQuestionHistory();
        showMessage('Question updated successfully');
    } catch (error) {
        showMessage('Failed to update question', true);
    }
}

// Update question notes
async function updateQuestionNotes(questionId, newNotes) {
    try {
        // Split notes by the separator pattern and filter out empty notes
        const notesArray = newNotes.split(/\n-{8}\n/).map(note => note.trim()).filter(note => note);
        
        // Get current tab URL and title
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const response = await fetch(`${API_BASE_URL}/questions/${questionId}/notes`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                notes: notesArray.join('\n\n'),
                current_url: tab.url,
                current_title: tab.title
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update notes');
        }
        
        const updatedQuestion = await response.json();
        
        // Update the display with the new data
        const questionItem = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionItem) {
            const notesDiv = questionItem.querySelector('.url-note');
            if (notesDiv) {
                notesDiv.style.whiteSpace = 'pre-wrap';  // Preserve whitespace and line breaks
                const notesText = updatedQuestion.notes
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map(note => note.note)
                    .join('\n--------\n');
                notesDiv.textContent = notesText || 'No notes';
            }
        }
        
        showMessage('Notes updated successfully');
    } catch (error) {
        console.error('Error updating notes:', error);
        showMessage(error.message || 'Failed to update notes', true);
    }
}

// Restore question display after editing
function restoreQuestionDisplay(questionId) {
    // Reload questions to show updated content
    loadQuestionHistory();
}

// Display questions in history view
function displayQuestions(questions) {
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = '';

    if (!questions || questions.length === 0) {
        questionsList.innerHTML = '<div class="url-item">No questions yet</div>';
        return;
    }

    questions.sort((a, b) => {
        if (a.status === b.status) {
            return new Date(b.created_at) - new Date(a.created_at);
        }
        return a.status === 'finished' ? 1 : -1;
    });

    questions.forEach(question => {
        const questionItem = document.createElement('div');
        questionItem.className = `url-item ${question.status === 'finished' ? 'finished' : ''}`;
        questionItem.setAttribute('data-question-id', question.id);
        
        const questionBox = document.createElement('div');
        questionBox.className = 'question-box';
        questionBox.textContent = question.text;
        
        questionBox.addEventListener('dblclick', () => makeQuestionEditable(question, questionBox));
        questionBox.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove any existing context menus
            const existingMenu = document.querySelector('.context-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
            
            // Create context menu
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.top = `${e.clientY}px`;
            menu.style.left = `${e.clientX}px`;
            
            // Toggle status item
            const toggleItem = document.createElement('div');
            toggleItem.className = 'context-menu-item';
            toggleItem.textContent = question.status === 'finished' ? 'Mark as To Research' : 'Mark as Finished';
            toggleItem.onclick = () => {
                toggleQuestionStatus(question.id);
                menu.remove();
            };
            
            // Delete item
            const deleteItem = document.createElement('div');
            deleteItem.className = 'context-menu-item';
            deleteItem.textContent = 'Delete Question & Notes';
            deleteItem.onclick = () => {
                if (confirm('Are you sure you want to delete this question and all its notes?')) {
                    deleteQuestion(question.id);
                    menu.remove();
                }
            };
            
            menu.appendChild(toggleItem);
            menu.appendChild(deleteItem);
            document.body.appendChild(menu);
            
            // Close menu when clicking outside
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        });

        const notesContainer = document.createElement('div');
        notesContainer.className = 'notes-container';
        
        const sortedNotes = question.notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        sortedNotes.forEach(note => {
            const noteBox = document.createElement('div');
            noteBox.className = 'note-box';
            noteBox.textContent = note.note;
            
            noteBox.addEventListener('dblclick', () => makeNoteEditable(note, noteBox));
            noteBox.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showNoteContextMenu(e, note, noteBox);
            });
            
            notesContainer.appendChild(noteBox);
        });

        questionItem.appendChild(questionBox);
        questionItem.appendChild(notesContainer);
        questionsList.appendChild(questionItem);
    });
}

// Make question text editable on double click
function makeQuestionEditable(question, questionBox) {
    const editContainer = document.createElement('div');
    editContainer.className = 'question-box editing';
    
    const input = document.createElement('textarea');
    input.className = 'editing-input';
    input.value = question.text;
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'editing-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'save-button';
    saveButton.textContent = 'Save';
    saveButton.onclick = async () => {
        const newText = input.value.trim();
        if (newText && newText !== question.text) {
            await updateQuestionText(question.id, newText);
        }
        questionBox.textContent = newText || question.text;
        questionBox.classList.remove('editing');
        editContainer.replaceWith(questionBox);
    };
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => {
        editContainer.replaceWith(questionBox);
    };
    
    buttonsContainer.appendChild(saveButton);
    buttonsContainer.appendChild(cancelButton);
    
    editContainer.appendChild(input);
    editContainer.appendChild(buttonsContainer);
    
    questionBox.replaceWith(editContainer);
    input.focus();
}

// Make note editable on double click
function makeNoteEditable(note, noteBox) {
    const editContainer = document.createElement('div');
    editContainer.className = 'note-box editing';
    
    const input = document.createElement('textarea');
    input.className = 'editing-input';
    input.value = note.note;
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'editing-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'save-button';
    saveButton.textContent = 'Save';
    saveButton.onclick = async () => {
        const newNote = input.value.trim();
        if (newNote && newNote !== note.note) {
            await updateNote(note.id, newNote);
            note.note = newNote;
        }
        noteBox.textContent = newNote || note.note;
        noteBox.classList.remove('editing');
        editContainer.replaceWith(noteBox);
    };
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => {
        editContainer.replaceWith(noteBox);
    };
    
    buttonsContainer.appendChild(saveButton);
    buttonsContainer.appendChild(cancelButton);
    
    editContainer.appendChild(input);
    editContainer.appendChild(buttonsContainer);
    
    noteBox.replaceWith(editContainer);
    input.focus();
}

// Show context menu for note
function showNoteContextMenu(e, note, noteBox) {
    e.preventDefault();
    e.stopPropagation();
    
    // Remove any existing context menus
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Calculate position relative to viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Initial position at click coordinates
    let top = e.clientY;
    let left = e.clientX;
    
    // Create delete item
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = 'Delete Note';
    
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    // Get menu dimensions
    const menuRect = menu.getBoundingClientRect();
    
    // Adjust position if menu would go outside viewport
    if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height;
    }
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width;
    }
    
    // Set final position
    menu.style.top = `${Math.max(0, top)}px`;
    menu.style.left = `${Math.max(0, left)}px`;
    
    // Add event listener
    deleteItem.addEventListener('click', async () => {
        try {
            await deleteNote(note.id);
            noteBox.remove();
            menu.remove();
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    });
    
    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    // Use setTimeout to avoid immediate trigger of the click event
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

// Show context menu for question
function showQuestionContextMenu(e, question) {
    // Remove any existing context menus
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Calculate position relative to viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Initial position at click coordinates
    let top = e.clientY;
    let left = e.clientX;
    
    // Create menu items first to get their size
    const toggleItem = document.createElement('div');
    toggleItem.className = 'context-menu-item';
    toggleItem.textContent = question.status === 'finished' ? 'Mark as To Research' : 'Mark as Finished';
    
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = 'Delete Question & Notes';
    
    menu.appendChild(toggleItem);
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    
    // Get menu dimensions
    const menuRect = menu.getBoundingClientRect();
    
    // Adjust position if menu would go outside viewport
    if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height;
    }
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width;
    }
    
    // Set final position
    menu.style.top = `${Math.max(0, top)}px`;
    menu.style.left = `${Math.max(0, left)}px`;
    
    // Add event listeners
    toggleItem.addEventListener('click', () => {
        toggleQuestionStatus(question.id);
        menu.remove();
    });
    
    deleteItem.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this question and all its notes?')) {
            deleteQuestion(question.id);
            menu.remove();
        }
    });
    
    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    // Use setTimeout to avoid immediate trigger of the click event
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

// Update note content
async function updateNote(noteId, newNote) {
    try {
        const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': chrome.runtime.getURL(''),
            },
            credentials: 'include',
            body: JSON.stringify({ note: newNote }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showMessage('Note updated successfully');
        return true;
    } catch (error) {
        showMessage('Failed to update note', true);
        throw error;
    }
}

// Delete note
async function deleteNote(noteId) {
    try {
        const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Origin': chrome.runtime.getURL(''),
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        showMessage('Note deleted successfully');
        return true;
    } catch (error) {
        showMessage('Failed to delete note', true);
        throw error;
    }
}

// Toggle between views
function toggleView() {
    const saveView = document.getElementById('saveView');
    const historyView = document.getElementById('historyView');
    const toggleButton = document.getElementById('toggleViewButton');

    if (saveView.classList.contains('active')) {
        // Switch to history view
        saveView.classList.remove('active');
        historyView.classList.add('active');
        toggleButton.textContent = 'Back to Save URL';
        
        // Copy selected project from save view to history view
        const selectedProject = document.getElementById('projectSelect').value;
        const historyProjectSelect = document.getElementById('historyProjectSelect');
        loadProjects('historyProjectSelect').then(() => {
            historyProjectSelect.value = selectedProject;
            loadQuestionHistory();
        });
    } else {
        // Switch to save view
        historyView.classList.remove('active');
        saveView.classList.add('active');
        toggleButton.textContent = 'View Questions List';
    }
}

// Show question input
function showQuestionInput(parentId = null) {
    document.getElementById('questionSelect').style.display = 'none';
    document.getElementById('addQuestionButton').style.display = 'none';
    document.getElementById('questionInputContainer').style.display = 'block';
    document.getElementById('questionInput').focus();

    // Store the parent ID for use in save handler
    document.getElementById('questionInputContainer').setAttribute('data-parent-id', parentId || '');
}

// Hide question input
function hideQuestionInput() {
    document.getElementById('questionSelect').style.display = 'block';
    document.getElementById('addQuestionButton').style.display = 'block';
    document.getElementById('questionInputContainer').style.display = 'none';
    document.getElementById('questionInput').value = '';
}

// Store note input content
function storeNoteInput(note) {
    chrome.storage.local.set({ lastNoteInput: note });
}

// Restore note input content
function restoreNoteInput() {
    chrome.storage.local.get('lastNoteInput', function(data) {
        if (data.lastNoteInput) {
            document.getElementById('noteInput').value = data.lastNoteInput;
        }
    });
}

// Show context menu for question select
function showQuestionContextMenu(e) {
    e.preventDefault();
    const questionSelect = document.getElementById('questionSelect');
    const selectedQuestionId = questionSelect.value;
    
    // Only show context menu if a question is selected
    if (!selectedQuestionId) {
        return;
    }

    const contextMenu = document.getElementById('questionContextMenu');
    contextMenu.style.display = 'block';
    
    // Position the menu at cursor
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
}

// Hide context menu
function hideQuestionContextMenu() {
    const contextMenu = document.getElementById('questionContextMenu');
    contextMenu.style.display = 'none';
}

// Add follow-up question
async function addFollowupQuestion() {
    const questionSelect = document.getElementById('questionSelect');
    const parentId = questionSelect.value;
    const projectId = document.getElementById('projectSelect').value;
    
    if (!parentId || !projectId) {
        showMessage('Please select a question first', true);
        return;
    }

    // Show question input with parent context
    showQuestionInput(parentId);
    const questionInput = document.getElementById('questionInput');
    const saveQuestionButton = document.getElementById('saveQuestionButton');
    
    // Update save button click handler to include parent ID
    saveQuestionButton.onclick = async () => {
        const text = questionInput.value.trim();
        if (!text) {
            showMessage('Please enter a question', true);
            return;
        }
        
        const success = await createQuestion(projectId, text, parentId);
        if (success) {
            hideQuestionInput();
        }
    };
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async function() {
    // First load projects
    loadProjects().then(() => {
        // After projects are loaded, get the last selected project
        chrome.storage.local.get('lastProjectId', function(data) {
            if (data.lastProjectId) {
                const projectSelect = document.getElementById('projectSelect');
                projectSelect.value = data.lastProjectId;
                // Load questions for the last selected project
                loadQuestions(data.lastProjectId);
            }
        });
    });

    // Restore note input content
    restoreNoteInput();
    
    // Add input event listener for note textarea
    document.getElementById('noteInput').addEventListener('input', (event) => {
        storeNoteInput(event.target.value);
    });

    // Clear stored note after successful save
    const originalSaveCurrentUrl = saveCurrentUrl;
    saveCurrentUrl = async function(projectId) {
        await originalSaveCurrentUrl(projectId);
        if (!document.getElementById('noteInput').value) {
            // Only clear storage if the note was successfully saved (input is empty)
            chrome.storage.local.remove('lastNoteInput');
        }
    };
    
    // Project select change
    document.getElementById('projectSelect').addEventListener('change', (event) => {
        if (event.target.value) {
            storeLastProject(event.target.value);
            loadQuestions(event.target.value);
        } else {
            loadQuestions(null);
        }
    });
    
    // Add question button click (for new root questions)
    document.getElementById('addQuestionButton').addEventListener('click', () => {
        const projectId = document.getElementById('projectSelect').value;
        if (!projectId) {
            showMessage('Please select a project first', true);
            return;
        }
        showQuestionInput(null); // No parent ID for root questions
    });

    // Save question button click
    document.getElementById('saveQuestionButton').addEventListener('click', async () => {
        const projectId = document.getElementById('projectSelect').value;
        const text = document.getElementById('questionInput').value.trim();
        const parentId = document.getElementById('questionInputContainer').getAttribute('data-parent-id');
        
        if (!text) {
            showMessage('Please enter a question', true);
            return;
        }
        
        const success = await createQuestion(projectId, text, parentId || null);
        if (success) {
            hideQuestionInput();
        }
    });

    // Cancel question button click
    document.getElementById('cancelQuestionButton').addEventListener('click', hideQuestionInput);

    // Question input enter key
    document.getElementById('questionInput').addEventListener('keyup', async (event) => {
        if (event.key === 'Enter') {
            const projectId = document.getElementById('projectSelect').value;
            const text = event.target.value.trim();
            const parentId = document.getElementById('questionInputContainer').getAttribute('data-parent-id');
            
            if (!text) {
                showMessage('Please enter a question', true);
                return;
            }
            
            const success = await createQuestion(projectId, text, parentId || null);
            if (success) {
                hideQuestionInput();
            }
        } else if (event.key === 'Escape') {
            hideQuestionInput();
        }
    });

    // Question select change
    document.getElementById('questionSelect').addEventListener('change', (event) => {
        if (event.target.value) {
            storeLastQuestion(event.target.value);
        }
    });
    
    // Prevent default context menu on question select
    document.getElementById('questionSelect').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Save button click
    document.getElementById('saveButton').addEventListener('click', async () => {
        const projectId = document.getElementById('projectSelect').value;
        if (!projectId) {
            showMessage('Please select a project', true);
            return;
        }
        await saveCurrentUrl(projectId);
    });
    
    // Project select change in history view
    document.getElementById('historyProjectSelect').addEventListener('change', loadQuestionHistory);
    
    // Toggle view button click
    document.getElementById('toggleViewButton').addEventListener('click', toggleView);
    
    // New project button click
    document.getElementById('newProjectButton').addEventListener('click', () => {
        document.getElementById('newProjectForm').style.display = 'block';
    });
    
    // Create project button click
    document.getElementById('createProjectButton').addEventListener('click', async () => {
        const input = document.getElementById('newProjectInput');
        const name = input.value.trim();
        
        if (!name) {
            showMessage('Please enter a project name', true);
            return;
        }
        
        const success = await createProject(name);
        if (success) {
            input.value = '';
            document.getElementById('newProjectForm').style.display = 'none';
        }
    });
    
    // Cancel button click
    document.getElementById('cancelProjectButton').addEventListener('click', () => {
        document.getElementById('newProjectInput').value = '';
        document.getElementById('newProjectForm').style.display = 'none';
    });

    // Question context menu
    const questionSelect = document.getElementById('questionSelect');
    questionSelect.addEventListener('contextmenu', showQuestionContextMenu);
    
    // Hide context menu on click outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#questionContextMenu')) {
            hideQuestionContextMenu();
        }
    });

    // Add follow-up question handler
    document.getElementById('addFollowupQuestion').addEventListener('click', function(e) {
        hideQuestionContextMenu();
        const questionSelect = document.getElementById('questionSelect');
        const parentId = questionSelect.value;
        const projectId = document.getElementById('projectSelect').value;
        
        if (!parentId || !projectId) {
            showMessage('Please select a question first', true);
            return;
        }

        showQuestionInput(parentId);
    });
}); 