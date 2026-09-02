const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const statusDot = document.getElementById('statusDot');
const statusTitle = document.getElementById('statusTitle');
const statusSubtitle = document.getElementById('statusSubtitle');
const transcriptLabel = document.getElementById('transcriptLabel');
const minBtn = document.getElementById('minBtn');
const closeBtn = document.getElementById('closeBtn');

const ollamaBadge = document.getElementById('ollamaBadge');
const micBadge = document.getElementById('micBadge');
const wakeBadge = document.getElementById('wakeBadge');

const SUBTITLES = {
    STANDBY: 'Say "Hey JARVIS"',
    ACTIVATING: 'Initializing...',
    LISTENING: 'Listening to your request...',
    PROCESSING: 'Analyzing intent...',
    THINKING: 'Thinking...',
    EXECUTING: 'Executing command...',
    SPEAKING: 'Speaking...',
    ERROR: 'An error occurred.'
};

if (ipcRenderer) {
    ipcRenderer.on('state-update', (event, { state, text, ollamaOnline }) => {
        if (state) {
            statusTitle.innerText = state;
            statusSubtitle.innerText = SUBTITLES[state] || 'Active';
            statusDot.className = `status-indicator ${state}`;
        }

        if (text !== undefined) {
            transcriptLabel.innerText = text ? `"${text}"` : '...';
        }

        if (ollamaOnline !== undefined) {
            if (ollamaOnline) {
                ollamaBadge.innerText = 'Ollama: Connected';
                ollamaBadge.className = 'badge online';
            } else {
                ollamaBadge.innerText = 'Ollama: Offline';
                ollamaBadge.className = 'badge offline';
            }
        }
    });

    if (minBtn) {
        minBtn.addEventListener('click', () => {
            ipcRenderer.send('window-minimize');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-close');
        });
    }
}
