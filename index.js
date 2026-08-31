import ollama from 'ollama'

const response = await ollama.chat({
    model: 'qwen3:8b',
    messages: [
        {
            role: 'user',
            content: "what is today's date"
        }
    ]
})

console.log(response.message.content)