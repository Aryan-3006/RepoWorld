import re

with open('/Users/aryan/.gemini/antigravity-ide/brain/615bdd58-4b0d-4bab-b647-dea5dae4ad37/task.md', 'r') as f:
    content = f.read()

content = content.replace('- `[ ]` Step 1', '- `[x]` Step 1')
content = content.replace('- `[ ]` Step 2', '- `[x]` Step 2')
content = content.replace('- `[ ]` Step 3', '- `[x]` Step 3')

with open('/Users/aryan/.gemini/antigravity-ide/brain/615bdd58-4b0d-4bab-b647-dea5dae4ad37/task.md', 'w') as f:
    f.write(content)
