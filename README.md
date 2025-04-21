# Sibilant

Selected text of screenshot AI translation companion

## Prerequisites

- nvm
- Alfred with workflows
- brew packages: `brew install pngpaste`
- `npm i -g pnpm; pnpm i`

## Using Alfred workflow

- Create new workflow (or import from [file](src/sibilant.alfredworkflow))
- Pick "Hotkey", enable "Selection in MacOs"  - this will make text selection in any current app available for Alfred
- Add "Runscript" - for image in clipboard case
- Add Conditional block: `should_copy = true`
- Add "Copy to clipboard"
- Add "Runscript"
- Add Play Sound in parallel to "Runscript"

The script for Runscript block:

  ```bash
  #!/bin/bash
  export PATH="/Users/$(whoami)/.nvm/versions/node/v23.11.0/bin:$PATH"
  cd /Volumes/Data/www/beaver/sibilant
  pnpm start
  ```

## How to use LibreTranslate local models (not recommended)

- clone repo locally: `git clone https://github.com/LibreTranslate/LibreTranslate.git`
- replace 5000 with 9012 everywhere
- use following docker compose:

  ```yaml
  services:
    libretranslate:
      container_name: libretranslate
      build:
        context: .
        dockerfile: ./docker/Dockerfile
      restart: unless-stopped
      ports:
        - "9012:9012"
      tty: true
      healthcheck:
        test: ['CMD-SHELL', './venv/bin/python scripts/healthcheck.py']
      environment:
          - LT_UPDATE_MODELS=true
          - LT_LOAD_ONLY=en,uk,es
      volumes:
          - libretranslate_models:/home/libretranslate/.local:rw

  volumes:
    libretranslate_models:
    
  ```

- build it with: `docker build -t libretranslate/libretranslate:latest -f ./docker/arm.Dockerfile .`
- run it with: `./run.sh`
- in `config/default.json` set `provider: libre-translate`

**Notes**: Translation speed is 2x higher than OpenAi and quality is 2-3 time worse than OpenAI GPT3.5 ¯\(ツ)/¯
