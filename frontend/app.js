// App state
const AppState = {
    API_BASE: '/api',
    currentTab: 'review',
    currentOperation: 'review',
    executionHistory: [],
    isResizing: false,
    resizeType: null
};

// Global variables - Use window properties to avoid temporal dead zone issues
window.savedPrompts = window.savedPrompts || [];
window.promptLibraryLoaded = window.promptLibraryLoaded || false;

// Initialize the application
function initializeApp() {
    updateLineNumbers();
    setupResizeHandles();
    initializeTokenCounter();
    setupTokenCounterDisplay();
    healthCheck();
    
    // Check if test operation is already selected and update variables
    if (AppState.currentOperation === 'test') {
        setTimeout(() => {
            console.log('Test operation active on init, updating variables...');
            updateVariablesList();
        }, 200);
    }
    
    console.log('✅ PromptForge initialized');
}

// Setup token counter display updates
function setupTokenCounterDisplay() {
    const tokenMainElement = document.querySelector('.token-main');
    const tokenDetailsElement = document.querySelector('.token-details');
    const tokenContextElement = document.getElementById('token-context');
    const tokenWarningsElement = document.getElementById('token-warnings');
    
    // Update model context display
    function updateModelContext() {
        const modelInfo = getModelContextInfo();
        tokenContextElement.textContent = `${modelInfo.name}: ${modelInfo.formattedLimit}`;
    }
    
    // Register callback to update UI when tokens change
    tokenCounter.onUpdate((stats) => {
        // Update main counter
        const tokenText = stats.tokens === 1 ? '1 token' : `${stats.tokens} tokens`;
        tokenMainElement.textContent = tokenText;
        
        // Update model context
        updateModelContext();
        
        // Update warnings
        const warnings = getTokenWarning(stats.tokens);
        tokenWarningsElement.innerHTML = '';
        
        warnings.forEach(warning => {
            const warningEl = document.createElement('div');
            warningEl.className = `token-warning ${warning.status}`;
            warningEl.textContent = warning.message;
            if (warning.tokens) {
                warningEl.title = warning.tokens; // Show detailed token count on hover
            }
            tokenWarningsElement.appendChild(warningEl);
        });
    });
    
    // Initial model context update
    updateModelContext();
}

// Handle model selection change
function updateModelContextInfo() {
    // Trigger token counter update to refresh context info
    const promptTextarea = document.getElementById('main-prompt');
    if (promptTextarea && typeof tokenCounter !== 'undefined') {
        tokenCounter.updateCount(promptTextarea.value);
    }
}

// Get currently selected model
function getCurrentModel() {
    // Check test model select first, then fall back to original model select
    const testModelSelect = document.getElementById('test-model-select');
    const modelSelect = document.getElementById('model-select');
    
    if (testModelSelect && testModelSelect.value) {
        return testModelSelect.value;
    }
    if (modelSelect && modelSelect.value) {
        return modelSelect.value;
    }
    return 'gpt-4.1'; // Default fallback
}

// Health check
async function healthCheck() {
    try {
        const response = await fetch(`${AppState.API_BASE}/health`);
        const data = await response.json();
        console.log('✅ PromptForge API:', data.status);
    } catch (error) {
        console.error('❌ API Health Check Failed:', error);
        document.querySelector('.status-dot').style.background = '#f44747';
        document.querySelector('.status-indicator span').textContent = 'API Disconnected';
    }
}

// Setup resize handles
function setupResizeHandles() {
    // Add resize handle to sidebar
    const sidebar = document.querySelector('.sidebar');
    const sidebarHandle = document.createElement('div');
    sidebarHandle.className = 'resize-handle resize-handle-vertical';
    sidebar.appendChild(sidebarHandle);
    
    // Add resize handle to results panel
    const resultsPanel = document.querySelector('.results-panel');
    const resultsHandle = document.createElement('div');
    resultsHandle.className = 'resize-handle resize-handle-horizontal';
    resultsHandle.style.position = 'absolute';
    resultsHandle.style.top = '-4px';
    resultsHandle.style.left = '0';
    resultsHandle.style.right = '0';
    resultsHandle.style.height = '8px';
    resultsHandle.style.zIndex = '1000';
    resultsHandle.title = 'Drag to resize results panel';
    resultsPanel.appendChild(resultsHandle);
    
    // Setup resize events
    setupSidebarResize(sidebarHandle);
    setupResultsResize(resultsHandle);
}

