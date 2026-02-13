document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const statusDiv = document.getElementById('status');
    const btn = document.getElementById('sendBtn');

    btn.disabled = true;
    btn.textContent = "Processando...";
    statusDiv.textContent = "Enviando emails... (Não feche esta aba)";
    statusDiv.style.color = 'blue';

    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            // Updated to handle both cases just in case
            const count = result.count !== undefined ? result.count : 'many';
            statusDiv.textContent = `Sucesso! Enviados ${count} emails.`;
            statusDiv.style.color = 'green';
            form.reset();
        } else {
            statusDiv.textContent = `Erro: ${result.error}`;
            statusDiv.style.color = 'red';
        }
    } catch (err) {
        console.error(err);
        statusDiv.textContent = "Network error occurred.";
        statusDiv.style.color = 'red';
    } finally {
        btn.disabled = false;
        btn.textContent = "Enviar Emails";
    }
});

// --- BOLD BUTTON LOGIC ---
const boldBtn = document.getElementById('boldBtn');
const textArea = document.getElementById('msgBodyInput');

if (boldBtn && textArea) {
    boldBtn.addEventListener('click', () => {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        
        // If no text is selected, do nothing
        if (start === end) return;

        const fullText = textArea.value;
        const selectedText = fullText.substring(start, end);
        
        // Wrap selected text in <b> tags
        const newText = fullText.substring(0, start) + 
                        '<b>' + selectedText + '</b>' + 
                        fullText.substring(end);
        
        textArea.value = newText;
        
        // Restore focus to textarea
        textArea.focus();
    });
}