# gpt-auto-continuer

## Overview

This is a Tampermonkey userscript that automatically continues ChatGPT responses when they appear to be incomplete. It works by detecting when ChatGPT has stopped generating text but hasn't completed its response, then automatically sending a "continue" command.

## Key Features

- Toggle Switch UI: A floating control panel that allows users to enable/disable auto-continue functionality and set a maximum number of continues.
- Smart Detection: Analyzes message content to determine if it's truly complete or just paused, using:
  - Completion keyword detection (in both English and Chinese)
  - Pattern recognition for lists, code blocks, and other structured content
  - Special handling for O1 Pro mode processing
- O1 Pro Mode Support: Specifically detects when ChatGPT is using O1 Pro mode and waits for processing to complete before continuing, including:
  - Detecting progress bars with specific height (8px)
  - Waiting for "Details" buttons to disappear
  - Implementing a 10-second waiting period after the progress bar disappears
- Safety Mechanisms:
  - Maximum continue limit (default: 7 continues)
  - 5-second waiting period after any continue command
  - Detection of completion phrases in multiple languages