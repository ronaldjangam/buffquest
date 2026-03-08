# BuffQuest Project Context

## Project Info
**Name:** BuffQuest

**Concept:** Social app for the CU community (those with a colorado.edu email address) that allows users to create quests attached to the quest boards at buildings on campus, which will then be available to pick up by other users. To make a quest, users must spend credits, and be within a building zone. Upon completing a quest, the user gains credits and notoriety. Alternatively to earn credits, users can upload an image of their class schedule, and upload an image of them in their class at the time their class is scheduled to earn a daily credit reward. Quests will be safety/relevance verified by AI moderation to ensure it is an appropriate and completable quest on/around campus.

**Problem:** Students frequently need small favors or quick help around campus, such as:
- picking up coffee
- grabbing notes from a class
- finding a study partner
- helping with quick errands
However, there is no easy, trusted way to coordinate these micro-tasks within the campus community. Additionally, students often struggle with motivation to attend class or stay engaged on campus.

**Solution:** BuffQuest introduces a quest system inspired by gaming mechanics where students can create and complete real-world tasks within campus building zones. Users spend credits to post quests and earn credits by completing them or by demonstrating real attendance in their scheduled classes. This creates a self-sustaining campus micro-economy of helpful tasks and rewards.

## Key Features
- **Location-Based Quest Boards:** Each campus building acts as a quest hub, where students can view and claim quests posted by others nearby.
- **Credit Economy:** Users must spend credits to post quests and earn credits by completing quests or attending class.
- **Class Attendance Rewards:** Students can earn daily credits by verifying their presence in scheduled classes through uploading their class schedule and submitting a photo during class time. This would be verified via photo, location, and time checks.
- **Reputation & Leaderboard:** Users earn notoriety points based on successful quest completions, encouraging reliable participation.
- **AI Safety Moderation:** All quests are automatically reviewed by AI moderation to ensure they are safe, relevant to campus, realistically completable. Moderation occurs during quest creation before the quest becomes visible to other users.

## Impact
BuffQuest encourages:
- stronger campus community
- collaborative problem solving
- increased class attendance
- peer-to-peer support between students

The system transforms the university into a collaborative real-world quest environment.

## Technical Implementation
### Frontend
- Next.js for the web application framework
- TailwindCSS for responsive UI styling
- Mapbox GL JS for an interactive campus map displaying building zones and quest boards
- HTML5 Geolocation API (`navigator.geolocation` and `watchPosition()`) for real-time user location tracking and geofence validation
- REST API communication with the backend using JSON endpoints
- Progressive Web App (PWA) capabilities for mobile-friendly installation and usage on phones

### Backend
- Python backend services
- FastAPI for high-performance REST API endpoints
- SQLAlchemy ORM for database modeling and query management
- Quest lifecycle state machine controlling valid transitions between quest states: `Posted → Claimed → Completed → Verified → Rewarded`
- Backend validation to ensure:
  - quests cannot be claimed multiple times
  - rewards cannot be issued twice
  - invalid state transitions are prevented
- Location verification service that checks if a user is within the radius of a building zone before allowing quest creation or completion

### Database & Authentication
- Supabase (PostgreSQL) used for:
  - user accounts
  - quest data
  - quest claims
  - credits and notoriety scores
  - building zone metadata
  - app state
- Supabase Auth for authentication and session management
- colorado.edu email domain verification to restrict usage to CU Boulder students

### AI Moderation
- LLM-based content moderation pipeline to automatically review quests before publishing
- Flags quests that are: unsafe, inappropriate, irrelevant to campus, unrealistic to complete
- Moderation occurs during quest creation before the quest becomes visible to other users

### Hosting & Deployment
- Vercel used to deploy the Next.js frontend and serverless API routes
- FastAPI backend deployed via Vercel-compatible serverless infrastructure or edge functions
- Supabase cloud hosting for database and authentication services

## Architecture Details

### 1. The Database Setup (Supabase)
Instead of creating a separate "session" table, handle this by adding specific columns to the main Bounties (Quests) table to track its lifecycle:
- `id`: (Unique ID for the bounty/quest)
- `creator_id`: (The user who posted it)
- `hunter_id`: (Starts as null. Gets filled with the ID of the person who accepts it)
- `status`: (A text field that only allows specific words: 'open', 'in_progress', 'completed', 'cancelled')

### 2. The "Accept Bounty" Flow
When a user clicks "Accept" on the map, this creates the DoorDash-style session:
- **The Atomic Claim:** Next.js frontend (or FastAPI backend) sends an update to Supabase: "Update this bounty to 'in_progress' and set the hunter_id to me, BUT ONLY IF the status is still 'open'." (This prevents two students from claiming the same bounty at the exact same millisecond).
- **The Live Update:** Because Supabase is real-time, the map on everyone else's phone instantly sees that the status changed to 'in_progress' and the pin disappears from the main public map.
- **The Private Room:** Both the Creator and the Hunter have a shared identifier: the `bounty_id` (or `quest_id`). Use this ID to open up that direct chat modal.

### 3. The Chat System (The "Active Session")
To handle the temporary chat while the bounty is active, create a simple Messages table in Supabase:
- `id`: (Message ID)
- `bounty_id`: (Links the message to this specific active job)
- `sender_id`: (Who sent it)
- `text`: (The actual message)

When the active modal opens, the Next.js app listens to this table: "Show me all messages where `bounty_id` equals the one we are currently working on." When the drop-off is complete and the status changes to 'completed', the UI locks the chat, the points are transferred, and the "session" is over.
