# Meet — video meeting app, single file

A self-contained Google Meet-style video meeting app. Open `index.html` in a browser. No build step, no install, no server. Your camera, mic and screen all come from real browser APIs.

A bonus meeting **dashboard** (calendar + analytics) ships alongside as `dashboard.html` — independent of this app.

```
meeting-dashboard/
├── index.html        # Meet — the video meeting app  (open this)
├── dashboard.html    # Bonus: meeting calendar/analytics dashboard
├── tests.html        # Unit tests for utilities of both apps
└── README.md         # This file
```

## Quick start

1. Open `index.html` in **Chrome / Edge / Firefox / Safari** (Chromium recommended for best support).
2. Click **New meeting → Start an instant meeting** (or paste a code).
3. The lobby asks for camera + mic permission. Grant them.
4. Click **Join now**.
5. Once inside, all the controls work for real — see below.

> **Tip:** Open two browser tabs side-by-side with the same `?code=` URL to feel out the experience. Each tab owns its own camera/mic. (Real peer-to-peer audio/video transmission would require a WebRTC signaling server — see [Limitations](#limitations).)

## Features

### Home
- New meeting (instant / get link / schedule)
- Join by code or link (paste the full URL or just the code)
- Recent meetings (stored in `localStorage`)
- Press **N** to jump straight into a new meeting

### Pre-meeting lobby
- Live camera preview (mirrored, fills tile)
- Live mic level meter (uses Web Audio API on the actual mic input)
- Mic / camera toggle
- Camera and mic device picker
- Editable display name (saved across sessions)

### In-call
- **Real camera + mic** via `getUserMedia`
- **Real screen share** via `getDisplayMedia` — **with audio capture**
- Simulated participant tiles (animated canvas avatars) for the demo grid
- Auto-grid layout that responds to participant count
- Self picture-in-picture when there are 5+ participants
- Pin participant (sends them to full-stage)
- **Raise hand** (visible on tile + people panel)
- **Reactions** (👍 ❤️ 😂 😮 🎉 👏 🔥) — float up the screen
- **Captions** toggle — picks random speaker, demo only
- Speaking-tile highlight (random simulation, looks alive)
- Side panels: **People**, **Chat**, **Info** (with copyable link), **Activities**
- Chat with simulated replies — uses your name, persists during the call
- Timer + wall clock in the bottom bar
- **Leave** drops you to a post-call screen with the meeting duration
- **Rejoin** without re-entering the code

### Screen share — with audio (the headline feature)

When you click the **Present** button:

1. The browser asks what to share (Tab / Window / Entire screen).
2. **Pick "Chrome tab" and tick "Share tab audio"** — this is the only reliable way to also share sound from a music player or video. (Whole-screen audio works on Windows in Chrome/Edge, but never on macOS.)
3. The call automatically detects the audio track:
   - If audio is being shared → the screen tile shows a green pulsing dot, the equalizer animates with the actual audio levels, and a green "Audio" badge appears.
   - If you forgot to tick the box → a toast reminds you, and the tile shows a "Muted" badge so you can stop and try again.
4. To verify it's actually working, open the **⋮ More** menu and turn on **"Hear shared audio"** — the captured audio plays back through your speakers in real time.

The audio track is a normal `MediaStreamTrack`. In a production app you would add it to a `RTCPeerConnection` alongside the video track, and every remote peer would hear it. This file doesn't ship a signaling server, but the audio capture + visualization is fully wired — if you `console.log(MeetState().screenStream.getAudioTracks())` mid-share you'll see the live track.

### Keyboard shortcuts

| Key   | Action                       |
|-------|------------------------------|
| **N** | New meeting (from home)      |
| **M** | Mute / unmute mic            |
| **V** | Camera on / off              |
| **C** | Toggle captions              |
| **H** | Raise / lower hand           |
| **S** | Present screen               |
| **R** | Open reactions               |
| **P** | Toggle People panel          |
| **/** | Toggle Chat panel            |
| **Esc** | Close any open menu        |

## Permissions

The app asks the browser for:

| Permission       | Used by                       | Required?    |
|------------------|-------------------------------|--------------|
| Camera           | Local video tile / lobby      | Optional — call works without |
| Microphone       | Mic level meter / mute toggle | Optional — call works without |
| Display capture  | Screen share                  | Only on demand (when you click Present) |

If you deny camera/mic, you'll see an avatar tile instead of your video — the call still works.

## Privacy

Everything stays in your browser:

- No backend, no analytics, no telemetry.
- `localStorage` is used for: your display name, your recent meeting codes.
- Media streams (camera, mic, screen) never leave your machine — there is no peer connection.

To wipe stored data: `localStorage.removeItem('meet:v1')` in the console.

## Tests

Open `tests.html` for an in-browser unit test runner. It loads `index.html` and `dashboard.html` in hidden iframes, calls their exported helpers, and reports pass/fail. The suite covers:

- Meeting code format (`aaa-bbbb-ccc`, uniqueness)
- Initials extraction (single name, two parts, three parts, null safe)
- Duration formatting (`mm:ss` and `h:mm:ss`)
- Clock formatting (AM/PM, midnight/noon edge cases)
- HTML escaping
- Date math: `iso`, `parseTime`, `minutesToHHMM`, `duration`, `startOfWeek`, `addDays`
- Storage roundtrips
- Cross-app consistency (Meet and Dashboard use the same `initials` algorithm, etc.)

Re-run by clicking the button or refreshing the page.

## Dashboard (bonus)

`dashboard.html` is a meeting **calendar + analytics dashboard**, separate from the call experience:

- 4 KPI cards with sparklines (today's meetings, weekly hours, on-time %, open action items)
- Today's timeline with live "NOW" indicator
- Mini calendar with meeting-density dots
- Hours-per-day bar chart
- Meeting type donut chart
- Top participants leaderboard
- Recent recordings list
- Action items with overdue/today highlighting
- **Add, edit, duplicate, delete** meetings (modal form)
- Inline notes (click any meeting to open the side panel)
- Cmd/Ctrl-K command palette
- Keyboard shortcuts (`N` new meeting, `A` add action, `T` today, `?` help)
- Sample data preloaded; everything persists in `localStorage`

It's an independent app — separate state key (`meetinghub:v1`), separate styles — so opening it doesn't affect the Meet experience.

## Limitations

This app is intentionally a single static HTML file. To make it a "real" production meeting product you'd add:

- **Signaling server** (WebSocket) for room presence
- **`RTCPeerConnection`** between peers (one per direction; mesh for ≤ 6, SFU for larger)
- **TURN/STUN** for NAT traversal
- **Authentication** for real user identities
- **Captions** via the Web Speech API or a server-side STT pipeline
- **Recording** via `MediaRecorder` against the mixed stream

The screen-share-with-audio piece, the mic level meter, the camera tile, and all the layout/state machinery are already production-shape — they would plug straight into a real WebRTC backend without rewrites.

## License

MIT. Take it. Make it yours.
