# Sibilant

Selected text of screenshot AI translation companion

## Using Alfred workflow

- Create new workflow
- Pick "Hotkey", enable "Selection in MacOs"  - this will make text selection in any current app available for Alfred
- Add "Copy to clipboard"
- Add "Runscript"

  ```bash
  #!/bin/bash
  export PATH="/Users/$(whoami)/.nvm/versions/node/v23.11.0/bin:$PATH"
  cd /Volumes/Data/www/beaver/sibilant
  node ./src/translate-buffer.ts
  ```
