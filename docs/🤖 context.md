# Sibilant

## 📌 Context

**Sibilant** is a personal utility designed to translate either text or images from the clipboard into target language using OpenAI’s model.  
It is currently triggered via **Alfred (macOS)** using a hotkey. The long-term goal is to move toward a **cross-platform**, non-bash implementation using **Node.js (JavaScript/TypeScript)** for compatibility with both macOS and Windows.

---

## 🎯 Primary Goals

1. **Analyze Clipboard Content:**
   - If clipboard contains **text** → send to GPT for target translation
   - If clipboard contains an **image** → send to GPT with the prompt:  
     _“Recognize and translate to <Target Language>”_

2. **Output the result:**
   - Copy the translation back into the **clipboard**
   - Show the translation in a user-friendly **modal window/dialog** (currently via `osascript` on macOS)
   - Trigger a **notification** to confirm successful translation

---

## 🧩 Current Bash Implementation

- **File**: `translate-buffer.sh`
- **Tools used**:
  - `pngpaste` — to get image data from clipboard
  - `jq` — to construct JSON payloads
  - `osascript` — to show dialogs and notifications
  - `pbpaste` / `pbcopy` — for clipboard access
- Uses OpenAI’s `gpt-4-vision-preview` model for **both** text and image handling
- API key is securely read from **Alfred Environment Variables** (`OPENAI_API_KEY`)

---

## 🔮 Future Tasks

1. **Port the script to TypeScript/JavaScript (Node.js):**
   - Avoid using shell utilities like `bash`, `pngpaste`, or `jq`
   - Use `clipboardy` or native clipboard access for both text and image
   - Use `axios` or `node-fetch` for API requests
   - Handle **image → base64** conversion within Node.js

2. **Ensure Cross-platform Support:**
   - Maintain **macOS** support (Alfred, AppleScript if needed)
   - Prepare for **Windows** execution (e.g., through a GUI tool or hotkey trigger)

3. **Optional future features:**
   - Language **auto-detection**
   - Language **selection via Alfred**
   - **Translation history**
   - **Pop-up style preview** (beyond system dialogs)