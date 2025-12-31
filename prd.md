# Product Requirements Document: CoC Multi-Account Builder Tracker

## Purpose
A lightweight, web-based tool for Clash of Clans players to track builder upgrade timers across multiple accounts without needing a backend or game API integration.

## Core Features
1. **Multi-Account Management:** Users can add/name multiple villages (e.g., "Main", "Alt 1").
2. **Builder Tracking:** Each account supports up to 6 builders.
3. **Smart Timing:** Instead of a simple countdown, the app stores a "Finish Timestamp" to ensure timers persist even if the browser is closed.
4. **Persistent Storage:** Uses browser `localStorage` to save all account and timer data.
5. **Visual Progress:** Displays a progress bar and a formatted "Time Remaining" (DD:HH:MM:SS) for each builder.

## Tech Stack
- HTML5, CSS3 (Tailwind CSS for styling), and Vanilla JavaScript.
- No Backend: All logic is client-side.