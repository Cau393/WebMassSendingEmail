document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const statusDiv = document.getElementById('status');
    const btn = document.getElementById('sendBtn');

    btn.disabled = true;
    btn.textContent = "Processing...";
    statusDiv.textContent = "Sending emails... (Do not close this tab)";
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
            statusDiv.textContent = `Success! Sent ${count} emails.`;
            statusDiv.style.color = 'green';
            form.reset();
        } else {
            statusDiv.textContent = `Error: ${result.error}`;
            statusDiv.style.color = 'red';
        }
    } catch (err) {
        console.error(err);
        statusDiv.textContent = "Network error occurred.";
        statusDiv.style.color = 'red';
    } finally {
        btn.disabled = false;
        btn.textContent = "Send Emails";
    }
});