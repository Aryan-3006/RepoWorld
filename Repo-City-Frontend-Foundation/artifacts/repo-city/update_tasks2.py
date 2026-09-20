import re

with open('/Users/aryan/.gemini/antigravity-ide/brain/615bdd58-4b0d-4bab-b647-dea5dae4ad37/task.md', 'r') as f:
    content = f.read()

content = content.replace('- `[ ]` Step 4', '- `[x]` Step 4')

with open('/Users/aryan/.gemini/antigravity-ide/brain/615bdd58-4b0d-4bab-b647-dea5dae4ad37/task.md', 'w') as f:
    f.write(content)
