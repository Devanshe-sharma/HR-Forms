with open('data.json', 'rb') as f:
    data = f.read()

# Re-save as UTF-8 ignoring errors
with open('data_clean.json', 'w', encoding='utf-8', errors='ignore') as f:
    f.write(data.decode('utf-8', errors='ignore'))