// Sidebar resize functionality
function setupSidebarResize(handle) {
    let startX, startWidth;
    
    handle.addEventListener('mousedown', (e) => {
        AppState.isResizing = true;
        AppState.resizeType = 'sidebar';
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(document.querySelector('.sidebar')).width, 10);
        
        document.body.classList.add('resizing');
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
    });
    
    function doResize(e) {
        if (!AppState.isResizing || AppState.resizeType !== 'sidebar') return;
        
        const newWidth = startWidth + e.clientX - startX;
        const sidebar = document.querySelector('.sidebar');
        const minWidth = 200;
        const maxWidth = 500;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            sidebar.style.width = newWidth + 'px';
        }
    }
    
    function stopResize() {
        AppState.isResizing = false;
        AppState.resizeType = null;
        document.body.classList.remove('resizing');
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

// Results panel resize functionality
function setupResultsResize(handle) {
    let startY, startHeight;
    
    handle.addEventListener('mousedown', (e) => {
        console.log('Results resize handle clicked'); // Debug log
        AppState.isResizing = true;
        AppState.resizeType = 'results';
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(document.querySelector('.results-panel')).height, 10);
        
        document.body.classList.add('resizing-vertical');
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    function doResize(e) {
        if (!AppState.isResizing || AppState.resizeType !== 'results') return;
        
        // Calculate new height - dragging up increases height, dragging down decreases
        const deltaY = startY - e.clientY;
        const newHeight = startHeight + deltaY;
        
        const resultsPanel = document.querySelector('.results-panel');
        const editorContainer = document.querySelector('.editor-container');
        const editorHeader = document.querySelector('.editor-header');
        
        // Calculate constraints
        const headerHeight = editorHeader.offsetHeight;
        const containerHeight = editorContainer.offsetHeight;
        
        // Ensure the prompt editor always has at least 150px of visible space
        const minPromptEditorHeight = 150;
        const maxResultsHeight = containerHeight - headerHeight - minPromptEditorHeight;
        
        // Set reasonable bounds
        const minHeight = 100;
        const maxHeight = Math.min(maxResultsHeight, Math.max(600, window.innerHeight * 0.75));
        
        const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
        
        if (constrainedHeight !== newHeight) {
            console.log(`Height constrained: ${newHeight}px -> ${constrainedHeight}px (min: ${minHeight}, max: ${maxHeight})`);
        }
        
        resultsPanel.style.height = constrainedHeight + 'px';
    }
    
    function stopResize() {
        AppState.isResizing = false;
        AppState.resizeType = null;
        document.body.classList.remove('resizing-vertical');
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        console.log('Results resize stopped');
    }
}

// Operation selection
function selectOperation(operation) {
    // Remove active state from all items
    document.querySelectorAll('.operation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active state to selected item
    event.currentTarget.classList.add('active');
    
    // Hide all control panels
    document.querySelectorAll('.operation-controls').forEach(panel => {
        panel.style.display = 'none';
    });
    
    // Show selected control panel
    const controlPanel = document.getElementById(`${operation}-controls`);
    if (controlPanel) {
        controlPanel.style.display = 'block';
    }
    
    // Special handling for library operation
    if (operation === 'library') {
        loadPromptLibrary();
        // Auto-switch to library tab
        switchTab('library');
    }
    
    // Update variables list for test operation
    if (operation === 'test') {
        updateVariablesList();
    }
    
    // Special handling for evals operation
    if (operation === 'evals') {
        // Auto-switch to evaluations tab
        switchTab('evaluations');
    }
}

// Tab switching
function switchTab(tab) {
    AppState.currentTab = tab;
    
    // Update tab appearance
    document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show appropriate content
    const content = document.getElementById('result-content');
    content.className = 'results-content';
    
    switch(tab) {
        case 'review':
            content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div>Click "Analyze Prompt" to get expert feedback</div></div>';
            break;
        case 'execution':
            content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚡</div><div>Run Quick Test or Advanced Test to see results</div></div>';
            break;
        case 'history':
            showHistory();
            break;
        case 'library':
            if (!window.promptLibraryLoaded) {
                loadPromptLibrary();
            } else {
                renderLibraryTab();
            }
            break;
        case 'evaluations':
            showEvaluationsTab();
            break;
    }
}

// Switch tab programmatically
function switchTabProgrammatically(tab) {
    AppState.currentTab = tab;
    document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
    const tabIndex = {'review': 0, 'execution': 1, 'history': 2, 'library': 3, 'evaluations': 4}[tab];
    document.querySelectorAll('.result-tab')[tabIndex].classList.add('active');
}

// Line numbers
function updateLineNumbers() {
    const textarea = document.getElementById('main-prompt');
    const lineNumbers = document.getElementById('line-numbers');
    const lines = textarea.value.split('\n').length;
    
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
        numbers += i + '<br>';
    }
    lineNumbers.innerHTML = numbers;
    
    // Update token count when content changes
    if (typeof tokenCounter !== 'undefined') {
        tokenCounter.updateCount(textarea.value);
    }
    
    // Always update variables list if test operation is active
    if (AppState.currentOperation === 'test') {
        console.log('Content changed, updating variables for test operation...');
        updateVariablesList();
    }
}

// Editor actions
function copyPrompt() {
    const prompt = document.getElementById('main-prompt').value;
    navigator.clipboard.writeText(prompt).then(() => {
        // Visual feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1000);
    });
}

function clearPrompt() {
    if (confirm('Clear the current prompt?')) {
        document.getElementById('main-prompt').value = '';
        updateLineNumbers();
        // Token counter will be updated automatically via updateLineNumbers
    }
}

// Clear workbench
async function clearWorkbench() {
    if (confirm('Are you sure you want to clear the workspace and all results?')) {
        document.getElementById('main-prompt').value = '';
        updateLineNumbers();
        document.getElementById('result-content').innerHTML = '<div class="empty-state"><div class="empty-state-icon">✨</div><div>Workspace cleared! Ready for new prompts.</div></div>';
        
        // Clear history in database
        await clearHistoryDB();
        AppState.executionHistory = []; // Keep local fallback array empty too
        
        switchTabProgrammatically('review');
        // Token counter will be updated automatically via updateLineNumbers
    }
}

// Clear all history
async function clearAllHistory() {
    if (confirm('Are you sure you want to clear all execution history? This cannot be undone.')) {
        await clearHistoryDB();
        showHistory(); // Refresh the history display
    }
}

// Show history
async function showHistory() {
    const content = document.getElementById('result-content');
    
    // Show loading state
    content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Loading history...</div></div>';
    
    try {
        const history = await loadHistoryFromDB();
        
        if (history.length === 0) {
            content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><div>No execution history yet</div></div>';
            return;
        }
        
        let historyHtml = '<h3>Execution History</h3>';
        historyHtml += '<button class="editor-btn" onclick="clearAllHistory()" style="float: right; margin-bottom: 10px;">Clear All</button>';
        historyHtml += '<div style="clear: both;"></div>';
        
        history.forEach((item, index) => {
            const statusClass = item.success ? 'success' : 'error';
            const statusText = item.success ? 'Success' : 'Error';
            const timestamp = new Date(item.timestamp).toLocaleString();
            const displayPrompt = item.prompt.length > 100 ? item.prompt.substring(0, 100) + '...' : item.prompt;
            
            historyHtml += `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-status ${statusClass}">${statusText}</span>
                        <span style="font-size: 11px; color: #858585;">${timestamp}</span>
                    </div>
                    <div class="history-details">
                        <strong>Prompt:</strong> ${displayPrompt}<br>
                        <strong>Model:</strong> ${item.model} | <strong>Settings:</strong> Temp: ${item.temperature}, Max Tokens: ${item.max_tokens}
                    </div>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; color: #569cd6; font-size: 12px;">View Response</summary>
                        <div class="history-response">${item.success ? item.response : item.error_msg}</div>
                    </details>
                </div>
            `;
        });
        
        content.innerHTML = historyHtml;
    } catch (error) {
        content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div>Failed to load history</div></div>';
        console.error('Error loading history:', error);
    }
}

// Variables helper functions
function extractVariables(prompt) {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;
    
    while ((match = variableRegex.exec(prompt)) !== null) {
        const varName = match[1].trim();
        if (!variables.includes(varName)) {
            variables.push(varName);
        }
    }
    
    return variables;
}

// Variables functionality
function updateVariablesList() {
    const prompt = document.getElementById('main-prompt').value;
    const variables = extractVariables(prompt);
    
    // Wait for DOM to be ready if test controls aren't visible yet
    const testControls = document.getElementById('test-controls');
    if (!testControls || testControls.style.display === 'none') {
        console.log('Test controls not visible yet, retrying...');
        setTimeout(updateVariablesList, 100);
        return;
    }
    
    const variablesList = document.getElementById('variables-list');
    
    if (!variablesList) {
        console.error('Variables list element not found! Current operation:', AppState.currentOperation);
        console.error('Test controls display:', testControls ? testControls.style.display : 'not found');
        return;
    }
    
    console.log('Variables detected:', variables);
    console.log('Updating variables list in DOM');
    
    if (variables.length === 0) {
        variablesList.innerHTML = '<div class="no-variables">No variables found. Use {{variable_name}} syntax to add variables.</div>';
        return;
    }
    
    let html = '';
    variables.forEach(variable => {
        html += `
            <div class="variable-item">
                <label class="variable-label" for="var-${variable}">{{${variable}}}</label>
                <input 
                    type="text" 
                    class="variable-input" 
                    id="var-${variable}" 
                    placeholder="Enter value for ${variable}..."
                    data-variable="${variable}"
                    oninput="console.log('Variable ${variable} value changed:', this.value)"
                >
            </div>
        `;
    });
    
    variablesList.innerHTML = html;
    console.log('Variables list updated with', variables.length, 'variables');
}

// Debug function for troubleshooting variable detection
function debugVariableDetection() {
    console.log('=== VARIABLE DETECTION DEBUG ===');
    
    // Check current state
    console.log('Current operation:', AppState.currentOperation);
    
    // Check if test controls are visible
    const testControls = document.getElementById('test-controls');
    console.log('Test controls element:', testControls);
    console.log('Test controls display:', testControls ? testControls.style.display : 'not found');
    
    // Check if variables list exists
    const variablesList = document.getElementById('variables-list');
    console.log('Variables list element:', variablesList);
    
    // Get current prompt
    const prompt = document.getElementById('main-prompt').value;
    console.log('Current prompt:', prompt);
    
    // Test variable extraction
    const variables = extractVariables(prompt);
    console.log('Extracted variables:', variables);
    
    // Force update
    console.log('Forcing variable list update...');
    updateVariablesList();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Make executeTest globally accessible
window.executeTest = executeTest;

// Make debug function globally available
window.debugVariableDetection = debugVariableDetection;

// Prompt Library Functions

async function loadPromptLibrary() {
    try {
        const response = await fetch('/api/prompts');
        const result = await response.json();
        
        if (result.success) {
            window.savedPrompts = result.data || [];
            window.promptLibraryLoaded = true;
            // If we're currently on the library tab, render it
            if (AppState.currentTab === 'library') {
                renderLibraryTab();
            }
        } else {
            console.error('Failed to load prompts:', result.error);
            window.savedPrompts = []; // Ensure it's always an array
            window.promptLibraryLoaded = true;
            if (AppState.currentTab === 'library') {
                renderLibraryTab();
            }
        }
    } catch (error) {
        console.error('Error loading prompt library:', error);
        window.savedPrompts = []; // Ensure it's always an array
        window.promptLibraryLoaded = true;
        if (AppState.currentTab === 'library') {
            renderLibraryTab();
        }
    }
}



async function loadPrompt(promptId) {
    try {
        const response = await fetch(`/api/prompts/${promptId}/use`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('main-prompt').value = result.data.content;
            updateLineNumbers();
            
            // Show success message briefly
            showToast('Prompt loaded successfully!', 'success');
        } else {
            showToast('Failed to load prompt: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error loading prompt:', error);
        showToast('Error loading prompt', 'error');
    }
}

function saveCurrentPrompt() {
    const content = document.getElementById('main-prompt').value.trim();
    
    if (!content) {
        showToast('Please enter a prompt before saving', 'error');
        return;
    }
    
    showSavePromptModal();
}

function showSavePromptModal(existingPrompt = null) {
    const isEdit = !!existingPrompt;
    const modalHtml = `
        <div class="modal-overlay" id="save-prompt-modal" onclick="closeSavePromptModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 class="modal-title">${isEdit ? 'Edit Prompt' : 'Save Prompt'}</h3>
                    <button class="modal-close" onclick="closeSavePromptModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Title *</label>
                        <input type="text" class="form-input" id="prompt-title" 
                               value="${existingPrompt ? escapeHtml(existingPrompt.title) : ''}" 
                               placeholder="Enter a descriptive title">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-input form-textarea" id="prompt-description" 
                                  placeholder="Describe what this prompt does...">${existingPrompt ? escapeHtml(existingPrompt.description || '') : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <input type="text" class="form-input" id="prompt-category" 
                               value="${existingPrompt ? escapeHtml(existingPrompt.category || 'General') : 'General'}" 
                               placeholder="e.g., Writing, Analysis, Coding">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tags</label>
                        <div class="form-tags" id="prompt-tags" onclick="focusTagInput()">
                            <input type="text" class="tag-input" id="tag-input" 
                                   placeholder="Add tags..." onkeydown="handleTagInput(event)">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeSavePromptModal()">Cancel</button>
                    <button class="action-btn" onclick="${isEdit ? `updatePrompt(${existingPrompt.id})` : 'savePrompt()'}">${isEdit ? 'Update' : 'Save'}</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add existing tags if editing
    if (existingPrompt && existingPrompt.tags) {
        const tags = JSON.parse(existingPrompt.tags);
        tags.forEach(tag => addTag(tag));
    }
    
    // Focus on title input
    setTimeout(() => document.getElementById('prompt-title').focus(), 100);
}

function closeSavePromptModal(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const modal = document.getElementById('save-prompt-modal');
    if (modal) {
        modal.remove();
    }
}

function focusTagInput() {
    document.getElementById('tag-input').focus();
}

function handleTagInput(event) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = event.target;
        const tag = input.value.trim();
        
        if (tag) {
            addTag(tag);
            input.value = '';
        }
    } else if (event.key === 'Backspace' && !event.target.value) {
        // Remove last tag when backspacing on empty input
        const tags = document.querySelectorAll('.tag-item');
        if (tags.length > 0) {
            tags[tags.length - 1].remove();
        }
    }
}

function addTag(tag) {
    if (!tag.trim()) return;
    
    // Check if tag already exists
    const existingTags = Array.from(document.querySelectorAll('.tag-item')).map(item => 
        item.textContent.replace('×', '').trim()
    );
    
    if (existingTags.includes(tag)) return;
    
    const tagContainer = document.getElementById('prompt-tags');
    const tagInput = document.getElementById('tag-input');
    
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-item';
    tagElement.innerHTML = `
        ${escapeHtml(tag)}
        <span class="tag-remove" onclick="this.parentElement.remove()">×</span>
    `;
    
    tagContainer.insertBefore(tagElement, tagInput);
}

function collectTags() {
    return Array.from(document.querySelectorAll('.tag-item')).map(item => 
        item.textContent.replace('×', '').trim()
    );
}

async function savePrompt() {
    const title = document.getElementById('prompt-title').value.trim();
    const description = document.getElementById('prompt-description').value.trim();
    const category = document.getElementById('prompt-category').value.trim();
    const tags = collectTags();
    const content = document.getElementById('main-prompt').value.trim();
    
    if (!title) {
        showToast('Please enter a title', 'error');
        return;
    }
    
    if (!content) {
        showToast('Please enter prompt content', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/prompts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                content,
                description,
                category: category || 'General',
                tags
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeSavePromptModal();
            window.promptLibraryLoaded = false;
            loadPromptLibrary();
            showToast('Prompt saved successfully!', 'success');
        } else {
            showToast('Failed to save prompt: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error saving prompt:', error);
        showToast('Error saving prompt', 'error');
    }
}

async function editPrompt(promptId) {
    try {
        const response = await fetch(`/api/prompts/${promptId}`);
        const result = await response.json();
        
        if (result.success) {
            showSavePromptModal(result.data);
        } else {
            showToast('Failed to load prompt for editing: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error loading prompt for editing:', error);
        showToast('Error loading prompt', 'error');
    }
}

async function updatePrompt(promptId) {
    const title = document.getElementById('prompt-title').value.trim();
    const description = document.getElementById('prompt-description').value.trim();
    const category = document.getElementById('prompt-category').value.trim();
    const tags = collectTags();
    const content = document.getElementById('main-prompt').value.trim();
    
    if (!title) {
        showToast('Please enter a title', 'error');
        return;
    }
    
    if (!content) {
        showToast('Please enter prompt content', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/prompts/${promptId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                content,
                description,
                category: category || 'General',
                tags
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeSavePromptModal();
            window.promptLibraryLoaded = false;
            loadPromptLibrary();
            showToast('Prompt updated successfully!', 'success');
        } else {
            showToast('Failed to update prompt: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error updating prompt:', error);
        showToast('Error updating prompt', 'error');
    }
}

async function deletePrompt(promptId) {
    if (!confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/prompts/${promptId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            window.promptLibraryLoaded = false;
            loadPromptLibrary();
            showToast('Prompt deleted successfully!', 'success');
        } else {
            showToast('Failed to delete prompt: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting prompt:', error);
        showToast('Error deleting prompt', 'error');
    }
}

function refreshPromptLibrary() {
    window.promptLibraryLoaded = false;
    loadPromptLibrary();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast styles
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            toast.style.background = '#4caf50';
            break;
        case 'error':
            toast.style.background = '#f44336';
            break;
        default:
            toast.style.background = '#2196f3';
    }
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
}

// Add CSS animations for toast
if (!document.querySelector('style[data-toast-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-toast-styles', 'true');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function renderLibraryTab() {
    const resultContent = document.getElementById('result-content');
    
    // Ensure savedPrompts is initialized
    if (!window.savedPrompts) {
        window.savedPrompts = [];
    }
    
    if (window.savedPrompts.length === 0) {
        resultContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div>No saved prompts yet</div>
                <p style="color: #8a8a8a; font-size: 12px; margin-top: 8px;">
                    Write a prompt and click "Save Current Prompt" to get started
                </p>
            </div>
        `;
        return;
    }
    
    const categorizedPrompts = window.savedPrompts.reduce((acc, prompt) => {
        const category = prompt.category || 'General';
        if (!acc[category]) acc[category] = [];
        acc[category].push(prompt);
        return acc;
    }, {});
    
    resultContent.innerHTML = Object.entries(categorizedPrompts).map(([category, prompts]) => `
        <div class="library-category">
            <h3 style="color: #d4d4d4; font-size: 14px; margin: 16px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #3e3e42;">
                ${escapeHtml(category)} (${prompts.length})
            </h3>
            <div class="category-prompts">
                ${prompts.map(prompt => {
                    const tags = prompt.tags ? JSON.parse(prompt.tags) : [];
                    const createdDate = new Date(prompt.created_at).toLocaleDateString();
                    
                    return `
                        <div class="prompt-item" onclick="loadPrompt(${prompt.id})" style="margin: 8px 0;">
                            <div class="prompt-actions">
                                <button class="prompt-action-btn" onclick="event.stopPropagation(); editPrompt(${prompt.id})" title="Edit">✏️</button>
                                <button class="prompt-action-btn danger" onclick="event.stopPropagation(); deletePrompt(${prompt.id})" title="Delete">🗑️</button>
                            </div>
                            <div class="prompt-title">${escapeHtml(prompt.title)}</div>
                            <div class="prompt-description">${escapeHtml(prompt.description || 'No description')}</div>
                            <div class="prompt-meta">
                                <div class="library-stats">
                                    <span>Created: ${createdDate}</span>
                                    <span class="usage-count">Used: ${prompt.usage_count} times</span>
                                </div>
                            </div>
                            ${tags.length > 0 ? `
                                <div class="prompt-tags">
                                    ${tags.map(tag => `<span class="prompt-tag">${escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

// Eval Generator Functions
function showEvaluationsTab() {
    const content = document.getElementById('result-content');
    content.innerHTML = `
        <div class="eval-empty-state">
            <div class="eval-empty-state-icon">📊</div>
            <div>Generate an evaluation suite to see systematic testing results</div>
        </div>
    `;
}

async function generateEvals() {
    const prompt = document.getElementById('main-prompt').value.trim();
    if (!prompt) {
        showToast('Please enter a prompt first', 'error');
        return;
    }

    // Get selected evaluation types
    const evalTypes = [];
    if (document.getElementById('eval-robustness').checked) evalTypes.push('robustness');
    if (document.getElementById('eval-creativity').checked) evalTypes.push('creativity');
    if (document.getElementById('eval-safety').checked) evalTypes.push('safety');
    if (document.getElementById('eval-accuracy').checked) evalTypes.push('accuracy');

    if (evalTypes.length === 0) {
        showToast('Please select at least one evaluation type', 'error');
        return;
    }

    const sampleSize = parseInt(document.getElementById('eval-sample-size').value);
    const model = document.getElementById('eval-model-select').value;
    const difficulty = document.getElementById('eval-difficulty').value;

    // Update button state
    const btn = document.getElementById('eval-btn-text');
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>Generating Evaluations...';

    // Switch to evaluations tab and show loading
    switchTab('evaluations');
    const content = document.getElementById('result-content');
    content.innerHTML = `
        <div class="eval-results-container">
            <div class="eval-header">
                <h3 class="eval-title">Evaluation Suite Generation</h3>
                <div class="eval-status running">
                    <span class="spinner"></span>
                    Generating test cases...
                </div>
            </div>
            <div class="eval-empty-state">
                <div class="eval-empty-state-icon">⚙️</div>
                <div>Creating ${sampleSize} test cases for ${evalTypes.join(', ')} evaluation...</div>
            </div>
        </div>
    `;

    try {
        // Call the eval generation API
        const response = await fetch(`${AppState.API_BASE}/generate-eval`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                eval_types: evalTypes,
                sample_size: sampleSize,
                model: model,
                difficulty: difficulty
            })
        });

        const data = await response.json();

        if (data.success) {
            displayEvalResults(data.data);
            showToast('Evaluation suite generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate evaluations');
        }
    } catch (error) {
        console.error('Error generating evaluations:', error);
        content.innerHTML = `
            <div class="eval-results-container">
                <div class="eval-header">
                    <h3 class="eval-title">Evaluation Generation Failed</h3>
                    <div class="eval-status error">
                        ❌ Error
                    </div>
                </div>
                <div class="eval-empty-state">
                    <div class="eval-empty-state-icon">❌</div>
                    <div>Failed to generate evaluations: ${error.message}</div>
                </div>
            </div>
        `;
        showToast('Failed to generate evaluations', 'error');
    } finally {
        // Reset button
        btn.textContent = originalText;
    }
}

function displayEvalResults(evalData) {
    const content = document.getElementById('result-content');
    
    // Calculate summary metrics
    const totalTests = evalData.test_cases ? evalData.test_cases.length : 0;
    const evalTypes = [...new Set(evalData.test_cases?.map(tc => tc.category) || [])];
    const avgDifficulty = calculateAverageDifficulty(evalData.test_cases || []);
    
    content.innerHTML = `
        <div class="eval-results-container">
            <div class="eval-header">
                <h3 class="eval-title">Evaluation Suite Generated</h3>
                <div class="eval-status completed">
                    ✅ Completed
                </div>
            </div>
            
            <div class="eval-summary">
                <div class="eval-metric">
                    <div class="eval-metric-title">Total Test Cases</div>
                    <div class="eval-metric-value">${totalTests}</div>
                    <div class="eval-metric-subtitle">Ready for execution</div>
                </div>
                <div class="eval-metric">
                    <div class="eval-metric-title">Evaluation Types</div>
                    <div class="eval-metric-value">${evalTypes.length}</div>
                    <div class="eval-metric-subtitle">${evalTypes.join(', ')}</div>
                </div>
                <div class="eval-metric">
                    <div class="eval-metric-title">Avg Difficulty</div>
                    <div class="eval-metric-value">${avgDifficulty}</div>
                    <div class="eval-metric-subtitle">Balanced testing</div>
                </div>
            </div>
            
            <div class="eval-results-grid">
                <div class="eval-dataset">
                    <div class="eval-section-title">Generated Test Cases</div>
                    ${renderTestCases(evalData.test_cases || [])}
                </div>
                <div class="eval-scores">
                    <div class="eval-section-title">Evaluation Criteria</div>
                    ${renderEvalCriteria(evalData.criteria || [])}
                </div>
            </div>
        </div>
    `;
}

function renderTestCases(testCases) {
    if (!testCases || testCases.length === 0) {
        return '<div class="eval-empty-state"><div>No test cases generated</div></div>';
    }
    
    return testCases.map(testCase => `
        <div class="eval-test-case">
            <div class="test-case-header">
                <span class="test-case-type">${testCase.category}</span>
                <span class="test-case-difficulty">${testCase.difficulty}</span>
            </div>
            <div class="test-case-input">${escapeHtml(testCase.input)}</div>
        </div>
    `).join('');
}

function renderEvalCriteria(criteria) {
    if (!criteria || criteria.length === 0) {
        return '<div class="eval-empty-state"><div>No evaluation criteria defined</div></div>';
    }
    
    return criteria.map(criterion => `
        <div class="eval-test-case">
            <div class="test-case-header">
                <span class="test-case-type">${criterion.name}</span>
                <span class="test-case-difficulty">Weight: ${criterion.weight}%</span>
            </div>
            <div class="test-case-input">${escapeHtml(criterion.description)}</div>
        </div>
    `).join('');
}

function calculateAverageDifficulty(testCases) {
    if (!testCases || testCases.length === 0) return 'N/A';
    
    const difficultyMap = { 'easy': 1, 'medium': 2, 'hard': 3, 'adversarial': 4 };
    const total = testCases.reduce((sum, tc) => sum + (difficultyMap[tc.difficulty] || 2), 0);
    const avg = total / testCases.length;
    
    if (avg <= 1.5) return 'Easy';
    if (avg <= 2.5) return 'Medium';
    if (avg <= 3.5) return 'Hard';
    return 'Expert';
} 