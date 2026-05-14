# Primed Listening

A browser extension that auto-pauses a video right before each subtitle line, gives you a moment to anticipate what's about to be said, then resumes. Built for language learners who want to train their ear instead of leaning on subtitles.

Works on YouTube and on local video files opened in the browser.

## How it works

1. Load an `.srt` file in the popup.
2. Play any video on YouTube or a local `file://` page.
3. A few hundred milliseconds before each cue, the video pauses and the subtitle appears as an overlay.
4. After a configurable pause, the video resumes — you've heard the line *after* you've read it, so the words land instead of slipping past.

## Features

- **Fixed or dynamic pause durations.** Fixed gives every line the same pause; dynamic scales the pause with the number of words.
- **Pre-roll.** Pause slightly *before* the line starts so the subtitle is visible before any audio leaks through.
- **Subtitle offset.** Nudge cues in 100ms steps if your `.srt` is out of sync with the video.
- **Overlay subtitles.** Rendered on top of the video so it works even when the page has no native caption support.
- **Persistent settings.** Loaded cues and preferences survive popup close and tab reloads.

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `about:debugging` in Firefox).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.
5. For local video files in Chrome, click **Details** on the extension and enable **Allow access to file URLs**.

## Usage

1. Click the extension icon to open the popup.
2. Drop an `.srt` file onto the drop zone (or click to browse).
3. Toggle **Active** on.
4. Open a YouTube video or a local video file and press play.

## Settings

| Setting | What it does |
| --- | --- |
| **Pause mode** | `Fixed` uses the same pause for every line; `Dynamic` scales with word count. |
| **Pause duration** | Length of the fixed pause, in ms. |
| **ms per word** | In dynamic mode, time allotted per word. |
| **Min pause** | Floor for dynamic pauses, in ms. |
| **Pre-roll** | How early to pause before the cue starts, in ms. |
| **Subtitle offset** | Shift cues earlier or later. Negative = cues fire earlier; positive = cues fire later. |

## Project layout

```
content/content.js   — overlay + timing loop injected into the page
popup/               — extension popup UI
utils/srt-parser.js  — minimal SRT parser
manifest.json        — MV3 manifest
```
